import {
  getSuggestionItems,
  hasActivePropertyKeySuggestionContext,
} from "../../obsidian/native-suggest-dom";

const SELECTED_SUGGESTION_CLASS = "is-selected";

interface SuggestionKeyboardBridgeOptions {
  getActiveContainer(): HTMLElement | null;
  onSynchronizationFailure(container: HTMLElement): void;
  supportsEmacsNavigation: boolean;
  targetWindow: Window;
}

export function registerSuggestionKeyboardBridge(
  options: SuggestionKeyboardBridgeOptions,
): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) {
      return;
    }

    const container = options.getActiveContainer();

    if (container == null || !hasActivePropertyKeySuggestionContext(container)) {
      return;
    }

    const visibleElements = getVisibleSuggestionElements(container);

    if (event.key === "Enter") {
      handleEnter(event, container, visibleElements, (failedContainer) => {
        options.onSynchronizationFailure(failedContainer);
      });
      return;
    }

    const navigation = getNavigationAction(event, options.supportsEmacsNavigation);

    if (navigation == null) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (visibleElements.length === 0) {
      return;
    }

    const currentIndex = getSelectedVisibleIndex(visibleElements);
    const targetIndex = getNavigationTargetIndex(
      navigation,
      currentIndex,
      visibleElements,
      container,
    );
    const targetElement = visibleElements[targetIndex];

    if (!requestNativeSelection(targetElement)) {
      options.onSynchronizationFailure(container);
    }
  };

  options.targetWindow.addEventListener("keydown", handleKeyDown, true);
  return () => options.targetWindow.removeEventListener("keydown", handleKeyDown, true);
}

export function synchronizeSuggestionSelection(
  container: HTMLElement,
  resetToFirstVisible: boolean,
): boolean {
  const visibleElements = getVisibleSuggestionElements(container);

  if (visibleElements.length === 0) {
    return true;
  }

  const selectedElement = getSelectedSuggestionElement(container);
  const targetElement =
    !resetToFirstVisible && selectedElement != null && visibleElements.includes(selectedElement)
      ? selectedElement
      : visibleElements[0];

  return targetElement.classList.contains(SELECTED_SUGGESTION_CLASS) ||
    requestNativeSelection(targetElement);
}

function handleEnter(
  event: KeyboardEvent,
  container: HTMLElement,
  visibleElements: HTMLElement[],
  onSynchronizationFailure: (container: HTMLElement) => void,
): void {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (visibleElements.length === 0) {
    return;
  }

  const selectedElement = getSelectedSuggestionElement(container);
  const targetElement =
    selectedElement != null && visibleElements.includes(selectedElement)
      ? selectedElement
      : visibleElements[0];

  if (!requestNativeSelection(targetElement)) {
    onSynchronizationFailure(container);
    return;
  }

  if (!activateSuggestion(targetElement)) {
    onSynchronizationFailure(container);
  }
}

type NavigationAction = "first" | "last" | "next" | "page-next" | "page-previous" | "previous";

function getNavigationAction(
  event: KeyboardEvent,
  supportsEmacsNavigation: boolean,
): NavigationAction | null {
  if (event.key === "ArrowDown" || event.key === "Down") {
    return "next";
  }

  if (event.key === "ArrowUp" || event.key === "Up") {
    return "previous";
  }

  if (event.key === "Home") {
    return "first";
  }

  if (event.key === "End") {
    return "last";
  }

  if (event.key === "PageDown" || event.key === "Next") {
    return "page-next";
  }

  if (event.key === "PageUp" || event.key === "Prior") {
    return "page-previous";
  }

  if (
    supportsEmacsNavigation &&
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    const normalizedKey = event.key.toLowerCase();

    if (normalizedKey === "n") {
      return "next";
    }

    if (normalizedKey === "p") {
      return "previous";
    }
  }

  return null;
}

function getNavigationTargetIndex(
  action: NavigationAction,
  currentIndex: number,
  visibleElements: HTMLElement[],
  container: HTMLElement,
): number {
  if (action === "first") {
    return 0;
  }

  if (action === "last") {
    return visibleElements.length - 1;
  }

  if (currentIndex < 0) {
    return action === "previous" || action === "page-previous"
      ? visibleElements.length - 1
      : 0;
  }

  if (action === "page-next" || action === "page-previous") {
    const pageSize = getVisiblePageSize(container, visibleElements[currentIndex]);
    const direction = action === "page-next" ? 1 : -1;
    return clamp(currentIndex + pageSize * direction, 0, visibleElements.length - 1);
  }

  const direction = action === "next" ? 1 : -1;
  return (currentIndex + direction + visibleElements.length) % visibleElements.length;
}

function getVisiblePageSize(container: HTMLElement, selectedElement: HTMLElement): number {
  const itemParent = selectedElement.parentElement;
  const viewportHeight = itemParent?.clientHeight ?? container.clientHeight;
  const rowHeight = selectedElement.getBoundingClientRect().height;

  if (viewportHeight <= 0 || rowHeight <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}

function requestNativeSelection(element: HTMLElement): boolean {
  for (const item of getSuggestionItems(element.closest<HTMLElement>(
    ".suggestion-container, .suggestion, .menu",
  ) ?? element).map((suggestion) => suggestion.element)) {
    item.classList.toggle(SELECTED_SUGGESTION_CLASS, item === element);
  }

  element.scrollIntoView?.({ block: "nearest" });
  return element.classList.contains(SELECTED_SUGGESTION_CLASS);
}

function activateSuggestion(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  element.click();
  return true;
}

function getVisibleSuggestionElements(container: HTMLElement): HTMLElement[] {
  return getSuggestionItems(container)
    .map((item) => item.element)
    .filter(
      (element) =>
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        !element.classList.contains("property-order-suggestion-hidden"),
    );
}

function getSelectedSuggestionElement(container: HTMLElement): HTMLElement | null {
  return getSuggestionItems(container)
    .map((item) => item.element)
    .find((element) => element.classList.contains(SELECTED_SUGGESTION_CLASS)) ?? null;
}

function getSelectedVisibleIndex(visibleElements: HTMLElement[]): number {
  return visibleElements.findIndex((element) =>
    element.classList.contains(SELECTED_SUGGESTION_CLASS),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
