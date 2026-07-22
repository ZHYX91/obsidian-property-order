import { Platform, type Plugin } from "obsidian";

import { orderPropertyKeys } from "../../core/suggestions/order-keys";
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
import type { PropertyKeyUsage, PropertyOrderSettings } from "../../shared/types";
import {
  registerSuggestionKeyboardBridge,
  synchronizeSuggestionSelection,
} from "./suggestion-keyboard-bridge";

const PLUGIN_HIDDEN_CLASS = "property-order-suggestion-hidden";
const OBSERVER_OPTIONS: MutationObserverInit = {
  attributeFilter: ["aria-hidden", "hidden"],
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
};

interface SuggestionElementSnapshot {
  ariaHiddenAttribute: string | null;
  element: HTMLElement;
  hadPluginHiddenClass: boolean;
  hiddenAttribute: string | null;
}

interface OriginalSuggestionSnapshot {
  appliedState: AppliedSuggestionState | null;
  childOrder: ChildNode[];
  elements: SuggestionElementSnapshot[];
  parent: HTMLElement;
}

interface AppliedSuggestionState {
  elements: SuggestionElementSnapshot[];
}

interface EnhancementCycle {
  containers: Set<HTMLElement>;
}

interface DocumentEnhancementState {
  forceEnhancement: boolean;
  keyboardCleanup: () => void;
  observer: MutationObserver;
  observing: boolean;
  pendingRoots: Set<ParentNode>;
  rafId: number | null;
  view: Window;
}

export class KeySuggestionOrderController {
  private readonly activeContainers = new Map<Document, HTMLElement>();
  private readonly documentStates = new Map<Document, DocumentEnhancementState>();
  private readonly originalSuggestions = new Map<
    HTMLElement,
    OriginalSuggestionSnapshot
  >();
  private initialized = false;
  private readonly plugin: Plugin;
  private readonly getSettings: () => PropertyOrderSettings;

  constructor(plugin: Plugin, getSettings: () => PropertyOrderSettings) {
    this.plugin = plugin;
    this.getSettings = getSettings;
  }

  initialize(): () => void {
    this.initialized = true;
    this.registerDocument(document);
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      this.registerDocument(leaf.view.containerEl.ownerDocument);
    });
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("window-open", (_workspaceWindow, targetWindow) => {
        this.registerDocument(targetWindow.document);
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("window-close", (_workspaceWindow, targetWindow) => {
        this.unregisterDocument(targetWindow.document);
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on("changed", () => {
        this.invalidateUsage();
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on("deleted", () => {
        this.invalidateUsage();
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on("resolved", () => {
        this.invalidateUsage();
      }),
    );

    return () => {
      this.initialized = false;

      for (const targetDocument of Array.from(this.documentStates.keys())) {
        this.unregisterDocument(targetDocument);
      }

      invalidatePropertyKeyUsage(this.plugin.app);
      this.restoreAllContainers();
    };
  }

  refresh(): void {
    const enabled = this.getSettings().enableNativeKeySuggestionOrder;

    for (const [targetDocument, state] of this.documentStates) {
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
    const keyboardCleanup = registerSuggestionKeyboardBridge({
      getActiveContainer: () => this.getActiveContainer(targetDocument),
      onSynchronizationFailure: (container) => this.restoreContainer(container),
      supportsEmacsNavigation: Platform.isMacOS || Platform.isIosApp,
      targetWindow,
    });
    const state: DocumentEnhancementState = {
      forceEnhancement: false,
      keyboardCleanup,
      observer,
      observing: false,
      pendingRoots: new Set(),
      rafId: null,
      view: targetWindow,
    };
    this.documentStates.set(targetDocument, state);

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
  }

  private unregisterDocument(targetDocument: Document): void {
    const state = this.documentStates.get(targetDocument);

    if (state == null) {
      return;
    }

    if (state.observing) {
      this.updateNativeSnapshots(targetDocument, state.observer.takeRecords());
    }

    state.observer.disconnect();
    state.observing = false;
    state.keyboardCleanup();
    state.pendingRoots.clear();

    if (state.rafId != null) {
      state.view.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    this.documentStates.delete(targetDocument);
    this.activeContainers.delete(targetDocument);
    this.restoreContainersForDocument(targetDocument);
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
        this.isSuggestionRelatedNode(targetDocument, mutationRoot, false);

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

    if (this.getSettings().keySuggestionSortMode === "usage") {
      this.refresh();
    }
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

    try {
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
        synchronizeSnapshotElements(container, snapshot);
      }
    }
  }

  private enhanceSuggestions(
    root: ParentNode,
    cycle: EnhancementCycle,
    force: boolean,
  ): void {
    const settings = this.getSettings();

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
    const structuralSignature = createStructuralSignature(
      settings,
      items.map((item) => item.key),
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
        hiddenPatterns: settings.hiddenPropertyKeyPatterns,
        pinnedKeys: settings.pinnedPropertyKeys,
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

    const visibleElements = orderedKeys
      .map((item) => elementsByKey.get(item.key)?.shift())
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
        item.element.classList.add(PLUGIN_HIDDEN_CLASS);
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

    container.dataset.propertyOrderEnhanced = "true";
    container.dataset.propertyOrderSignature = createStructuralSignature(
      settings,
      getSuggestionItems(container).map((item) => item.key),
    );
    snapshot.appliedState = createAppliedState(getSuggestionItems(container));
    this.activeContainers.set(container.ownerDocument, container);
  }

  private getCachedUsage(): PropertyKeyUsage[] {
    return getCachedPropertyKeyUsage(this.plugin.app);
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
      restoreSnapshot(existingSnapshot);
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
    return snapshot;
  }

  private restoreAllContainers(): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      this.restoreContainer(container);
    }
  }

  private restoreContainersForDocument(targetDocument: Document): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument) {
        this.restoreContainer(container);
      }
    }
  }

  private restoreDetachedContainers(targetDocument: Document): void {
    for (const container of Array.from(this.originalSuggestions.keys())) {
      if (container.ownerDocument === targetDocument && !container.isConnected) {
        this.restoreContainer(container);
      }
    }
  }

  private restoreContainer(container: HTMLElement): void {
    const snapshot = this.originalSuggestions.get(container);

    if (snapshot == null) {
      return;
    }

    restoreSnapshot(snapshot);
    delete container.dataset.propertyOrderEnhanced;
    delete container.dataset.propertyOrderSignature;
    this.originalSuggestions.delete(container);

    if (this.activeContainers.get(container.ownerDocument) === container) {
      this.activeContainers.delete(container.ownerDocument);
    }
  }

  private getActiveContainer(targetDocument: Document): HTMLElement | null {
    const container = this.activeContainers.get(targetDocument);

    if (
      container == null ||
      !container.isConnected ||
      container.dataset.propertyOrderEnhanced !== "true"
    ) {
      this.activeContainers.delete(targetDocument);
      return null;
    }

    return container;
  }
}

function createStructuralSignature(
  settings: PropertyOrderSettings,
  keys: string[],
): string {
  return JSON.stringify({
    bottom: settings.bottomPropertyKeys,
    hidden: settings.hiddenPropertyKeyPatterns,
    keys,
    pinned: settings.pinnedPropertyKeys,
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

function createAppliedState(items: SuggestionItem[]): AppliedSuggestionState {
  return {
    elements: items.map(({ element }) => createElementSnapshot(element)),
  };
}

function matchesAppliedState(
  appliedState: AppliedSuggestionState | null,
  items: SuggestionItem[],
): boolean {
  if (appliedState == null || appliedState.elements.length !== items.length) {
    return false;
  }

  return appliedState.elements.every((expected, index) => {
    const element = items[index]?.element;
    return (
      element === expected.element &&
      element.getAttribute("hidden") === expected.hiddenAttribute &&
      element.getAttribute("aria-hidden") === expected.ariaHiddenAttribute &&
      element.classList.contains(PLUGIN_HIDDEN_CLASS) ===
        expected.hadPluginHiddenClass
    );
  });
}

function restoreSnapshot(snapshot: OriginalSuggestionSnapshot): void {
  for (const elementSnapshot of snapshot.elements) {
    restoreElementState(elementSnapshot);
  }

  for (const child of snapshot.childOrder) {
    if (child.parentNode === snapshot.parent) {
      snapshot.parent.appendChild(child);
    }
  }
}

function applyNativeChildMutation(
  snapshot: OriginalSuggestionSnapshot,
  mutation: MutationRecord,
): void {
  const removedNodes = new Set(Array.from(mutation.removedNodes) as ChildNode[]);
  const addedNodes = Array.from(mutation.addedNodes) as ChildNode[];
  const addedNodeSet = new Set(addedNodes);
  const nextSibling = mutation.nextSibling as ChildNode | null;
  const previousSibling = mutation.previousSibling as ChildNode | null;

  snapshot.childOrder = snapshot.childOrder.filter(
    (child) => !removedNodes.has(child) && !addedNodeSet.has(child),
  );

  if (addedNodes.length === 0) {
    return;
  }

  let insertionIndex: number;

  if (nextSibling == null) {
    insertionIndex = snapshot.childOrder.length;
  } else {
    const nextSiblingIndex = snapshot.childOrder.indexOf(nextSibling);

    if (nextSiblingIndex >= 0) {
      insertionIndex = nextSiblingIndex;
    } else if (previousSibling == null) {
      insertionIndex = 0;
    } else {
      const previousSiblingIndex = snapshot.childOrder.indexOf(previousSibling);
      insertionIndex = previousSiblingIndex >= 0
        ? previousSiblingIndex + 1
        : snapshot.childOrder.length;
    }
  }

  snapshot.childOrder.splice(insertionIndex, 0, ...addedNodes);
}

function synchronizeSnapshotElements(
  container: HTMLElement,
  snapshot: OriginalSuggestionSnapshot,
): void {
  const currentElements = getSuggestionItems(container)
    .map((item) => item.element)
    .filter((element) => element.parentElement === snapshot.parent);
  const currentElementSet = new Set(currentElements);
  const snapshotsByElement = new Map(
    snapshot.elements.map((elementSnapshot) => [
      elementSnapshot.element,
      elementSnapshot,
    ]),
  );

  for (const elementSnapshot of snapshot.elements) {
    if (!currentElementSet.has(elementSnapshot.element)) {
      restoreElementState(elementSnapshot);
    }
  }

  snapshot.elements = currentElements.map(
    (element) => snapshotsByElement.get(element) ?? createElementSnapshot(element),
  );
}

function updateNativeAttributeSnapshot(
  snapshot: OriginalSuggestionSnapshot,
  mutation: MutationRecord,
): void {
  const elementSnapshot = snapshot.elements.find(
    ({ element }) => element === mutation.target,
  );

  if (elementSnapshot == null) {
    return;
  }

  if (mutation.attributeName === "hidden") {
    elementSnapshot.hiddenAttribute = elementSnapshot.element.getAttribute("hidden");
  } else if (mutation.attributeName === "aria-hidden") {
    elementSnapshot.ariaHiddenAttribute = elementSnapshot.element.getAttribute("aria-hidden");
  }
}

function createElementSnapshot(element: HTMLElement): SuggestionElementSnapshot {
  return {
    ariaHiddenAttribute: element.getAttribute("aria-hidden"),
    element,
    hadPluginHiddenClass: element.classList.contains(PLUGIN_HIDDEN_CLASS),
    hiddenAttribute: element.getAttribute("hidden"),
  };
}

function restoreElementState(snapshot: SuggestionElementSnapshot): void {
  restoreAttribute(snapshot.element, "hidden", snapshot.hiddenAttribute);
  restoreAttribute(snapshot.element, "aria-hidden", snapshot.ariaHiddenAttribute);
  snapshot.element.classList.toggle(
    PLUGIN_HIDDEN_CLASS,
    snapshot.hadPluginHiddenClass,
  );
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value == null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
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
