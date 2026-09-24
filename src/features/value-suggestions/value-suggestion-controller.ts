import {
  applyNativeChildMutation,
  createAppliedState,
  createElementSnapshot,
  matchesAppliedState,
  restoreElementState,
  restoreSnapshot,
  synchronizeSnapshotElements,
  updateNativeAttributeSnapshot,
  type OriginalSuggestionSnapshot,
  type SuggestionElementSnapshot,
} from "../key-order/suggestion-snapshot";
import { Platform, type EventRef, type Plugin } from "obsidian";

import {
  orderPropertyValues,
  resolvePropertyValueRules,
} from "../../core/suggestions/order-values";
import {
  getCachedPropertyValueUsage,
  invalidatePropertyValueUsage,
} from "../../obsidian/metadata";
import {
  findSuggestionContainers,
  getPropertyValueSuggestionContext,
  getSuggestionItemParent,
  getSuggestionItems,
  hasActivePropertyValueSuggestionContext,
  isPropertyValueSuggestionContainer,
  resolvePropertyValueSuggestionContainer,
  type SuggestionItem,
} from "../../obsidian/native-suggest-dom";
import type { PropertyOrderSettings } from "../../shared/types";
import {
  registerSuggestionKeyboardBridge,
  synchronizeSuggestionSelection,
} from "../key-order/suggestion-keyboard-bridge";
import {
  isSuggestionElementVisible,
  PLUGIN_HIDDEN_SUGGESTION_CLASS,
} from "../key-order/suggestion-visibility";
import { RecentPropertyValueStore } from "./recent-property-value-store";
import { RecentPropertyValueTracker } from "./recent-property-value-tracker";

const OBSERVER_OPTIONS: MutationObserverInit = {
  attributeFilter: ["aria-hidden", "hidden"],
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
};

interface DocumentEnhancementState {
  keyboardCleanup: () => void;
  observer: MutationObserver;
  observing: boolean;
  rafId: number | null;
  recentTrackingCleanup: () => void;
  view: Window;
}

export class ValueSuggestionOrderController {
  private readonly activeContainers = new Map<Document, HTMLElement>();
  private readonly documentStates = new Map<Document, DocumentEnhancementState>();
  private initialized = false;
  private readonly getSettings: () => PropertyOrderSettings;
  private readonly originalSuggestions = new Map<HTMLElement, OriginalSuggestionSnapshot>();
  private readonly plugin: Plugin;
  private readonly recentValueStore: RecentPropertyValueStore;
  private readonly recentValueTracker: RecentPropertyValueTracker;
  private recentValueRevision = 0;
  private usageRevision = 0;
  private readonly registeredEventCleanups: Array<() => void> = [];

  constructor(
    plugin: Plugin,
    getSettings: () => PropertyOrderSettings,
    recentValueStore = new RecentPropertyValueStore(plugin.app),
  ) {
    this.plugin = plugin;
    this.getSettings = getSettings;
    this.recentValueStore = recentValueStore;
    this.recentValueTracker = new RecentPropertyValueTracker({
      getEnabled: () =>
        this.initialized && this.getSettings().enableNativeValueSuggestionOrder,
      onConfirmed: (propertyKey, value) => this.recordRecentPropertyValue(propertyKey, value),
      plugin,
    });
  }

  initialize(): () => void {
    if (this.initialized) {
      return this.dispose;
    }

    this.initialized = true;

    try {
      this.registerDocument(document);
      this.plugin.app.workspace.iterateAllLeaves((leaf) => {
        this.registerDocument(leaf.view.containerEl.ownerDocument);
      });

      const windowOpenRef = this.plugin.app.workspace.on(
        "window-open",
        (_workspaceWindow, targetWindow) => {
          this.registerDocument(targetWindow.document);
        },
      );
      this.registerControllerEvent(windowOpenRef, () => {
        this.plugin.app.workspace.offref(windowOpenRef);
      });

      const windowCloseRef = this.plugin.app.workspace.on(
        "window-close",
        (_workspaceWindow, targetWindow) => {
          this.unregisterDocument(targetWindow.document);
        },
      );
      this.registerControllerEvent(windowCloseRef, () => {
        this.plugin.app.workspace.offref(windowCloseRef);
      });

      const changedRef = this.plugin.app.metadataCache.on("changed", (file, _data, cache) => {
        this.recentValueTracker.handleMetadataChanged(file, cache);
        this.invalidateUsage();
      });
      this.registerControllerEvent(changedRef, () => {
        this.plugin.app.metadataCache.offref(changedRef);
      });

      const deletedRef = this.plugin.app.metadataCache.on("deleted", (file) => {
        this.recentValueTracker.handleFileDeleted(file);
        this.invalidateUsage();
      });
      this.registerControllerEvent(deletedRef, () => {
        this.plugin.app.metadataCache.offref(deletedRef);
      });

      const resolvedRef = this.plugin.app.metadataCache.on("resolved", () => {
        this.invalidateUsage();
      });
      this.registerControllerEvent(resolvedRef, () => {
        this.plugin.app.metadataCache.offref(resolvedRef);
      });
    } catch (error) {
      this.dispose();
      throw error;
    }

    return this.dispose;
  }

  dispose = (): void => {
    if (
      !this.initialized &&
      this.documentStates.size === 0 &&
      this.registeredEventCleanups.length === 0
    ) {
      return;
    }

    this.initialized = false;

    for (const targetDocument of Array.from(this.documentStates.keys()).reverse()) {
      this.unregisterDocument(targetDocument);
    }

    for (const cleanup of this.registeredEventCleanups.splice(0).reverse()) {
      this.runCleanup(cleanup);
    }

    this.runCleanup(() => invalidatePropertyValueUsage(this.plugin.app));
    this.runCleanup(() => this.recentValueTracker.dispose());
    this.runCleanup(() => this.restoreAllContainers());
  };

  refresh(): void {
    const enabled = this.getSettings().enableNativeValueSuggestionOrder;

    if (!enabled) {
      this.recentValueTracker.clearPending();
    }

    for (const [targetDocument, state] of this.documentStates) {
      if (enabled) {
        this.startDocumentObservation(targetDocument, state);
        this.scheduleEnhancement(targetDocument);
      } else {
        this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
        state.observer.disconnect();
        state.observing = false;
        this.cancelScheduledEnhancement(state);
        this.restoreContainersForDocument(targetDocument);
      }
    }
  }

  clearRecentPropertyValues(): boolean {
    const persisted = this.recentValueStore.clear();
    this.recentValueTracker.clearPending();
    this.recentValueRevision += 1;
    this.refresh();
    return persisted;
  }

  private registerControllerEvent(eventRef: EventRef, release: () => void): void {
    this.registeredEventCleanups.push(release);
    this.plugin.registerEvent(eventRef);
  }

  private registerDocument(targetDocument: Document): void {
    const targetWindow = targetDocument.defaultView;

    if (
      !this.initialized ||
      targetWindow == null ||
      targetDocument.body == null ||
      this.documentStates.has(targetDocument)
    ) {
      return;
    }

    const observer = new targetWindow.MutationObserver((mutations) => {
      this.updateNativeSnapshots(targetDocument, mutations);
      this.scheduleEnhancement(targetDocument);
    });
    const state: DocumentEnhancementState = {
      keyboardCleanup: () => undefined,
      observer,
      observing: false,
      rafId: null,
      recentTrackingCleanup: () => undefined,
      view: targetWindow,
    };
    this.documentStates.set(targetDocument, state);

    try {
      state.recentTrackingCleanup = this.recentValueTracker.registerDocument(targetDocument);
      state.keyboardCleanup = registerSuggestionKeyboardBridge({
        getActiveContainer: () => this.getActiveContainer(targetDocument),
        hasActiveContext: hasActivePropertyValueSuggestionContext,
        onActivationIntent: (element) => {
          this.recentValueTracker.captureSuggestionActivation(element);
        },
        onSynchronizationFailure: (container) => this.restoreContainer(container),
        supportsEmacsNavigation: Platform.isMacOS || Platform.isIosApp,
        targetWindow,
      });

      if (this.getSettings().enableNativeValueSuggestionOrder) {
        this.startDocumentObservation(targetDocument, state);

        if (!Platform.isMobileApp) {
          this.scheduleEnhancement(targetDocument);
        }
      }
    } catch (error) {
      this.unregisterDocument(targetDocument);
      throw error;
    }
  }

  private unregisterDocument(targetDocument: Document): void {
    const state = this.documentStates.get(targetDocument);

    if (state == null) {
      return;
    }

    this.documentStates.delete(targetDocument);
    this.activeContainers.delete(targetDocument);
    this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
    state.observer.disconnect();
    state.observing = false;
    this.cancelScheduledEnhancement(state);
    this.runCleanup(state.keyboardCleanup);
    this.runCleanup(state.recentTrackingCleanup);
    this.runCleanup(() => this.restoreContainersForDocument(targetDocument));
  }

  private startDocumentObservation(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    if (
      state.observing ||
      !this.initialized ||
      this.documentStates.get(targetDocument) !== state ||
      !this.getSettings().enableNativeValueSuggestionOrder
    ) {
      return;
    }

    state.observer.observe(targetDocument.body, OBSERVER_OPTIONS);
    state.observing = true;
  }

  private scheduleEnhancement(targetDocument: Document): void {
    const state = this.documentStates.get(targetDocument);

    if (
      state == null ||
      state.rafId != null ||
      !this.initialized ||
      !this.getSettings().enableNativeValueSuggestionOrder
    ) {
      return;
    }

    state.rafId = state.view.requestAnimationFrame(() => {
      state.rafId = null;

      if (
        this.documentStates.get(targetDocument) !== state ||
        !this.initialized ||
        !this.getSettings().enableNativeValueSuggestionOrder
      ) {
        return;
      }

      this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
      state.observer.disconnect();
      state.observing = false;

      try {
        this.enhanceDocument(targetDocument);
      } finally {
        this.startDocumentObservation(targetDocument, state);
      }
    });
  }

  private cancelScheduledEnhancement(state: DocumentEnhancementState): void {
    if (state.rafId == null) {
      return;
    }

    const rafId = state.rafId;
    state.rafId = null;
    state.view.cancelAnimationFrame(rafId);
  }

  private updateNativeSnapshots(
    targetDocument: Document,
    mutations: readonly MutationRecord[],
  ): void {
    if (mutations.length === 0 || this.originalSuggestions.size === 0) {
      return;
    }

    const snapshots = Array.from(this.originalSuggestions.entries()).filter(
      ([container]) => container.ownerDocument === targetDocument,
    );
    const touchedContainers = new Set<HTMLElement>();

    for (const mutation of mutations) {
      for (const [container, snapshot] of snapshots) {
        if (mutation.type === "childList" && mutation.target === snapshot.parent) {
          applyNativeChildMutation(snapshot, mutation);
          touchedContainers.add(container);
        } else if (mutation.type === "attributes") {
          updateNativeAttributeSnapshot(snapshot, mutation);
        }
      }
    }

    for (const container of touchedContainers) {
      const snapshot = this.originalSuggestions.get(container);

      if (snapshot != null) {
        synchronizeSnapshotElements(container, snapshot);
      }
    }
  }

  private enhanceDocument(targetDocument: Document): void {
    const candidates = [...new Set(findSuggestionContainers(targetDocument)
      .map(resolvePropertyValueSuggestionContainer)
      .filter((container): container is HTMLElement => container != null))];
    const candidateSet = new Set(candidates);

    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (
        container.ownerDocument === targetDocument &&
        (!container.isConnected || !candidateSet.has(container))
      ) {
        this.restoreContainer(container);
      }
    }

    for (const container of candidates) {
      this.enhanceContainer(container);
    }
  }

  private enhanceContainer(container: HTMLElement): void {
    const settings = this.getSettings();
    const items = getSuggestionItems(container);

    if (
      !settings.enableNativeValueSuggestionOrder ||
      !isSuggestionElementVisible(container) ||
      !isPropertyValueSuggestionContainer(container, items)
    ) {
      this.restoreContainer(container);
      return;
    }

    const context = getPropertyValueSuggestionContext(container);
    const itemParent = getSuggestionItemParent(items);

    if (context == null || itemParent == null) {
      this.restoreContainer(container);
      return;
    }

    const snapshot = this.ensureCurrentSnapshot(container, items, itemParent);
    const rules = resolvePropertyValueRules(context.propertyKey, {
      bottomRules: settings.bottomPropertyValues,
      defaultSortMode: settings.valueSuggestionSortMode,
      hiddenRules: settings.hiddenPropertyValuePatterns,
      pinnedRules: settings.pinnedPropertyValues,
      sortOverrides: settings.valueSuggestionSortOverrides,
    });
    const itemsByElement = new Map(items.map((item) => [item.element, item]));
    const nativeItems = snapshot.childOrder
      .map((node) => itemsByElement.get(node as HTMLElement))
      .filter((item): item is SuggestionItem => item != null);
    const signature = JSON.stringify({
      bottom: rules.bottomValues,
      hidden: rules.hiddenPatterns,
      pinned: rules.pinnedValues,
      propertyKey: context.propertyKey,
      recentRevision: rules.sortMode === "recent" ? this.recentValueRevision : 0,
      sortMode: rules.sortMode,
      usageRevision: rules.sortMode === "usage" ? this.usageRevision : 0,
      values: nativeItems.map((item) => item.key),
    });

    if (container.dataset.propertyOrderValueSignature === signature &&
      matchesAppliedState(snapshot.appliedState, items)) {
      return;
    }

    const orderedValues = orderPropertyValues(
      nativeItems.map((item) => item.key),
      {
        bottomValues: rules.bottomValues,
        hiddenPatterns: rules.hiddenPatterns,
        pinnedValues: rules.pinnedValues,
        recentValues:
          rules.sortMode === "recent"
            ? this.recentValueStore.getValues(context.propertyKey)
            : [],
        sortMode: rules.sortMode,
        usage:
          rules.sortMode === "usage"
            ? getCachedPropertyValueUsage(this.plugin.app, context.propertyKey)
            : [],
      },
    );
    const elementsByValue = new Map<string, HTMLElement[]>();

    for (const item of items) {
      const elements = elementsByValue.get(item.key) ?? [];
      elements.push(item.element);
      elementsByValue.set(item.key, elements);
    }

    const visibleElements = orderedValues
      .map((item) => elementsByValue.get(item.value)?.shift())
      .filter((element): element is HTMLElement => element != null);
    const visibleElementSet = new Set(visibleElements);
    const hiddenElements = items
      .map((item) => item.element)
      .filter((element) => !visibleElementSet.has(element));
    const snapshotsByElement = new Map(
      snapshot.elements.map((elementSnapshot) => [
        elementSnapshot.element,
        elementSnapshot,
      ]),
    );

    for (const item of items) {
      const elementSnapshot = snapshotsByElement.get(item.element);

      if (elementSnapshot == null) {
        continue;
      }

      restoreElementState(elementSnapshot);

      if (!visibleElementSet.has(item.element)) {
        item.element.hidden = true;
        item.element.classList.add(PLUGIN_HIDDEN_SUGGESTION_CLASS);
        item.element.setAttribute("aria-hidden", "true");
      }
    }

    for (const element of [...visibleElements, ...hiddenElements]) {
      itemParent.appendChild(element);
    }

    if (!synchronizeSuggestionSelection(container, snapshot.appliedState == null)) {
      this.restoreContainer(container);
      return;
    }

    snapshot.appliedState = createAppliedState(getSuggestionItems(container));
    container.dataset.propertyOrderValueEnhanced = "true";
    container.dataset.propertyOrderValueSignature = signature;
    this.activeContainers.set(container.ownerDocument, container);
  }

  private ensureCurrentSnapshot(
    container: HTMLElement,
    items: SuggestionItem[],
    itemParent: HTMLElement,
  ): OriginalSuggestionSnapshot {
    const existing = this.originalSuggestions.get(container);
    const currentElements = items.map((item) => item.element);

    if (
      existing != null &&
      existing.parent === itemParent &&
      haveSameElementSet(existing.elements, currentElements)
    ) {
      return existing;
    }

    if (existing != null) {
      for (const item of existing.elements) {
        if (item.element.isConnected) restoreElementState(item);
      }
      this.originalSuggestions.delete(container);
      delete container.dataset.propertyOrderValueEnhanced;
      delete container.dataset.propertyOrderValueSignature;
    }

    const snapshot: OriginalSuggestionSnapshot = {
      appliedState: null,
      childOrder: Array.from(itemParent.childNodes),
      elements: currentElements.map((element) => createElementSnapshot(element)),
      parent: itemParent,
    };
    this.originalSuggestions.set(container, snapshot);
    return snapshot;
  }

  private getActiveContainer(targetDocument: Document): HTMLElement | null {
    const container = this.activeContainers.get(targetDocument);

    if (
      container == null ||
      !container.isConnected ||
      !isSuggestionElementVisible(container) ||
      container.dataset.propertyOrderValueEnhanced !== "true"
    ) {
      this.activeContainers.delete(targetDocument);
      return null;
    }

    return container;
  }

  private invalidateUsage(): void {
    if (!this.initialized) {
      return;
    }

    invalidatePropertyValueUsage(this.plugin.app);
    this.usageRevision += 1;

    if (!this.getSettings().enableNativeValueSuggestionOrder) {
      return;
    }

    for (const targetDocument of this.documentStates.keys()) {
      this.scheduleEnhancement(targetDocument);
    }
  }

  private recordRecentPropertyValue(propertyKey: string, value: string): void {
    const beforeValues = this.recentValueStore.getValues(propertyKey);
    const afterValues = this.recentValueStore.touch(propertyKey, value);

    if (
      beforeValues.length !== afterValues.length ||
      beforeValues.some((existingValue, index) => existingValue !== afterValues[index])
    ) {
      this.recentValueRevision += 1;

      for (const targetDocument of this.documentStates.keys()) {
        this.scheduleEnhancement(targetDocument);
      }
    }
  }

  private restoreAllContainers(): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      this.runCleanup(() => this.restoreContainer(container));
    }
  }

  private restoreContainersForDocument(targetDocument: Document): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument) {
        this.runCleanup(() => this.restoreContainer(container));
      }
    }
  }

  private restoreContainer(container: HTMLElement): void {
    const snapshot = this.originalSuggestions.get(container);

    if (snapshot == null) {
      return;
    }

    restoreSnapshot(snapshot);
    this.originalSuggestions.delete(container);
    delete container.dataset.propertyOrderValueEnhanced;
    delete container.dataset.propertyOrderValueSignature;

    if (this.activeContainers.get(container.ownerDocument) === container) {
      this.activeContainers.delete(container.ownerDocument);
    }
  }

  private runCleanup(cleanup: () => void): void {
    try {
      cleanup();
    } catch (error) {
      console.error("Property Order: failed to release a value suggestion resource", error);
    }
  }
}

function haveSameElementSet(
  snapshots: SuggestionElementSnapshot[],
  elements: HTMLElement[],
): boolean {
  if (snapshots.length !== elements.length) {
    return false;
  }

  const currentElements = new Set(elements);
  return snapshots.every(({ element }) => currentElements.has(element));
}

