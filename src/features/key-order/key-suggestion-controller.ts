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
} from "./suggestion-snapshot";
import { Platform, type EventRef, type Plugin } from "obsidian";

import { orderPropertyKeys } from "../../core/suggestions/order-keys";
import { PropertyTypeRegistry } from "../../obsidian/property-types";
import {
  getCachedPropertyKeyUsage,
  invalidatePropertyKeyUsage,
} from "../../obsidian/metadata";
import {
  findSuggestionContainers,
  getSuggestionItemParent,
  getSuggestionItems,
  hasPropertyKeySuggestionContext,
  isPropertyKeySuggestionContainer,
  resolveSuggestionContainer,
  type SuggestionItem,
} from "../../obsidian/native-suggest-dom";
import { t, type TranslationKey } from "../../shared/i18n";
import type {
  PropertyKeyUsage,
  PropertyOrderSettings,
  PropertyType,
} from "../../shared/types";
import {
  registerSuggestionKeyboardBridge,
  synchronizeSuggestionSelection,
} from "./suggestion-keyboard-bridge";
import {
  isSuggestionElementVisible,
  PLUGIN_HIDDEN_SUGGESTION_CLASS,
} from "./suggestion-visibility";
import { RecentPropertyKeyStore } from "./recent-property-key-store";
import { RecentPropertyKeyTracker } from "./recent-property-key-tracker";

const OBSERVER_OPTIONS: MutationObserverInit = {
  attributeFilter: ["aria-hidden", "hidden"],
  attributes: true,
  childList: true,
  subtree: true,
};
const SUGGESTION_CONTENT_OBSERVER_OPTIONS: MutationObserverInit = {
  characterData: true,
  subtree: true,
};
const USAGE_REFRESH_DEBOUNCE_MILLISECONDS = 150;
const PROPERTY_TYPE_REFRESH_INTERVAL_MILLISECONDS = 1_000;
const PROPERTY_TYPE_GROUP_CLASS = "property-order-suggestion-type-group-start";
const PROPERTY_TYPE_LABEL_KEYS: Readonly<Record<PropertyType, TranslationKey>> = {
  text: "settings.keyOrder.type.text",
  list: "settings.keyOrder.type.list",
  number: "settings.keyOrder.type.number",
  checkbox: "settings.keyOrder.type.checkbox",
  date: "settings.keyOrder.type.date",
  datetime: "settings.keyOrder.type.datetime",
  tags: "settings.keyOrder.type.tags",
  unknown: "settings.keyOrder.type.unknown",
};

interface EnhancementCycle {
  containers: Set<HTMLElement>;
}

interface DocumentEnhancementState {
  contentObserver: MutationObserver;
  forceEnhancement: boolean;
  keyboardCleanup: () => void;
  observer: MutationObserver;
  observing: boolean;
  pendingRoots: Set<ParentNode>;
  rafId: number | null;
  recentTrackingCleanup: () => void;
  propertyTypeRefreshTimerId: number | null;
  usageRefreshTimerId: number | null;
  view: Window;
}

export class KeySuggestionOrderController {
  private readonly activeContainers = new Map<Document, HTMLElement>();
  private readonly documentStates = new Map<Document, DocumentEnhancementState>();
  private readonly originalSuggestions = new Map<
    HTMLElement,
    OriginalSuggestionSnapshot
  >();
  private readonly registeredEventCleanups: Array<() => void> = [];
  private initialized = false;
  private readonly plugin: Plugin;
  private readonly getSettings: () => PropertyOrderSettings;
  private recentKeyRevision = 0;
  private readonly recentKeyStore: RecentPropertyKeyStore;
  private readonly propertyTypeRegistry: PropertyTypeRegistry;
  private propertyTypeRefreshStartedAt = Number.NEGATIVE_INFINITY;
  private propertyTypeRefreshTask: Promise<void> | null = null;
  private readonly recentKeyTracker: RecentPropertyKeyTracker;

  constructor(
    plugin: Plugin,
    getSettings: () => PropertyOrderSettings,
    recentKeyStore = new RecentPropertyKeyStore(plugin.app),
    propertyTypeRegistry = new PropertyTypeRegistry(plugin.app),
  ) {
    this.plugin = plugin;
    this.getSettings = getSettings;
    this.recentKeyStore = recentKeyStore;
    this.propertyTypeRegistry = propertyTypeRegistry;
    this.recentKeyTracker = new RecentPropertyKeyTracker({
      getEnabled: () => this.initialized &&
        this.getSettings().enableNativeKeySuggestionOrder,
      onConfirmed: (key) => this.recordRecentPropertyKey(key),
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
        this.recentKeyTracker.handleMetadataChanged(file, cache);
        this.invalidateUsage();
      });
      this.registerControllerEvent(changedRef, () => {
        this.plugin.app.metadataCache.offref(changedRef);
      });
      const deletedRef = this.plugin.app.metadataCache.on("deleted", (file) => {
        this.recentKeyTracker.handleFileDeleted(file);
        this.invalidateUsage();
      });
      this.registerControllerEvent(deletedRef, () => {
        this.plugin.app.metadataCache.offref(deletedRef);
      });
      const resolvedRef = this.plugin.app.metadataCache.on("resolved", () => {
        this.invalidateUsage();
        this.requestPropertyTypeRefresh();
      });
      this.registerControllerEvent(resolvedRef, () => {
        this.plugin.app.metadataCache.offref(resolvedRef);
      });
      this.requestPropertyTypeRefresh(true);
    } catch (error) {
      this.dispose();
      throw error;
    }

    return this.dispose;
  }

  private registerControllerEvent(eventRef: EventRef, release: () => void): void {
    this.registeredEventCleanups.push(release);
    this.plugin.registerEvent(eventRef);
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

    const eventCleanups = this.registeredEventCleanups.splice(0).reverse();

    for (const cleanup of eventCleanups) {
      this.runDocumentCleanup(cleanup);
    }

    this.runDocumentCleanup(() => invalidatePropertyKeyUsage(this.plugin.app));
    this.runDocumentCleanup(() => this.recentKeyTracker.dispose());
    this.runDocumentCleanup(() => this.restoreAllContainers());
  };

  refresh(): void {
    const enabled = this.getSettings().enableNativeKeySuggestionOrder;

    if (!enabled) {
      this.recentKeyTracker.clearPending();
    } else {
      this.requestPropertyTypeRefresh(true);
    }

    for (const [targetDocument, state] of this.documentStates) {
      if (!this.getSettings().groupKeySuggestionsByType) {
        this.clearPendingPropertyTypeRefresh(state);
      }
      if (enabled) {
        this.startDocumentObservation(targetDocument, state);
        this.scheduleSuggestionEnhancement(targetDocument, true);
      } else {
        if (state.observing) {
          this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
          state.observer.disconnect();
          state.observing = false;
        }

        this.restoreDocumentEnhancements(targetDocument, state);
      }
    }
  }

  clearRecentPropertyKeys(): boolean {
    const hadKeys = this.recentKeyStore.getKeys().length > 0;
    this.recentKeyTracker.clearPending();
    const persisted = this.recentKeyStore.clear();

    if (!hadKeys) {
      return persisted;
    }

    this.recentKeyRevision += 1;

    if (this.getSettings().keySuggestionSortMode === "recent") {
      this.refresh();
    }

    return persisted;
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
      this.handleMutations(targetDocument, mutations);
    });
    const contentObserver = new targetWindow.MutationObserver((mutations) => {
      this.handleMutations(targetDocument, mutations);
    });
    const state: DocumentEnhancementState = {
      contentObserver,
      forceEnhancement: false,
      keyboardCleanup: () => undefined,
      observer,
      observing: false,
      pendingRoots: new Set(),
      rafId: null,
      recentTrackingCleanup: () => undefined,
      propertyTypeRefreshTimerId: null,
      usageRefreshTimerId: null,
      view: targetWindow,
    };
    // Register the per-document owner before its first observer/listener is
    // attached so plugin rollback can always find and dispose partial setup.
    this.documentStates.set(targetDocument, state);

    try {
      state.recentTrackingCleanup = this.recentKeyTracker.registerDocument(targetDocument);
      state.keyboardCleanup = registerSuggestionKeyboardBridge({
        getActiveContainer: () => this.getActiveContainer(targetDocument),
        getSuggestionElements: getPropertyKeySuggestionElements,
        onActivationIntent: (element, activation, event) => {
          this.recentKeyTracker.captureSuggestionActivation(
            element,
            activation === "tab",
            event,
          );
        },
        onSynchronizationFailure: (container) => this.restoreContainer(container),
        supportsEmacsNavigation: Platform.isMacOS || Platform.isIosApp,
        targetWindow,
      });

      if (this.getSettings().enableNativeKeySuggestionOrder) {
        this.startDocumentObservation(targetDocument, state);
        // Android mounts the workspace incrementally while community plugins load.
        // Scanning the entire document during that phase can monopolize the WebView
        // main thread. Mobile suggestion menus are mounted after startup, so the
        // observer can discover them without an eager full-document scan.
        if (!Platform.isMobileApp) {
          this.scheduleSuggestionEnhancement(targetDocument);
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

    if (state.observing) {
      this.runDocumentCleanup(() => {
        this.updateNativeSnapshots(targetDocument, [
          ...state.observer.takeRecords(),
          ...state.contentObserver.takeRecords(),
        ]);
      });
    }

    this.runDocumentCleanup(() => state.observer.disconnect());
    this.runDocumentCleanup(() => state.contentObserver.disconnect());
    state.observing = false;
    this.runDocumentCleanup(state.keyboardCleanup);
    this.runDocumentCleanup(state.recentTrackingCleanup);
    state.pendingRoots.clear();

    if (state.rafId != null) {
      const rafId = state.rafId;
      state.rafId = null;
      this.runDocumentCleanup(() => state.view.cancelAnimationFrame(rafId));
    }

    this.runDocumentCleanup(() => this.clearPendingUsageRefresh(state));
    this.runDocumentCleanup(() => this.clearPendingPropertyTypeRefresh(state));
    this.runDocumentCleanup(() => this.restoreContainersForDocument(targetDocument));
  }

  private runDocumentCleanup(cleanup: () => void): void {
    try {
      cleanup();
    } catch (error) {
      console.error("Property Order: failed to release a suggestion document resource", error);
    }
  }

  private handleMutations(
    targetDocument: Document,
    mutations: MutationRecord[],
  ): void {
    const state = this.documentStates.get(targetDocument);

    if (!this.initialized || state == null) {
      return;
    }

    this.updateNativeSnapshots(targetDocument, mutations);

    if (!this.getSettings().enableNativeKeySuggestionOrder) {
      const hasTrackedContainer = Array.from(this.originalSuggestions.keys()).some(
        (container) => container.ownerDocument === targetDocument,
      );

      if (hasTrackedContainer || state.rafId != null) {
        this.restoreDocumentEnhancements(targetDocument, state);
      }

      return;
    }

    for (const mutation of mutations) {
      const mutationRoot = getElementAtOrAboveNode(mutation.target);
      const targetIsRelated =
        mutationRoot != null &&
        this.isSuggestionRelatedNode(
          targetDocument,
          mutationRoot,
          mutation.type === "attributes",
        );

      if (targetIsRelated) {
        this.scheduleSuggestionEnhancement(mutationRoot);
        continue;
      }

      for (const node of Array.from(mutation.addedNodes)) {
        const addedRoot = getElementAtOrAboveNode(node);

        if (
          addedRoot != null &&
          this.isSuggestionRelatedNode(targetDocument, addedRoot, true)
        ) {
          this.scheduleSuggestionEnhancement(addedRoot);
        }
      }
    }

    this.restoreDetachedContainers(targetDocument);
  }

  private invalidateUsage(): void {
    if (!this.initialized) {
      return;
    }

    invalidatePropertyKeyUsage(this.plugin.app);

    if (this.getSettings().keySuggestionSortMode !== "usage") {
      return;
    }

    for (const [targetDocument, state] of this.documentStates) {
      const hasConnectedContainer = Array.from(this.originalSuggestions.keys()).some(
        (container) =>
          container.ownerDocument === targetDocument &&
          container.isConnected &&
          isSuggestionElementVisible(container),
      );

      if (hasConnectedContainer) {
        this.scheduleUsageRefresh(targetDocument, state);
      }
    }
  }

  private requestPropertyTypeRefresh(force = false): void {
    const settings = this.getSettings();

    if (
      !this.initialized ||
      !settings.enableNativeKeySuggestionOrder ||
      !settings.groupKeySuggestionsByType ||
      this.propertyTypeRefreshTask != null
    ) {
      return;
    }

    const now = Date.now();
    if (
      !force &&
      now - this.propertyTypeRefreshStartedAt <
        PROPERTY_TYPE_REFRESH_INTERVAL_MILLISECONDS
    ) {
      return;
    }

    this.propertyTypeRefreshStartedAt = now;
    const task = this.propertyTypeRegistry.refresh()
      .then(({ changed }) => {
        if (
          !changed ||
          !this.initialized ||
          !this.getSettings().enableNativeKeySuggestionOrder ||
          !this.getSettings().groupKeySuggestionsByType
        ) {
          return;
        }

        for (const targetDocument of this.documentStates.keys()) {
          this.scheduleSuggestionEnhancement(targetDocument, true);
        }
      })
      .catch((error: unknown) => {
        console.error("Property Order: failed to refresh property types", error);
      })
      .finally(() => {
        if (this.propertyTypeRefreshTask === task) {
          this.propertyTypeRefreshTask = null;
        }
      });

    this.propertyTypeRefreshTask = task;
  }

  private schedulePropertyTypeRefresh(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    const settings = this.getSettings();
    if (!settings.enableNativeKeySuggestionOrder || !settings.groupKeySuggestionsByType) {
      this.clearPendingPropertyTypeRefresh(state);
      return;
    }
    if (state.propertyTypeRefreshTimerId != null) return;

    state.propertyTypeRefreshTimerId = state.view.setTimeout(() => {
      state.propertyTypeRefreshTimerId = null;
      if (
        !this.initialized ||
        this.documentStates.get(targetDocument) !== state ||
        !this.getSettings().enableNativeKeySuggestionOrder ||
        !this.getSettings().groupKeySuggestionsByType
      ) return;

      const hasOpenMenu = Array.from(this.originalSuggestions.keys()).some(
        (container) => container.ownerDocument === targetDocument &&
          container.isConnected && isSuggestionElementVisible(container),
      );
      if (!hasOpenMenu) return;

      this.requestPropertyTypeRefresh();
      this.schedulePropertyTypeRefresh(targetDocument, state);
    }, PROPERTY_TYPE_REFRESH_INTERVAL_MILLISECONDS);
  }

  private clearPendingPropertyTypeRefresh(state: DocumentEnhancementState): void {
    if (state.propertyTypeRefreshTimerId == null) return;
    state.view.clearTimeout(state.propertyTypeRefreshTimerId);
    state.propertyTypeRefreshTimerId = null;
  }

  private scheduleUsageRefresh(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    this.clearPendingUsageRefresh(state);
    state.usageRefreshTimerId = state.view.setTimeout(() => {
      state.usageRefreshTimerId = null;

      if (
        !this.initialized ||
        this.documentStates.get(targetDocument) !== state ||
        !this.getSettings().enableNativeKeySuggestionOrder ||
        this.getSettings().keySuggestionSortMode !== "usage"
      ) {
        return;
      }

      for (const container of this.originalSuggestions.keys()) {
        if (
          container.ownerDocument === targetDocument &&
          container.isConnected &&
          isSuggestionElementVisible(container)
        ) {
          this.scheduleSuggestionEnhancement(container, true);
        }
      }
    }, USAGE_REFRESH_DEBOUNCE_MILLISECONDS);
  }

  private clearPendingUsageRefresh(state: DocumentEnhancementState): void {
    if (state.usageRefreshTimerId == null) {
      return;
    }

    const timerId = state.usageRefreshTimerId;
    state.usageRefreshTimerId = null;
    state.view.clearTimeout(timerId);
  }

  private isSuggestionRelatedNode(
    targetDocument: Document,
    element: HTMLElement,
    includeDescendants: boolean,
  ): boolean {
    for (const container of this.originalSuggestions.keys()) {
      if (
        container.ownerDocument === targetDocument &&
        (container === element ||
          container.contains(element) ||
          (includeDescendants && element.contains(container)))
      ) {
        return true;
      }
    }

    const candidates = includeDescendants
      ? findSuggestionContainers(element)
      : [resolveSuggestionContainer(element)];

    return candidates.some((candidate) => {
      if (candidate == null) {
        return false;
      }

      const container = resolveSuggestionContainer(candidate);
      return container != null && hasPropertyKeySuggestionContext(container);
    });
  }

  private restoreDocumentEnhancements(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    state.observer.disconnect();
    state.observing = false;
    state.pendingRoots.clear();
    state.forceEnhancement = false;

    if (state.rafId != null) {
      state.view.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    this.clearPendingUsageRefresh(state);

    try {
      this.clearPendingPropertyTypeRefresh(state);
      this.restoreContainersForDocument(targetDocument);
    } finally {
      this.startDocumentObservation(targetDocument, state);
    }
  }

  private startDocumentObservation(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    if (
      state.observing ||
      !this.initialized ||
      this.documentStates.get(targetDocument) !== state ||
      !this.getSettings().enableNativeKeySuggestionOrder
    ) {
      return;
    }

    state.observer.observe(targetDocument.body, OBSERVER_OPTIONS);
    this.rebuildSuggestionContentObservation(targetDocument, state);
    state.observing = true;
  }

  private scheduleSuggestionEnhancement(root: ParentNode, force = false): void {
    const targetDocument = getOwnerDocument(root);
    const state = targetDocument == null ? null : this.documentStates.get(targetDocument);

    if (targetDocument == null || state == null) {
      return;
    }

    state.pendingRoots.add(root);
    state.forceEnhancement ||= force;

    if (state.rafId != null) {
      return;
    }

    state.rafId = state.view.requestAnimationFrame(() => {
      if (this.documentStates.get(targetDocument) !== state) {
        return;
      }

      const pendingMutations = state.observer.takeRecords();

      if (pendingMutations.length > 0) {
        this.handleMutations(targetDocument, pendingMutations);
      }

      state.rafId = null;
      const roots = Array.from(state.pendingRoots);
      const forceCurrentCycle = state.forceEnhancement;
      state.pendingRoots.clear();
      state.forceEnhancement = false;
      const cycle: EnhancementCycle = {
        containers: new Set(),
      };

      state.observer.disconnect();
      state.observing = false;

      try {
        for (const pendingRoot of roots) {
          this.enhanceSuggestions(pendingRoot, cycle, forceCurrentCycle);
        }
      } finally {
        this.startDocumentObservation(targetDocument, state);
      }
    });
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
        synchronizeKeySuggestionSnapshot(container, snapshot);
      }
    }
  }

  private enhanceSuggestions(
    root: ParentNode,
    cycle: EnhancementCycle,
    force: boolean,
  ): void {
    const settings = this.getSettings();

    if (settings.enableNativeKeySuggestionOrder && settings.groupKeySuggestionsByType) {
      this.requestPropertyTypeRefresh();
    }

    for (const candidate of findSuggestionContainers(root)) {
      const container = resolveSuggestionContainer(candidate);

      if (container == null) {
        continue;
      }

      if (cycle.containers.has(container)) {
        continue;
      }

      cycle.containers.add(container);

      if (settings.enableNativeKeySuggestionOrder) {
        this.enhanceContainer(container, settings, force);
      } else {
        this.restoreContainer(container);
      }
    }
  }

  private enhanceContainer(
    container: HTMLElement,
    settings: PropertyOrderSettings,
    force: boolean,
  ): void {
    if (!isSuggestionElementVisible(container)) {
      this.restoreContainer(container);
      return;
    }

    const items = getSuggestionItems(container);
    const itemParent = getSuggestionItemParent(items);

    if (
      itemParent == null ||
      !isPropertyKeySuggestionContainer(container, items)
    ) {
      this.restoreContainer(container);
      return;
    }

    const snapshot = this.ensureCurrentSnapshot(container, items, itemParent);
    const state = this.documentStates.get(container.ownerDocument);
    if (state != null) {
      this.schedulePropertyTypeRefresh(container.ownerDocument, state);
    }
    const structuralSignature = createStructuralSignature(
      settings,
      items.map((item) => item.key),
      this.recentKeyRevision,
      this.propertyTypeRegistry.getRevision(),
    );
    const needsForcedUsageRefresh =
      force && settings.keySuggestionSortMode === "usage";

    if (
      container.dataset.propertyOrderSignature === structuralSignature &&
      matchesAppliedState(snapshot.appliedState, items) &&
      !needsForcedUsageRefresh
    ) {
      return;
    }

    const usage =
      settings.keySuggestionSortMode === "usage" ? this.getCachedUsage() : [];
    const orderedKeys = orderPropertyKeys(
      items.map((item) => item.key),
      {
        bottomKeys: settings.bottomPropertyKeys,
        groupByType: settings.groupKeySuggestionsByType,
        hiddenPatterns: settings.hiddenPropertyKeyPatterns,
        pinnedKeys: settings.pinnedPropertyKeys,
        propertyTypes: settings.groupKeySuggestionsByType
          ? this.propertyTypeRegistry.getTypes(items.map((item) => item.key))
          : undefined,
        recentKeys: settings.keySuggestionSortMode === "recent"
          ? this.recentKeyStore.getKeys()
          : [],
        sortMode: settings.keySuggestionSortMode,
        usage,
      },
    );
    const elementsByKey = new Map<string, HTMLElement[]>();

    for (const item of items) {
      const elements = elementsByKey.get(item.key) ?? [];
      elements.push(item.element);
      elementsByKey.set(item.key, elements);
    }

    const orderedElements = orderedKeys
      .map((item) => ({
        element: elementsByKey.get(item.key)?.shift(),
        item,
      }))
      .filter(
        (entry): entry is { element: HTMLElement; item: (typeof orderedKeys)[number] } =>
          entry.element != null,
      );
    const visibleElements = orderedElements.map(({ element }) => element);
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
      clearPropertyTypeGroupDecoration(item.element);

      if (!visibleElementSet.has(item.element)) {
        item.element.hidden = true;
        item.element.classList.add(PLUGIN_HIDDEN_SUGGESTION_CLASS);
        item.element.setAttribute("aria-hidden", "true");
      }
    }

    for (const { element, item } of orderedElements) {
      if (item.groupStart === true && item.group != null) {
        element.classList.add(PROPERTY_TYPE_GROUP_CLASS);
        element.dataset.propertyOrderTypeGroup = item.group;
        element.dataset.propertyOrderTypeLabel = t(
          PROPERTY_TYPE_LABEL_KEYS[item.group],
          settings.language,
        );
      }
    }

    for (const element of [...visibleElements, ...hiddenElements]) {
      itemParent.appendChild(element);
    }

    if (!synchronizeSuggestionSelection(
      container,
      snapshot.appliedState == null,
      getPropertyKeySuggestionElements,
    )) {
      this.restoreContainer(container);
      return;
    }

    container.dataset.propertyOrderEnhanced = "true";
    container.dataset.propertyOrderSignature = createStructuralSignature(
      settings,
      getSuggestionItems(container).map((item) => item.key),
      this.recentKeyRevision,
      this.propertyTypeRegistry.getRevision(),
    );
    snapshot.appliedState = createAppliedState(getSuggestionItems(container));
    this.activeContainers.set(container.ownerDocument, container);
  }

  private getCachedUsage(): PropertyKeyUsage[] {
    return getCachedPropertyKeyUsage(this.plugin.app);
  }

  private recordRecentPropertyKey(key: string): void {
    const beforeKeys = this.recentKeyStore.getKeys();
    const afterKeys = this.recentKeyStore.touch(key);

    if (
      beforeKeys.length !== afterKeys.length ||
      beforeKeys.some((existingKey, index) => existingKey !== afterKeys[index])
    ) {
      this.recentKeyRevision += 1;
    }
  }

  private ensureCurrentSnapshot(
    container: HTMLElement,
    items: SuggestionItem[],
    itemParent: HTMLElement,
  ): OriginalSuggestionSnapshot {
    const existingSnapshot = this.originalSuggestions.get(container);

    if (
      existingSnapshot != null &&
      existingSnapshot.parent === itemParent &&
      containsSameElements(existingSnapshot, items.map((item) => item.element))
    ) {
      return existingSnapshot;
    }

    if (existingSnapshot != null) {
      restoreKeySuggestionSnapshot(existingSnapshot);
      this.originalSuggestions.delete(container);
      delete container.dataset.propertyOrderEnhanced;
      delete container.dataset.propertyOrderSignature;
    }

    const snapshot: OriginalSuggestionSnapshot = {
      appliedState: null,
      childOrder: Array.from(itemParent.childNodes),
      elements: items.map(({ element }) => createElementSnapshot(element)),
      parent: itemParent,
    };
    this.originalSuggestions.set(container, snapshot);
    const state = this.documentStates.get(container.ownerDocument);
    state?.contentObserver.observe(
      container,
      SUGGESTION_CONTENT_OBSERVER_OPTIONS,
    );
    return snapshot;
  }

  private restoreAllContainers(): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      this.runDocumentCleanup(() => this.restoreContainer(container));
    }
  }

  private restoreContainersForDocument(targetDocument: Document): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument) {
        this.runDocumentCleanup(() => this.restoreContainer(container));
      }
    }
  }

  private restoreDetachedContainers(targetDocument: Document): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument && !container.isConnected) {
        this.runDocumentCleanup(() => this.restoreContainer(container));
      }
    }
  }

  private restoreContainer(container: HTMLElement): void {
    const snapshot = this.originalSuggestions.get(container);

    if (snapshot == null) {
      return;
    }

    restoreKeySuggestionSnapshot(snapshot);
    delete container.dataset.propertyOrderEnhanced;
    delete container.dataset.propertyOrderSignature;
    this.originalSuggestions.delete(container);
    const state = this.documentStates.get(container.ownerDocument);
    if (state != null) {
      this.rebuildSuggestionContentObservation(container.ownerDocument, state);
    }

    if (this.activeContainers.get(container.ownerDocument) === container) {
      this.activeContainers.delete(container.ownerDocument);
    }
  }

  private getActiveContainer(targetDocument: Document): HTMLElement | null {
    const container = this.activeContainers.get(targetDocument);

    if (
      container == null ||
      !container.isConnected ||
      !isSuggestionElementVisible(container) ||
      container.dataset.propertyOrderEnhanced !== "true"
    ) {
      this.activeContainers.delete(targetDocument);
      return null;
    }

    return container;
  }

  private rebuildSuggestionContentObservation(
    targetDocument: Document,
    state: DocumentEnhancementState,
  ): void {
    state.contentObserver.disconnect();

    if (!this.initialized || this.documentStates.get(targetDocument) !== state) {
      return;
    }

    for (const container of this.originalSuggestions.keys()) {
      if (container.ownerDocument === targetDocument && container.isConnected) {
        state.contentObserver.observe(
          container,
          SUGGESTION_CONTENT_OBSERVER_OPTIONS,
        );
      }
    }
  }
}

function createStructuralSignature(
  settings: PropertyOrderSettings,
  keys: string[],
  recentKeyRevision: number,
  propertyTypeRevision: number,
): string {
  return JSON.stringify({
    bottom: settings.bottomPropertyKeys,
    groupByType: settings.groupKeySuggestionsByType,
    hidden: settings.hiddenPropertyKeyPatterns,
    keys,
    pinned: settings.pinnedPropertyKeys,
    propertyTypeRevision: settings.groupKeySuggestionsByType
      ? propertyTypeRevision
      : 0,
    recentRevision: settings.keySuggestionSortMode === "recent"
      ? recentKeyRevision
      : 0,
    sortMode: settings.keySuggestionSortMode,
  });
}

function containsSameElements(
  snapshot: OriginalSuggestionSnapshot,
  elements: HTMLElement[],
): boolean {
  if (snapshot.elements.length !== elements.length) {
    return false;
  }

  const currentElements = new Set(elements);
  return snapshot.elements.every(({ element }) => currentElements.has(element));
}

function getElementAtOrAboveNode(node: Node): HTMLElement | null {
  if (node.nodeType === 1) {
    return node as HTMLElement;
  }

  return node.parentElement;
}

function getOwnerDocument(root: ParentNode): Document | null {
  const node = root as Node;
  return node.nodeType === 9 ? (node as Document) : node.ownerDocument;
}

function getPropertyKeySuggestionElements(container: HTMLElement): HTMLElement[] {
  return getSuggestionItems(container).map((item) => item.element);
}

function synchronizeKeySuggestionSnapshot(
  container: HTMLElement,
  snapshot: OriginalSuggestionSnapshot,
): void {
  const previousElements = snapshot.elements.map(({ element }) => element);
  synchronizeSnapshotElements(container, snapshot);
  const currentElements = new Set(snapshot.elements.map(({ element }) => element));

  for (const element of previousElements) {
    if (!currentElements.has(element)) {
      clearPropertyTypeGroupDecoration(element);
    }
  }
}

function restoreKeySuggestionSnapshot(snapshot: OriginalSuggestionSnapshot): void {
  restoreSnapshot(snapshot);

  for (const { element } of snapshot.elements) {
    clearPropertyTypeGroupDecoration(element);
  }
}

function clearPropertyTypeGroupDecoration(element: HTMLElement): void {
  element.classList.remove(PROPERTY_TYPE_GROUP_CLASS);
  delete element.dataset.propertyOrderTypeGroup;
  delete element.dataset.propertyOrderTypeLabel;
}
