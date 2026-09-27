import { Scope, type Keymap } from "obsidian";

import { hasActivePropertyKeySuggestionContext } from "../../obsidian/native-suggest-dom";
import { isSuggestionElementVisible } from "./suggestion-visibility";

const SELECTED_SUGGESTION_CLASS = "is-selected";
type SuggestionActivation = "enter" | "tab";
type SuggestionElementResolver = (container: HTMLElement) => HTMLElement[];

interface SuggestionKeyboardBridgeOptions {
  keymap?: Keymap;
  parentScope?: Scope;
  getActiveContainer: () => HTMLElement | null;
  getSuggestionElements?: SuggestionElementResolver;
  hasActiveContext?: (container: HTMLElement) => boolean;
  onActivationIntent?: (
    element: HTMLElement,
    activation: SuggestionActivation,
    event: KeyboardEvent,
  ) => void;
  onEscapeIntent?: (event: KeyboardEvent) => void;
  onSynchronizationFailure: (container: HTMLElement) => void;
  supportsEmacsNavigation: boolean;
  targetWindow: Window;
}

export function registerSuggestionKeyboardBridge(
  options: SuggestionKeyboardBridgeOptions,
): (() => void) & { synchronizeScope(active: boolean): void } {
  const hasActiveContext =
    options.hasActiveContext ?? hasActivePropertyKeySuggestionContext;
  const getSuggestionElements =
    options.getSuggestionElements ?? getAllSuggestionElements;
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (Reflect.get(event, "propertyOrderPresetCommit") === true) {
      return;
    }

    if (event.isComposing) {
      return;
    }

    const container = options.getActiveContainer();

    if (container == null || !hasActiveContext(container)) {
      return;
    }

    const visibleElements = getVisibleSuggestionElements(
      container,
      getSuggestionElements,
    );

    if (event.key === "Tab") {
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const selectedElement = getSelectedSuggestionElement(
        container,
        getSuggestionElements,
      );

      if (selectedElement != null && visibleElements.includes(selectedElement)) {
        notifyActivationIntent(
          options.onActivationIntent,
          selectedElement,
          "tab",
          event,
        );

        if (options.keymap != null || selectedElement.dataset.propertyOrderPresetValue === "true") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!activateSuggestion(selectedElement)) {
            options.onSynchronizationFailure(container);
          }
        }
      }

      return;
    }

    if (event.key === "Enter") {
      handleEnter(
        event,
        container,
        visibleElements,
        options.onActivationIntent,
        getSuggestionElements,
        (failedContainer) => {
          options.onSynchronizationFailure(failedContainer);
        },
      );
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

    if (!requestNativeSelection(targetElement, getSuggestionElements)) {
      options.onSynchronizationFailure(container);
    }
  };

  options.targetWindow.addEventListener("keydown", handleKeyDown, true);
  let scopeActive = false;
  const scope = options.keymap == null ? null : new Scope(options.parentScope);
  const releaseScope = (): void => {
    if (scope != null && scopeActive) options.keymap?.popScope(scope);
    scopeActive = false;
  };
  scope?.register(null, null, (event) => {
    // Obsidian's keymap captures before DOM listeners. Own the active popup's
    // scope so native internal selection cannot commit a different visible row.
    if (Reflect.get(event, "propertyOrderPresetCommit") === true) return true;
    if (event.isComposing) return true;
    if (event.key === "Escape") {
      notifyEscapeIntent(options.onEscapeIntent, event);
      releaseScope();
      const target = event.target;
      const view = options.targetWindow.document.defaultView;
      if (view != null && target instanceof view.HTMLElement) {
        target.dispatchEvent(new view.KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, key: "Escape", code: "Escape",
        }));
      }
      return false;
    }
    if (event.key !== "Enter" && event.key !== "Tab" &&
      getNavigationAction(event, options.supportsEmacsNavigation) == null) return;
    handleKeyDown(event);
    // No active container includes `none`: let the native editor accept typed
    // text without falling through to the hidden native suggestion scope.
    return !event.defaultPrevented;
  });
  return Object.assign(() => {
    releaseScope();
    options.targetWindow.removeEventListener("keydown", handleKeyDown, true);
  }, {
    synchronizeScope(active: boolean): void {
      releaseScope();
      if (active && scope != null) {
        options.keymap?.pushScope(scope);
        scopeActive = true;
      }
    },
  });
}

export function synchronizeSuggestionSelection(
  container: HTMLElement,
  resetToFirstVisible: boolean,
  getSuggestionElements: SuggestionElementResolver = getAllSuggestionElements,
): boolean {
  const visibleElements = getVisibleSuggestionElements(
    container,
    getSuggestionElements,
  );

  if (visibleElements.length === 0) {
    return true;
  }

  const selectedElement = getSelectedSuggestionElement(
    container,
    getSuggestionElements,
  );
  const targetElement =
    !resetToFirstVisible && selectedElement != null && visibleElements.includes(selectedElement)
      ? selectedElement
      : visibleElements[0];

  return targetElement.classList.contains(SELECTED_SUGGESTION_CLASS) ||
    requestNativeSelection(targetElement, getSuggestionElements);
}

function handleEnter(
  event: KeyboardEvent,
  container: HTMLElement,
  visibleElements: HTMLElement[],
  onActivationIntent: ((
    element: HTMLElement,
    activation: SuggestionActivation,
    event: KeyboardEvent,
  ) => void) | undefined,
  getSuggestionElements: SuggestionElementResolver,
  onSynchronizationFailure: (container: HTMLElement) => void,
): void {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (visibleElements.length === 0) {
    return;
  }

  const selectedElement = getSelectedSuggestionElement(
    container,
    getSuggestionElements,
  );
  const targetElement =
    selectedElement != null && visibleElements.includes(selectedElement)
      ? selectedElement
      : visibleElements[0];

  if (!requestNativeSelection(targetElement, getSuggestionElements)) {
    onSynchronizationFailure(container);
    return;
  }

  notifyActivationIntent(onActivationIntent, targetElement, "enter", event);

  if (!activateSuggestion(targetElement)) {
    onSynchronizationFailure(container);
  }
}

function notifyActivationIntent(
  onActivationIntent: ((
    element: HTMLElement,
    activation: SuggestionActivation,
    event: KeyboardEvent,
  ) => void) | undefined,
  element: HTMLElement,
  activation: SuggestionActivation,
  event: KeyboardEvent,
): void {
  try {
    onActivationIntent?.(element, activation, event);
  } catch (error) {
    console.error("Property Order: failed to capture a suggestion activation", error);
  }
}

function notifyEscapeIntent(
  onEscapeIntent: ((event: KeyboardEvent) => void) | undefined,
  event: KeyboardEvent,
): void {
  try {
    onEscapeIntent?.(event);
  } catch (error) {
    console.error("Property Order: failed to capture a suggestion Escape", error);
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

function requestNativeSelection(
  element: HTMLElement,
  getSuggestionElements: SuggestionElementResolver,
): boolean {
  const container = element.closest<HTMLElement>(
    ".suggestion-container, .suggestion, .menu",
  ) ?? element;
  for (const item of getSuggestionElements(container)) {
    item.classList.toggle(SELECTED_SUGGESTION_CLASS, item === element);
  }

  element.scrollIntoView?.({ block: "nearest" });
  return element.classList.contains(SELECTED_SUGGESTION_CLASS);
}

function activateSuggestion(element: HTMLElement): boolean {
  if (!element.isConnected || !isSuggestionElementVisible(element)) {
    return false;
  }

  element.click();
  return true;
}

function getVisibleSuggestionElements(
  container: HTMLElement,
  getSuggestionElements: SuggestionElementResolver,
): HTMLElement[] {
  return getSuggestionElements(container).filter(isSuggestionElementVisible);
}

function getSelectedSuggestionElement(
  container: HTMLElement,
  getSuggestionElements: SuggestionElementResolver,
): HTMLElement | null {
  return getSuggestionElements(container)
    .find((element) => element.classList.contains(SELECTED_SUGGESTION_CLASS)) ?? null;
}

function getAllSuggestionElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(".suggestion-item, .menu-item"),
  );
}

function getSelectedVisibleIndex(visibleElements: HTMLElement[]): number {
  return visibleElements.findIndex((element) =>
    element.classList.contains(SELECTED_SUGGESTION_CLASS),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
