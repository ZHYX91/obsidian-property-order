export interface PropertyContainerContext {
  container: HTMLElement;
  pills: HTMLElement[];
  propertyElement: HTMLElement;
  propertyKey: string;
}

export interface PropertyPillContext {
  container: HTMLElement;
  pill: HTMLElement;
  pills: HTMLElement[];
  propertyElement: HTMLElement;
  propertyKey: string;
  sourceIndex: number;
}

const METADATA_CONTAINER_SELECTOR = ".metadata-container";
const PROPERTY_CONTAINER_SELECTOR = ".multi-select-container";
const PROPERTY_ELEMENT_SELECTOR = ".metadata-property";
const PROPERTY_PILL_SELECTOR = ".multi-select-pill";
const PROPERTY_PILL_INTERACTIVE_SELECTOR = "button, input, textarea";

const PROPERTY_KEY_SELECTORS = [
  ".metadata-property-key input",
  ".metadata-property-key textarea",
  ".metadata-property-key .metadata-input",
  ".metadata-property-key",
  ".metadata-property-name",
];

export function resolvePropertyPillContext(pill: HTMLElement): PropertyPillContext | null {
  const container = pill.closest<HTMLElement>(PROPERTY_CONTAINER_SELECTOR);

  if (container == null) {
    return null;
  }

  const containerContext = resolvePropertyContainerContext(container);

  if (containerContext == null) {
    return null;
  }

  const { pills } = containerContext;
  const sourceIndex = pills.indexOf(pill);

  if (sourceIndex === -1) {
    return null;
  }

  return {
    ...containerContext,
    pill,
    sourceIndex,
  };
}

export function resolvePropertyContainerContext(
  container: HTMLElement,
): PropertyContainerContext | null {
  const propertyElement = container.closest<HTMLElement>(PROPERTY_ELEMENT_SELECTOR);

  if (
    propertyElement == null ||
    propertyElement.closest(METADATA_CONTAINER_SELECTOR) == null
  ) {
    return null;
  }

  const pills = getContainerPills(container);
  const propertyKey = resolvePropertyKey(propertyElement);

  if (propertyKey == null) {
    return null;
  }

  return {
    container,
    pills,
    propertyElement,
    propertyKey,
  };
}

export function getContainerPills(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(PROPERTY_PILL_SELECTOR)).filter(
    (pill) => pill.closest(PROPERTY_CONTAINER_SELECTOR) === container,
  );
}

export function resolveDraggablePropertyPill(target: EventTarget | null): HTMLElement | null {
  const targetElement = asElement(target);

  if (
    targetElement == null ||
    targetElement.closest(PROPERTY_PILL_INTERACTIVE_SELECTOR) != null
  ) {
    return null;
  }

  const pill = targetElement.closest<HTMLElement>(PROPERTY_PILL_SELECTOR);
  return pill?.closest(METADATA_CONTAINER_SELECTOR) == null ? null : pill;
}

export function isPropertyPillTarget(target: EventTarget | null): boolean {
  const targetElement = asElement(target);
  const pill = targetElement?.closest<HTMLElement>(PROPERTY_PILL_SELECTOR);
  return pill?.closest(METADATA_CONTAINER_SELECTOR) != null;
}

export function isPropertyPillElement(element: Element): boolean {
  return element.matches(PROPERTY_PILL_SELECTOR);
}

export function findPropertyContainerAtPoint(
  clientX: number,
  clientY: number,
  targetDocument: Document,
): HTMLElement | null {
  const targetElement = targetDocument.elementFromPoint(clientX, clientY);
  const directContainer = targetElement?.closest<HTMLElement>(PROPERTY_CONTAINER_SELECTOR);

  if (directContainer?.closest(METADATA_CONTAINER_SELECTOR) != null) {
    return directContainer;
  }

  const candidates = targetDocument.querySelectorAll<HTMLElement>(
    `${METADATA_CONTAINER_SELECTOR} ${PROPERTY_CONTAINER_SELECTOR}`,
  );
  return (
    Array.from(candidates).find((container) =>
      isPointInsideRect(clientX, clientY, container.getBoundingClientRect()),
    ) ?? null
  );
}

function asElement(target: EventTarget | null): Element | null {
  return target != null && typeof (target as Element).closest === "function"
    ? (target as Element)
    : null;
}

function resolvePropertyKey(propertyElement: HTMLElement): string | null {
  const attributeCandidates = [
    propertyElement.getAttribute("data-property-key"),
    propertyElement.dataset.propertyKey,
  ];

  for (const candidate of attributeCandidates) {
    const normalizedCandidate = normalizePropertyKey(candidate, true);

    if (normalizedCandidate != null) {
      return normalizedCandidate;
    }
  }

  for (const selector of PROPERTY_KEY_SELECTORS) {
    const element = propertyElement.querySelector<HTMLElement | HTMLInputElement | HTMLTextAreaElement>(
      selector,
    );

    if (element == null) {
      continue;
    }

    const isValueElement = "value" in element && typeof element.value === "string";
    const valueCandidate = isValueElement ? element.value : element.textContent;
    const normalizedCandidate = normalizePropertyKey(valueCandidate, isValueElement);

    if (normalizedCandidate != null) {
      return normalizedCandidate;
    }
  }

  const fallbackLabel = propertyElement.getAttribute("aria-label");
  return normalizePropertyKey(fallbackLabel);
}

function normalizePropertyKey(
  candidate: string | null | undefined,
  preserveEdgeWhitespace = false,
): string | null {
  if (candidate == null || candidate.trim().length === 0) {
    return null;
  }

  return preserveEdgeWhitespace ? candidate : candidate.trim();
}

function isPointInsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
