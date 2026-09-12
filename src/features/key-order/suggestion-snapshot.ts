import { getSuggestionItems, type SuggestionItem } from "../../obsidian/native-suggest-dom";
import { PLUGIN_HIDDEN_SUGGESTION_CLASS } from "./suggestion-visibility";

export interface SuggestionElementSnapshot {
  ariaHiddenAttribute: string | null;
  element: HTMLElement;
  hadPluginHiddenClass: boolean;
  hadSelectedClass: boolean;
  hiddenAttribute: string | null;
}

export interface OriginalSuggestionSnapshot {
  appliedState: AppliedSuggestionState | null;
  childOrder: ChildNode[];
  elements: SuggestionElementSnapshot[];
  parent: HTMLElement;
}

export interface AppliedSuggestionState {
  elements: SuggestionElementSnapshot[];
}

export function createAppliedState(items: SuggestionItem[]): AppliedSuggestionState {
  return {
    elements: items.map(({ element }) => createElementSnapshot(element)),
  };
}

export function matchesAppliedState(
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
      element.classList.contains(PLUGIN_HIDDEN_SUGGESTION_CLASS) ===
        expected.hadPluginHiddenClass
    );
  });
}

export function restoreSnapshot(snapshot: OriginalSuggestionSnapshot): void {
  for (const elementSnapshot of snapshot.elements) {
    restoreElementState(elementSnapshot);
    elementSnapshot.element.classList.toggle(
      "is-selected",
      elementSnapshot.hadSelectedClass,
    );
  }

  for (const child of snapshot.childOrder) {
    if (child.parentNode === snapshot.parent) {
      snapshot.parent.appendChild(child);
    }
  }
}

export function applyNativeChildMutation(
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

export function synchronizeSnapshotElements(
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

export function updateNativeAttributeSnapshot(
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

export function createElementSnapshot(element: HTMLElement): SuggestionElementSnapshot {
  return {
    ariaHiddenAttribute: element.getAttribute("aria-hidden"),
    element,
    hadPluginHiddenClass: element.classList.contains(PLUGIN_HIDDEN_SUGGESTION_CLASS),
    hadSelectedClass: element.classList.contains("is-selected"),
    hiddenAttribute: element.getAttribute("hidden"),
  };
}

export function restoreElementState(snapshot: SuggestionElementSnapshot): void {
  restoreAttribute(snapshot.element, "hidden", snapshot.hiddenAttribute);
  restoreAttribute(snapshot.element, "aria-hidden", snapshot.ariaHiddenAttribute);
  snapshot.element.classList.toggle(
    PLUGIN_HIDDEN_SUGGESTION_CLASS,
    snapshot.hadPluginHiddenClass,
  );
}

export function restoreAttribute(
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

