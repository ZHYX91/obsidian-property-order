export const PLUGIN_HIDDEN_SUGGESTION_CLASS = "property-order-suggestion-hidden";

export function isSuggestionElementVisible(element: HTMLElement): boolean {
  return (
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    !element.classList.contains(PLUGIN_HIDDEN_SUGGESTION_CLASS)
  );
}
