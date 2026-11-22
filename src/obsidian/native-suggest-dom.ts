import { trimPropertyKey } from "../core/suggestions/property-names";
import { resolvePropertyKey } from "./properties-dom";
import { isSuggestionElementVisible } from "./suggestion-visibility";

export interface SuggestionItem {
  element: HTMLElement;
  key: string;
}

export interface PropertyValueSuggestionContext {
  editor: HTMLElement;
  propertyKey: string;
  row: HTMLElement;
}

const SUGGESTION_CONTAINER_SELECTORS = [
  ".suggestion-container",
  ".suggestion",
  ".menu",
];

const SUGGESTION_ITEM_SELECTORS = [
  ".suggestion-item",
  ".menu-item",
];

const PROPERTY_KEY_EDITOR_SELECTOR = ".metadata-property-key";
const PROPERTY_VALUE_EDITOR_SELECTOR = ".metadata-property-value";
const PROPERTY_ROW_SELECTOR = ".metadata-property[data-property-key]";
const PROPERTY_KEY_SUGGESTION_SELECTOR =
  ".suggestion-container.mod-property-key, .suggestion.mod-property-key, .menu.mod-property-key";
const PROPERTY_ORDER_CUSTOM_VALUE_POPUP_SELECTOR =
  ".property-order-custom-value-popup";

const SUGGESTION_CONTAINER_SELECTOR = SUGGESTION_CONTAINER_SELECTORS.join(", ");

export function findSuggestionContainers(root: ParentNode = document): HTMLElement[] {
  const rootElement = asHtmlElement(root);
  const closestContainer = asHtmlElement(
    rootElement?.closest(SUGGESTION_CONTAINER_SELECTOR),
  );
  const descendants = SUGGESTION_CONTAINER_SELECTORS.flatMap((selector) =>
    Array.from(root.querySelectorAll<HTMLElement>(selector)),
  );

  return [...(closestContainer == null ? [] : [closestContainer]), ...descendants].filter(
    (container, index, containers) => containers.indexOf(container) === index,
  );
}

export function getSuggestionItems(container: HTMLElement): SuggestionItem[] {
  return getSuggestionItemsWithExtractor(container, extractSuggestionText);
}

export function getPropertyValueSuggestionItems(
  container: HTMLElement,
): SuggestionItem[] {
  return getSuggestionItemsWithExtractor(
    container,
    extractPropertyValueSuggestionText,
  );
}

export function getSuggestionItemParent(items: SuggestionItem[]): HTMLElement | null {
  const firstParent = items[0]?.element.parentElement ?? null;
  return firstParent != null && items.every((item) => item.element.parentElement === firstParent)
    ? firstParent
    : null;
}

export function isLikelyPropertyKeySuggestionContainer(
  container: HTMLElement,
  items = getSuggestionItems(container),
): boolean {
  if (items.length < 2) {
    return false;
  }

  const focusedEditor = container.ownerDocument.activeElement?.closest<HTMLElement>(PROPERTY_KEY_EDITOR_SELECTOR);
  return focusedEditor != null
    ? findOwnedNativePopup(focusedEditor, "key") === container
    : container.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null;
}

export function isPropertyKeySuggestionContainer(
  container: HTMLElement,
  items = getSuggestionItems(container),
): boolean {
  if (container.matches(PROPERTY_KEY_SUGGESTION_SELECTOR)) {
    const focusedEditor = container.ownerDocument.activeElement?.closest<HTMLElement>(PROPERTY_KEY_EDITOR_SELECTOR);
    return focusedEditor == null || findOwnedNativePopup(focusedEditor, "key") === container;
  }
  return isLikelyPropertyKeySuggestionContainer(container, items);
}

export function getActivePropertyValueSuggestionContext(
  targetDocument: Document,
): PropertyValueSuggestionContext | null {
  const activeElement = asHtmlElement(targetDocument.activeElement);
  const editor = activeElement?.closest<HTMLElement>(PROPERTY_VALUE_EDITOR_SELECTOR) ?? null;
  const row = editor?.closest<HTMLElement>(PROPERTY_ROW_SELECTOR) ?? null;
  const propertyKey = row == null ? null : resolvePropertyKey(row);

  if (editor == null || row == null || propertyKey == null) {
    return null;
  }

  return { editor, propertyKey, row };
}

export function getPropertyValueSuggestionContext(
  container: HTMLElement,
): PropertyValueSuggestionContext | null {
  const context = getActivePropertyValueSuggestionContext(container.ownerDocument);
  if (context == null) return null;
  if (container.matches(PROPERTY_ORDER_CUSTOM_VALUE_POPUP_SELECTOR)) {
    const active = container.ownerDocument.activeElement;
    return container.id && active?.getAttribute("aria-controls")?.split(/\s+/).includes(container.id) &&
      !findNativeValuePopups(container.ownerDocument).some(isSuggestionElementVisible) ? context : null;
  }
  return findOwnedNativePopup(context.editor, "value") === container ? context : null;
}

export function isPropertyValueSuggestionContainer(
  container: HTMLElement,
  items = getPropertyValueSuggestionItems(container),
): boolean {
  return (
    resolvePropertyValueSuggestionContainer(container) === container &&
    items.length > 0 &&
    getPropertyValueSuggestionContext(container) != null
  );
}

export function hasActivePropertyValueSuggestionContext(
  container: HTMLElement,
): boolean {
  return getPropertyValueSuggestionContext(container) != null;
}

export function resolveSuggestionContainer(
  candidate: HTMLElement,
): HTMLElement | null {
  const dedicatedContainer = candidate.closest<HTMLElement>(
    PROPERTY_KEY_SUGGESTION_SELECTOR,
  );

  if (dedicatedContainer != null) {
    return dedicatedContainer;
  }

  const suggestionContainer = candidate.closest<HTMLElement>(
    ".suggestion-container",
  );

  if (suggestionContainer != null) {
    return suggestionContainer;
  }

  return candidate.matches(".suggestion") ? candidate : null;
}

export function resolvePropertyValueSuggestionContainer(
  candidate: HTMLElement,
): HTMLElement | null {
  // Plugin-owned custom fallback popups are managed by the value controller
  // directly and must never be mistaken for a native Obsidian popup.
  if (candidate.closest(PROPERTY_ORDER_CUSTOM_VALUE_POPUP_SELECTOR) != null) {
    return null;
  }

  // Context menus contain actions, not property values. Always use the outer
  // popup so its nested .suggestion list has only one lifecycle owner.
  if (candidate.closest(".menu") != null) {
    return null;
  }

  return candidate.closest<HTMLElement>(".suggestion-container");
}

export function hasPropertyKeySuggestionContext(
  container: HTMLElement,
): boolean {
  return (
    container.matches(PROPERTY_KEY_SUGGESTION_SELECTOR) ||
    container.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null ||
    container.ownerDocument.activeElement?.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null
  );
}

export function hasActivePropertyKeySuggestionContext(
  container: HTMLElement,
): boolean {
  const editor = container.ownerDocument.activeElement?.closest<HTMLElement>(PROPERTY_KEY_EDITOR_SELECTOR);
  return editor != null && findOwnedNativePopup(editor, "key") === container;
}

export function findNativeValuePopups(targetDocument: Document): HTMLElement[] {
  return Array.from(targetDocument.querySelectorAll<HTMLElement>(".suggestion-container")).filter(
    (popup) => resolvePropertyValueSuggestionContainer(popup) === popup &&
      !popup.matches(PROPERTY_KEY_SUGGESTION_SELECTOR) && popup.closest(PROPERTY_KEY_EDITOR_SELECTOR) == null &&
      popup.querySelector(".suggestion-item, .menu-item") != null,
  );
}

// Obsidian portals popups to the window body. Use explicit control relationships
// or structural ownership first. An unlabelled portal is usable only on its own.
function findOwnedNativePopup(editor: HTMLElement, kind: "key" | "value"): HTMLElement | null {
  const doc = editor.ownerDocument;
  const active = doc.activeElement;
  const candidates = kind === "value" ? findNativeValuePopups(doc) :
    Array.from(new Set(findSuggestionContainers(doc).map(resolveSuggestionContainer)))
      .filter((popup): popup is HTMLElement => popup != null &&
        popup.closest(PROPERTY_ORDER_CUSTOM_VALUE_POPUP_SELECTOR) == null &&
        popup.closest(PROPERTY_VALUE_EDITOR_SELECTOR) == null &&
        popup.querySelector(".suggestion-item, .menu-item") != null);
  const viable = new Set(candidates.filter(isSuggestionElementVisible));
  if (!viable.size) return null;

  const linked = new Set<HTMLElement>();
  let expectsPopup = false;
  for (const control of Array.from(doc.querySelectorAll<HTMLElement>("[aria-controls], [aria-owns]"))) {
    const ownControl = control.contains(active) && (editor.contains(control) ||
      (control.matches('[role="combobox"]') && control.contains(editor)));
    const ids = [control.getAttribute("aria-controls"), control.getAttribute("aria-owns")].join(" ");
    for (const id of ids.split(/[ \t\r\n\f]+/).filter(Boolean)) {
      const targets = doc.querySelectorAll<HTMLElement>("#" + CSS.escape(id));
      if (targets.length === 1 && targets[0].closest(PROPERTY_ORDER_CUSTOM_VALUE_POPUP_SELECTOR)) continue;
      if (ownControl) {
        expectsPopup = true;
        if (targets.length > 1) return null;
      }
      for (const target of Array.from(targets)) {
        const popup = candidates.find((candidate) => candidate.contains(target));
        if (!popup) continue;
        if (ownControl) linked.add(popup);
        else viable.delete(popup);
      }
    }
  }
  const nested: HTMLElement[] = [];
  const portals: HTMLElement[] = [];
  for (const popup of viable) {
    const containingEditor = popup.closest(PROPERTY_KEY_EDITOR_SELECTOR + ", " + PROPERTY_VALUE_EDITOR_SELECTOR);
    if (containingEditor != null && containingEditor !== editor) continue;
    if (expectsPopup && !linked.has(popup)) continue;
    if (containingEditor === editor) nested.push(popup);
    else portals.push(popup);
  }
  const matches = !expectsPopup && nested.length ? nested : [...nested, ...portals];
  return matches.length === 1 ? matches[0] : null;
}

function getSuggestionItemsWithExtractor(
  container: HTMLElement,
  extractKey: (element: HTMLElement) => string,
): SuggestionItem[] {
  const itemElements = SUGGESTION_ITEM_SELECTORS.flatMap((selector) =>
    Array.from(container.querySelectorAll<HTMLElement>(selector)),
  ).filter((element, index, elements) => elements.indexOf(element) === index);

  return itemElements
    .map((element) => ({ element, key: extractKey(element) }))
    .filter((item) => item.key.length > 0);
}

function extractSuggestionText(element: HTMLElement): string {
  return trimPropertyKey(extractSuggestionTextElement(element));
}

function extractPropertyValueSuggestionText(element: HTMLElement): string {
  return extractSuggestionTextElement(element);
}

function extractSuggestionTextElement(element: HTMLElement): string {
  const textElement =
    element.querySelector<HTMLElement>(".suggestion-title") ??
    element.querySelector<HTMLElement>(".menu-item-title") ??
    element;
  return textElement.textContent ?? "";
}

function asHtmlElement(value: unknown): HTMLElement | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HTMLElement>;
  return candidate.nodeType === 1 && typeof candidate.matches === "function"
    ? (candidate as HTMLElement)
    : null;
}
