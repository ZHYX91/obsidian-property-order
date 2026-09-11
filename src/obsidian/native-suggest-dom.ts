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
  const itemElements = SUGGESTION_ITEM_SELECTORS.flatMap((selector) =>
    Array.from(container.querySelectorAll<HTMLElement>(selector)),
  ).filter((element, index, elements) => elements.indexOf(element) === index);

  return itemElements
    .map((element) => ({ element, key: extractSuggestionText(element) }))
    .filter((item) => item.key.length > 0);
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

  const activeElement = asHtmlElement(container.ownerDocument.activeElement);

  return (
    activeElement?.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null ||
    container.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null
  );
}

export function isPropertyKeySuggestionContainer(
  container: HTMLElement,
  items = getSuggestionItems(container),
): boolean {
  return (
    container.matches(PROPERTY_KEY_SUGGESTION_SELECTOR) ||
    isLikelyPropertyKeySuggestionContainer(container, items)
  );
}

export function getPropertyValueSuggestionContext(
  container: HTMLElement,
): PropertyValueSuggestionContext | null {
  const activeElement = asHtmlElement(container.ownerDocument.activeElement);
  const editor = activeElement?.closest<HTMLElement>(PROPERTY_VALUE_EDITOR_SELECTOR) ?? null;
  const row = editor?.closest<HTMLElement>(PROPERTY_ROW_SELECTOR) ?? null;
  const propertyKey = row?.getAttribute("data-property-key")?.trim() ?? "";

  if (editor == null || row == null || propertyKey.length === 0) {
    return null;
  }

  return { editor, propertyKey, row };
}

export function isPropertyValueSuggestionContainer(
  container: HTMLElement,
  items = getSuggestionItems(container),
): boolean {
  return (
    items.length > 0 &&
    !isPropertyKeySuggestionContainer(container, items) &&
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

  return candidate.closest<HTMLElement>(SUGGESTION_CONTAINER_SELECTOR);
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
  const activeElement = container.ownerDocument.activeElement;
  const containingEditor = container.closest<HTMLElement>(
    PROPERTY_KEY_EDITOR_SELECTOR,
  );

  if (containingEditor != null) {
    return activeElement != null &&
      (activeElement === containingEditor || containingEditor.contains(activeElement));
  }

  return activeElement?.closest(PROPERTY_KEY_EDITOR_SELECTOR) != null;
}

function extractSuggestionText(element: HTMLElement): string {
  const textElement =
    element.querySelector<HTMLElement>(".suggestion-title") ??
    element.querySelector<HTMLElement>(".menu-item-title") ??
    element;
  return (textElement.textContent ?? "").trim();
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
