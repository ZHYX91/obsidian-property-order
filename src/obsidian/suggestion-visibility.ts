export const PLUGIN_HIDDEN_SUGGESTION_CLASS = "property-order-suggestion-hidden";

export function isSuggestionElementVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current != null; current = current.parentElement) {
    if (
      current.hidden ||
      current.getAttribute("aria-hidden") === "true" ||
      current.classList.contains(PLUGIN_HIDDEN_SUGGESTION_CLASS)
    ) {
      return false;
    }

    const targetWindow = current.ownerDocument.defaultView;
    if (targetWindow == null) {
      continue;
    }

    const style = targetWindow.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }
  }

  return true;
}
