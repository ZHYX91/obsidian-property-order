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
import { getPropertyValueCustomOrder } from "../../core/suggestions/custom-value-order";
import { resolvePropertyValueBehavior } from "../../core/suggestions/value-behavior";
import { planGroupedPropertyValueSuggestions } from "../../core/suggestions/value-suggestion-runtime";
import {
  getCachedPropertyValueUsage,
  getCachedPropertyValueVocabulary,
  invalidatePropertyValueUsage,
} from "../../obsidian/metadata";
import {
  findSuggestionContainers,
  getActivePropertyValueSuggestionContext,
  getPropertyValueSuggestionContext,
  getPropertyValueSuggestionItems,
  getSuggestionItemParent,
  hasActivePropertyValueSuggestionContext,
  isPropertyValueSuggestionContainer,
  resolvePropertyValueSuggestionContainer,
  type PropertyValueSuggestionContext,
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
import {
  commitCustomPropertyValueCandidate,
  getPropertyValueInput,
  getPropertyValueInputText,
  mountCustomValuePopup,
  type CustomValuePopupMount,
} from "./custom-value-popup";
import { PropertyValueFrequencyStore } from "./property-value-frequency-store";
import { RecentPropertyValueStore } from "./recent-property-value-store";
import { RecentPropertyValueTracker } from "./recent-property-value-tracker";

const VALUE_SUGGESTIONS_SUPPRESSED_CLASS =
  "property-order-value-suggestions-suppressed";
const PLUGIN_PRESET_VALUE_ITEM_CLASS = "property-order-preset-value-item";

const OBSERVER_OPTIONS: MutationObserverInit = {
  attributeFilter: ["aria-hidden", "hidden"],
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
};

interface DocumentEnhancementState {
  synchronizeKeyboardScope: (active: boolean) => void;
  contextCleanup: () => void;
  keyboardCleanup: () => void;
  observer: MutationObserver;
  observing: boolean;
  rafId: number | null;
  recentTrackingCleanup: () => void;
  view: Window;
}

interface CustomFallbackSession {
  editor: HTMLElement;
  propertyKey: string;
  status: "active" | "closed";
}

export class ValueSuggestionOrderController {
  private readonly activeContainers = new Map<Document, HTMLElement>();
  private readonly customFallbacks = new Map<Document, CustomValuePopupMount>();
  private readonly customFallbackSessions = new Map<Document, CustomFallbackSession>();
  private readonly documentStates = new Map<Document, DocumentEnhancementState>();
  private initialized = false;
  private readonly getSettings: () => PropertyOrderSettings;
  private readonly originalSuggestions = new Map<HTMLElement, OriginalSuggestionSnapshot>();
  private readonly plugin: Plugin;
  private readonly propertyValueFrequencyStore: PropertyValueFrequencyStore;
  private readonly recentValueStore: RecentPropertyValueStore;
  private readonly recentValueTracker: RecentPropertyValueTracker;
  private recentValueRevision = 0;
  private frequencyRevision = 0;
  private usageRevision = 0;
  private readonly registeredEventCleanups: Array<() => void> = [];

  constructor(
    plugin: Plugin,
    getSettings: () => PropertyOrderSettings,
    recentValueStore = new RecentPropertyValueStore(plugin.app),
    propertyValueFrequencyStore = new PropertyValueFrequencyStore(plugin.app),
  ) {
    this.plugin = plugin;
    this.getSettings = getSettings;
    this.recentValueStore = recentValueStore;
    this.propertyValueFrequencyStore = propertyValueFrequencyStore;
    this.recentValueTracker = new RecentPropertyValueTracker({
      getEnabled: () =>
        this.initialized && this.getSettings().enableNativeValueSuggestionOrder,
      onConfirmed: (propertyKey, value) => this.recordConfirmedPropertyValue(propertyKey, value),
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
      this.registeredEventCleanups.length === 0 &&
      this.customFallbacks.size === 0 &&
      this.customFallbackSessions.size === 0 &&
      this.originalSuggestions.size === 0
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
        state.synchronizeKeyboardScope(false);
        this.customFallbackSessions.delete(targetDocument);
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

  clearPropertyValueFrequency(): boolean {
    const persisted = this.propertyValueFrequencyStore.clear();
    this.recentValueTracker.clearPending();
    this.frequencyRevision += 1;
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
      const fallback = this.customFallbacks.get(targetDocument);
      if (fallback != null && !fallback.editor.isConnected) {
        this.customFallbackSessions.delete(targetDocument);
        this.hideCustomFallback(targetDocument);
      }
      this.updateNativeSnapshots(targetDocument, mutations);

      if (this.shouldScheduleEnhancement(targetDocument, mutations)) {
        this.scheduleEnhancement(targetDocument);
      }
    });
    const state: DocumentEnhancementState = {
      synchronizeKeyboardScope: () => undefined,
      contextCleanup: () => undefined,
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
      const handleFocusIn = (event: FocusEvent): void => {
        const target = event.target;
        if (
          target instanceof targetWindow.HTMLElement &&
          target.closest(".metadata-property-value") != null &&
          this.getSettings().enableNativeValueSuggestionOrder
        ) {
          // A new editor focus is an explicit session start. Obsidian can reuse
          // the same popup nodes while focus moves to another property row.
          this.activateCustomFallbackSession(targetDocument);
          this.scheduleEnhancement(targetDocument);
        } else {
          this.customFallbackSessions.delete(targetDocument);
          this.hideCustomFallback(targetDocument);
          state.synchronizeKeyboardScope(false);
        }
      };
      const handleFocusOut = (event: FocusEvent): void => {
        const target = event.target;
        if (
          !(target instanceof targetWindow.HTMLElement) ||
          target.closest(".metadata-property-value") == null
        ) {
          return;
        }

        // Pointer selection prevents the editor's mousedown default, so a real
        // candidate click does not leave the editor. Defer ordinary focusout
        // cleanup one microtask so focus moving within or to another property
        // editor can settle without removing the click target prematurely.
        targetWindow.queueMicrotask(() => {
          if (this.documentStates.get(targetDocument) !== state) {
            return;
          }
          if (getActivePropertyValueSuggestionContext(targetDocument) != null) {
            return;
          }
          this.customFallbackSessions.delete(targetDocument);
          this.hideCustomFallback(targetDocument);
          state.synchronizeKeyboardScope(false);
        });
      };
      const handleInput = (event: Event): void => {
        const target = event.target;
        if (
          target instanceof targetWindow.HTMLElement &&
          target.closest(".metadata-property-value") != null &&
          this.getSettings().enableNativeValueSuggestionOrder
        ) {
          this.activateCustomFallbackSession(targetDocument);
          this.scheduleEnhancement(targetDocument);
        }
      };
      const handleEscapeIntent = (): void => {
        this.closeCustomFallbackSession(targetDocument);
        this.hideCustomFallback(targetDocument);
        state.synchronizeKeyboardScope(false);
      };
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          handleEscapeIntent();
        }
      };
      const handleWindowBlur = (): void => {
        this.closeCustomFallbackSession(targetDocument);
        this.hideCustomFallback(targetDocument);
        state.synchronizeKeyboardScope(false);
      };
      const handleWindowFocus = (): void => {
        if (
          this.getSettings().enableNativeValueSuggestionOrder &&
          getActivePropertyValueSuggestionContext(targetDocument) != null
        ) {
          this.activateCustomFallbackSession(targetDocument);
          this.scheduleEnhancement(targetDocument);
        }
      };
      targetDocument.addEventListener("focusin", handleFocusIn, true);
      targetDocument.addEventListener("focusout", handleFocusOut, true);
      targetDocument.addEventListener("input", handleInput, true);
      targetDocument.addEventListener("keydown", handleKeyDown, true);
      targetWindow.addEventListener("blur", handleWindowBlur);
      targetWindow.addEventListener("focus", handleWindowFocus);
      state.contextCleanup = () => {
        targetDocument.removeEventListener("focusin", handleFocusIn, true);
        targetDocument.removeEventListener("focusout", handleFocusOut, true);
        targetDocument.removeEventListener("input", handleInput, true);
        targetDocument.removeEventListener("keydown", handleKeyDown, true);
        targetWindow.removeEventListener("blur", handleWindowBlur);
        targetWindow.removeEventListener("focus", handleWindowFocus);
      };
      const keyboard = registerSuggestionKeyboardBridge({
        keymap: this.plugin.app.keymap,
        parentScope: this.plugin.app.scope,
        getActiveContainer: () => this.getActiveContainer(targetDocument),
        getSuggestionElements: getPropertyValueSuggestionElements,
        hasActiveContext: hasActivePropertyValueSuggestionContext,
        onActivationIntent: (element) => {
          this.recentValueTracker.captureSuggestionActivation(element);
        },
        onEscapeIntent: handleEscapeIntent,
        onSynchronizationFailure: (container) => this.restoreContainer(container),
        supportsEmacsNavigation: Platform.isMacOS || Platform.isIosApp,
        targetWindow,
      });
      state.keyboardCleanup = keyboard;
      state.synchronizeKeyboardScope = (active) => keyboard.synchronizeScope(active);

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
    this.customFallbackSessions.delete(targetDocument);
    this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
    state.observer.disconnect();
    state.observing = false;
    this.cancelScheduledEnhancement(state);
    this.runCleanup(state.contextCleanup);
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
        this.refreshCustomFallback(targetDocument);
        const context = getActivePropertyValueSuggestionContext(targetDocument);
        const suppressed = context != null && Array.from(this.originalSuggestions.keys())
          .some((container) => container.ownerDocument === targetDocument &&
            container.classList.contains(VALUE_SUGGESTIONS_SUPPRESSED_CLASS));
        state.synchronizeKeyboardScope(context != null &&
          (this.getActiveContainer(targetDocument) != null || suppressed));
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
        synchronizeSnapshotElements(
          container,
          snapshot,
          (element) => !element.classList.contains(PLUGIN_PRESET_VALUE_ITEM_CLASS),
        );
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
    this.removePluginPresetItems(container);
    container.classList.remove(VALUE_SUGGESTIONS_SUPPRESSED_CLASS);
    const items = getPropertyValueSuggestionItems(container);

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
    const itemsByElement = new Map(items.map((item) => [item.element, item]));
    const nativeItems = snapshot.childOrder
      .map((node) => itemsByElement.get(node as HTMLElement))
      .filter((item): item is SuggestionItem => item != null);
    const nativeValues = nativeItems.map((item) => item.key);

    let plannedValues: Array<{ isPreset: boolean; value: string }> = [];
    let shouldSuppress = false;
    let signaturePayload: Record<string, unknown>;

    if (settings.valueSuggestionLegacyMigrationPending) {
      const rules = resolvePropertyValueRules(context.propertyKey, {
        bottomRules: settings.bottomPropertyValues,
        defaultSortMode: settings.valueSuggestionSortMode,
        hiddenRules: settings.hiddenPropertyValuePatterns,
        pinnedRules: settings.pinnedPropertyValues,
        sortOverrides: settings.valueSuggestionSortOverrides,
      });

      shouldSuppress = rules.sortMode === "none";
      const orderedValues = shouldSuppress
        ? []
        : orderPropertyValues(nativeValues, {
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
          });
      plannedValues = orderedValues.map(({ value }) => ({ isPreset: false, value }));
      signaturePayload = {
        legacy: true,
        bottom: rules.bottomValues,
        hidden: rules.hiddenPatterns,
        pinned: rules.pinnedValues,
        propertyKey: context.propertyKey,
        recentRevision: rules.sortMode === "recent" ? this.recentValueRevision : 0,
        sortMode: rules.sortMode,
        usageRevision: rules.sortMode === "usage" ? this.usageRevision : 0,
        values: nativeValues,
      };
    } else {
      const behavior = resolvePropertyValueBehavior(
        settings.valueSuggestionPropertyAssignments,
        settings.valueSuggestionDefaultBehavior,
        context.propertyKey,
      );
      const needsFrequency =
        behavior === "frequency" ||
        (
          behavior === "custom" &&
          getPropertyValueCustomOrder(
            settings.valueSuggestionCustomOrders,
            context.propertyKey,
          ).middleSortMode === "frequency"
        );
      const needsNoteCount =
        behavior === "note-count" ||
        (
          behavior === "custom" &&
          getPropertyValueCustomOrder(
            settings.valueSuggestionCustomOrders,
            context.propertyKey,
          ).middleSortMode === "note-count"
        );
      const groupedPlan = planGroupedPropertyValueSuggestions(
        settings,
        context.propertyKey,
        nativeValues,
        needsFrequency
          ? this.propertyValueFrequencyStore.getCounts(context.propertyKey)
          : [],
        needsNoteCount
          ? getCachedPropertyValueUsage(this.plugin.app, context.propertyKey)
          : [],
      );

      shouldSuppress = groupedPlan.behavior === "none";
      plannedValues = groupedPlan.candidates.map(({ isPreset, value }) => ({
        isPreset,
        value,
      }));
      signaturePayload = {
        behavior: groupedPlan.behavior,
        customOrder:
          groupedPlan.behavior === "custom"
            ? getPropertyValueCustomOrder(
                settings.valueSuggestionCustomOrders,
                context.propertyKey,
              )
            : null,
        frequencyRevision: needsFrequency ? this.frequencyRevision : 0,
        propertyKey: context.propertyKey,
        usageRevision: needsNoteCount ? this.usageRevision : 0,
        values: nativeValues,
      };
    }

    const query = getPropertyValueInputText(getPropertyValueInput(context)).toLocaleLowerCase();
    if (query.length > 0) {
      plannedValues = plannedValues.filter(
        (planned) =>
          !planned.isPreset ||
          planned.value.toLocaleLowerCase().includes(query),
      );
    }

    if (shouldSuppress) {
      restoreSnapshot(snapshot);
      snapshot.appliedState = null;

      for (const item of items) {
        item.element.hidden = true;
        item.element.classList.add(PLUGIN_HIDDEN_SUGGESTION_CLASS);
        item.element.setAttribute("aria-hidden", "true");
        item.element.classList.remove("is-selected");
      }

      container.classList.add(VALUE_SUGGESTIONS_SUPPRESSED_CLASS);
      container.dataset.propertyOrderValueEnhanced = "true";
      container.dataset.propertyOrderValueSignature = JSON.stringify(signaturePayload);
      this.activeContainers.delete(container.ownerDocument);
      return;
    }

    const signature = JSON.stringify(signaturePayload);
    if (
      !plannedValues.some((item) => item.isPreset) &&
      container.dataset.propertyOrderValueSignature === signature &&
      matchesAppliedState(snapshot.appliedState, items)
    ) {
      return;
    }

    const elementsByValue = new Map<string, HTMLElement[]>();
    for (const item of nativeItems) {
      const elements = elementsByValue.get(item.key) ?? [];
      elements.push(item.element);
      elementsByValue.set(item.key, elements);
    }

    const visibleElements = plannedValues
      .map((planned) => {
        const nativeElement = elementsByValue.get(planned.value)?.shift();
        return nativeElement ??
          (planned.isPreset
            ? this.createPresetValueItem(context, itemParent, planned.value)
            : null);
      })
      .filter((element): element is HTMLElement => element != null);
    const visibleElementSet = new Set(visibleElements);
    const hiddenElements = nativeItems
      .map((item) => item.element)
      .filter((element) => !visibleElementSet.has(element));
    const snapshotsByElement = new Map(
      snapshot.elements.map((elementSnapshot) => [
        elementSnapshot.element,
        elementSnapshot,
      ]),
    );

    for (const item of nativeItems) {
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

    if (!synchronizeSuggestionSelection(
      container,
      snapshot.appliedState == null,
      getPropertyValueSuggestionElements,
    )) {
      this.restoreContainer(container);
      return;
    }

    snapshot.appliedState = createAppliedState(
      getPropertyValueSuggestionItems(container),
    );
    container.dataset.propertyOrderValueEnhanced = "true";
    container.dataset.propertyOrderValueSignature = signature;
    this.activeContainers.set(container.ownerDocument, container);
  }

  private createPresetValueItem(
    context: PropertyValueSuggestionContext,
    itemParent: HTMLElement,
    value: string,
  ): HTMLElement {
    const item = itemParent.createDiv({
      cls: `suggestion-item ${PLUGIN_PRESET_VALUE_ITEM_CLASS}`,
    });
    item.dataset.propertyOrderPresetValue = "true";
    item.setAttribute("role", "option");
    const title = item.createDiv({ cls: "suggestion-title" });
    title.textContent = value;

    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    item.addEventListener("click", (event) => {
      // The host delegates clicks from its popup. A plugin-only row has no
      // native item index, so letting this bubble can commit a second value.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (commitCustomPropertyValueCandidate(context, value)) {
        this.hideCustomFallback(context.editor.ownerDocument);
      }
    });
    return item;
  }

  private removePluginPresetItems(container: HTMLElement): void {
    for (const element of container.querySelectorAll<HTMLElement>(
      `.${PLUGIN_PRESET_VALUE_ITEM_CLASS}`,
    )) {
      element.remove();
    }
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
      if (this.documentNeedsMetadataRefresh(targetDocument)) {
        this.scheduleEnhancement(targetDocument);
      }
    }
  }

  private documentNeedsMetadataRefresh(targetDocument: Document): boolean {
    const settings = this.getSettings();
    const activeContext = getActivePropertyValueSuggestionContext(targetDocument);
    const fallbackSession = this.customFallbackSessions.get(targetDocument);
    if (
      activeContext != null &&
      fallbackSession?.status === "active" &&
      fallbackSession.editor === activeContext.editor &&
      equalPropertyKey(fallbackSession.propertyKey, activeContext.propertyKey) &&
      fallbackSession.editor.isConnected &&
      !settings.valueSuggestionLegacyMigrationPending &&
      resolvePropertyValueBehavior(
        settings.valueSuggestionPropertyAssignments,
        settings.valueSuggestionDefaultBehavior,
        activeContext.propertyKey,
      ) === "custom" &&
      !this.hasVisibleNativeValuePopup(targetDocument)
    ) {
      // Fallback vocabulary comes from Metadata Cache even when the current
      // query yields no mount. Keep the focused custom editor refreshable so
      // later metadata changes can create, remove, or reorder candidates.
      return true;
    }

    for (const container of this.originalSuggestions.keys()) {
      if (
        container.ownerDocument !== targetDocument ||
        !container.isConnected ||
        !isSuggestionElementVisible(container)
      ) {
        continue;
      }

      const context = getPropertyValueSuggestionContext(container);
      if (context == null) {
        continue;
      }

      if (settings.valueSuggestionLegacyMigrationPending) {
        const rules = resolvePropertyValueRules(context.propertyKey, {
          bottomRules: settings.bottomPropertyValues,
          defaultSortMode: settings.valueSuggestionSortMode,
          hiddenRules: settings.hiddenPropertyValuePatterns,
          pinnedRules: settings.pinnedPropertyValues,
          sortOverrides: settings.valueSuggestionSortOverrides,
        });
        if (rules.sortMode === "usage") {
          return true;
        }
        continue;
      }

      const behavior = resolvePropertyValueBehavior(
        settings.valueSuggestionPropertyAssignments,
        settings.valueSuggestionDefaultBehavior,
        context.propertyKey,
      );
      if (behavior === "note-count") {
        return true;
      }
      if (
        behavior === "custom" &&
        getPropertyValueCustomOrder(
          settings.valueSuggestionCustomOrders,
          context.propertyKey,
        ).middleSortMode === "note-count"
      ) {
        return true;
      }
    }

    return false;
  }

  private shouldScheduleEnhancement(
    targetDocument: Document,
    mutations: readonly MutationRecord[],
  ): boolean {
    for (const mutation of mutations) {
      const mutationElement = getElementAtOrAboveNode(mutation.target);
      const targetMayAffectTrackedDescendants = mutation.type === "attributes";

      if (
        mutationElement != null &&
        this.isValueSuggestionRelatedElement(
          targetDocument,
          mutationElement,
          targetMayAffectTrackedDescendants,
        )
      ) {
        return true;
      }

      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (node.nodeType !== 1) {
          continue;
        }

        if (
          this.isValueSuggestionRelatedElement(
            targetDocument,
            node as HTMLElement,
            true,
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private isValueSuggestionRelatedElement(
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

    if (resolvePropertyValueSuggestionContainer(element) != null) {
      return true;
    }

    return includeDescendants && findSuggestionContainers(element).some(
      (candidate) => resolvePropertyValueSuggestionContainer(candidate) != null,
    );
  }

  private refreshCustomFallback(targetDocument: Document): void {
    const previousMount = this.customFallbacks.get(targetDocument) ?? null;
    const settings = this.getSettings();

    if (
      !settings.enableNativeValueSuggestionOrder ||
      settings.valueSuggestionLegacyMigrationPending
    ) {
      this.customFallbackSessions.delete(targetDocument);
      this.hideCustomFallback(targetDocument);
      return;
    }

    const context = getActivePropertyValueSuggestionContext(targetDocument);
    if (context == null) {
      this.customFallbackSessions.delete(targetDocument);
      this.hideCustomFallback(targetDocument);
      return;
    }

    const behavior = resolvePropertyValueBehavior(
      settings.valueSuggestionPropertyAssignments,
      settings.valueSuggestionDefaultBehavior,
      context.propertyKey,
    );
    if (behavior !== "custom") {
      this.customFallbackSessions.delete(targetDocument);
      this.hideCustomFallback(targetDocument);
      return;
    }
    if (this.hasVisibleNativeValuePopup(targetDocument)) {
      this.hideCustomFallback(targetDocument);
      return;
    }

    const fallbackSession = this.ensureCustomFallbackSession(context);
    if (fallbackSession.status !== "active") {
      this.hideCustomFallback(targetDocument);
      return;
    }

    const input = getPropertyValueInput(context);
    if (input == null) {
      this.customFallbackSessions.delete(targetDocument);
      this.hideCustomFallback(targetDocument);
      return;
    }

    const query = getPropertyValueInputText(input);
    const selectedValue =
      previousMount != null &&
      previousMount.editor === context.editor &&
      equalPropertyKey(previousMount.propertyKey, context.propertyKey) &&
      previousMount.query === query
        ? previousMount.getSelectedValue()
        : null;

    this.hideCustomFallback(targetDocument);

    const order = getPropertyValueCustomOrder(
      settings.valueSuggestionCustomOrders,
      context.propertyKey,
    );
    const plan = planGroupedPropertyValueSuggestions(
      settings,
      context.propertyKey,
      getCachedPropertyValueVocabulary(this.plugin.app, context.propertyKey),
      order.middleSortMode === "frequency"
        ? this.propertyValueFrequencyStore.getCounts(context.propertyKey)
        : [],
      order.middleSortMode === "note-count"
        ? getCachedPropertyValueUsage(this.plugin.app, context.propertyKey)
        : [],
    );
    const mount = mountCustomValuePopup(
      context,
      plan.candidates.map((candidate) => candidate.value),
      (value) => {
        commitCustomPropertyValueCandidate(context, value);
        this.closeCustomFallbackSession(targetDocument);
        this.hideCustomFallback(targetDocument);
      },
      selectedValue,
    );

    if (mount != null) {
      this.customFallbacks.set(targetDocument, mount);
      this.activeContainers.set(targetDocument, mount.container);
    }
  }

  private hasVisibleNativeValuePopup(targetDocument: Document): boolean {
    return findSuggestionContainers(targetDocument)
      .map(resolvePropertyValueSuggestionContainer)
      .some((container) =>
        container != null &&
        container.isConnected &&
        isSuggestionElementVisible(container) &&
        isPropertyValueSuggestionContainer(container)
      );
  }

  private ensureCustomFallbackSession(
    context: PropertyValueSuggestionContext,
  ): CustomFallbackSession {
    const targetDocument = context.editor.ownerDocument;
    const existing = this.customFallbackSessions.get(targetDocument);
    if (
      existing != null &&
      existing.editor === context.editor &&
      equalPropertyKey(existing.propertyKey, context.propertyKey)
    ) {
      return existing;
    }

    const session: CustomFallbackSession = {
      editor: context.editor,
      propertyKey: context.propertyKey,
      status: "active",
    };
    this.customFallbackSessions.set(targetDocument, session);
    return session;
  }

  private activateCustomFallbackSession(targetDocument: Document): void {
    const context = getActivePropertyValueSuggestionContext(targetDocument);
    if (context == null) {
      this.customFallbackSessions.delete(targetDocument);
      return;
    }

    this.customFallbackSessions.set(targetDocument, {
      editor: context.editor,
      propertyKey: context.propertyKey,
      status: "active",
    });
  }

  private closeCustomFallbackSession(targetDocument: Document): void {
    const context = getActivePropertyValueSuggestionContext(targetDocument);
    if (context == null) {
      this.customFallbackSessions.delete(targetDocument);
      return;
    }

    this.customFallbackSessions.set(targetDocument, {
      editor: context.editor,
      propertyKey: context.propertyKey,
      status: "closed",
    });
  }

  private hideCustomFallback(targetDocument: Document): void {
    const mount = this.customFallbacks.get(targetDocument);
    if (mount == null) {
      return;
    }

    this.customFallbacks.delete(targetDocument);
    if (this.activeContainers.get(targetDocument) === mount.container) {
      this.activeContainers.delete(targetDocument);
    }
    this.runCleanup(() => mount.cleanup());
  }

  private recordConfirmedPropertyValue(propertyKey: string, value: string): void {
    this.recordRecentPropertyValue(propertyKey, value);

    if (this.shouldTrackPropertyValueFrequency(propertyKey)) {
      this.propertyValueFrequencyStore.increment(propertyKey, value);
      this.frequencyRevision += 1;
      for (const targetDocument of this.documentStates.keys()) {
        this.scheduleEnhancement(targetDocument);
      }
    }
  }

  private shouldTrackPropertyValueFrequency(propertyKey: string): boolean {
    const settings = this.getSettings();
    if (settings.valueSuggestionLegacyMigrationPending) {
      return false;
    }
    const normalizedKey = propertyKey.trim().toLocaleLowerCase();
    const assignment = settings.valueSuggestionPropertyAssignments.find(
      (candidate) => candidate.propertyKey.trim().toLocaleLowerCase() === normalizedKey,
    );
    const behavior = assignment?.behavior ?? settings.valueSuggestionDefaultBehavior;

    if (behavior === "frequency") {
      return true;
    }

    if (behavior !== "custom") {
      return false;
    }

    return settings.valueSuggestionCustomOrders.some(
      (order) =>
        order.propertyKey.trim().toLocaleLowerCase() === normalizedKey &&
        order.middleSortMode === "frequency",
    );
  }

  getPropertyValueFrequency(propertyKey: string) {
    return this.propertyValueFrequencyStore.getCounts(propertyKey);
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
    this.customFallbackSessions.clear();
    for (const targetDocument of Array.from(this.customFallbacks.keys())) {
      this.hideCustomFallback(targetDocument);
    }
    for (const container of Array.from(this.originalSuggestions.keys())) {
      this.runCleanup(() => this.restoreContainer(container));
    }
  }

  private restoreContainersForDocument(targetDocument: Document): void {
    this.customFallbackSessions.delete(targetDocument);
    this.hideCustomFallback(targetDocument);
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument) {
        this.runCleanup(() => this.restoreContainer(container));
      }
    }
  }

  private restoreContainer(container: HTMLElement): void {
    container.classList.remove(VALUE_SUGGESTIONS_SUPPRESSED_CLASS);
    this.removePluginPresetItems(container);
    const snapshot = this.originalSuggestions.get(container);

    if (snapshot == null) {
      delete container.dataset.propertyOrderValueEnhanced;
      delete container.dataset.propertyOrderValueSignature;
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

function getElementAtOrAboveNode(node: Node): HTMLElement | null {
  if (node.nodeType === 1) {
    return node as HTMLElement;
  }

  return node.parentElement;
}

function getPropertyValueSuggestionElements(container: HTMLElement): HTMLElement[] {
  return getPropertyValueSuggestionItems(container).map((item) => item.element);
}

function equalPropertyKey(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
