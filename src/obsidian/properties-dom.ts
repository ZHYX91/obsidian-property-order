export interface PropertyContainerContext {
  container: HTMLElement;
  editorKind: "list-type-mismatch" | "multi-select";
  pills: HTMLElement[];
  propertyElement: HTMLElement;
  propertyKey: string;
}

export interface PropertyPillContext extends PropertyContainerContext {
  pill: HTMLElement;
  sourceIndex: number;
}

export interface PropertyElementContext {
  propertyElement: HTMLElement;
  propertyKey: string;
}

export type NativePropertyTypeEvidence = "list" | "non-list" | "unknown";

const METADATA_CONTAINER_SELECTOR = ".metadata-container";
const PROPERTY_CONTAINER_SELECTOR = ".multi-select-container";
const PROPERTY_ELEMENT_SELECTOR = ".metadata-property";
const PROPERTY_ICON_SELECTOR = ".metadata-property-icon";
const PROPERTY_PILL_SELECTOR = ".multi-select-pill";
const PROPERTY_PILL_INTERACTIVE_SELECTOR = "button, input, textarea";
const PROPERTY_VALUE_SELECTOR = ".metadata-property-value";
const PROPERTY_WARNING_SELECTOR = ".metadata-property-warning-icon";

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
    const propertyElement = pill.closest<HTMLElement>(PROPERTY_ELEMENT_SELECTOR);
    const mismatchContext =
      propertyElement == null ? null : resolveListTypeMismatchContext(propertyElement);

    if (mismatchContext == null || mismatchContext.container !== pill) {
      return null;
    }

    return {
      ...mismatchContext,
      pill,
      pills: [pill],
      sourceIndex: 0,
    };
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
    editorKind: "multi-select",
    pills,
    propertyElement,
    propertyKey,
  };
}

export function resolveListTypeMismatchContext(
  propertyElement: HTMLElement,
): PropertyContainerContext | null {
  const propertyContext = resolvePropertyElementContext(propertyElement);
  const valueElement = propertyElement.querySelector<HTMLElement>(PROPERTY_VALUE_SELECTOR);

  if (
    propertyContext == null ||
    valueElement == null ||
    valueElement.querySelector(PROPERTY_CONTAINER_SELECTOR) != null ||
    propertyElement.querySelector(PROPERTY_WARNING_SELECTOR) == null ||
    !hasNativeListTypeEvidence(propertyElement)
  ) {
    return null;
  }

  return {
    container: valueElement,
    editorKind: "list-type-mismatch",
    pills: [],
    propertyElement,
    propertyKey: propertyContext.propertyKey,
  };
}

export function resolvePropertyElementListContext(
  propertyElement: HTMLElement,
): PropertyContainerContext | null {
  const container = propertyElement.querySelector<HTMLElement>(PROPERTY_CONTAINER_SELECTOR);
  return container == null
    ? resolveListTypeMismatchContext(propertyElement)
    : resolvePropertyContainerContext(container);
}

export function resolvePropertyElementContext(
  propertyElement: HTMLElement,
): PropertyElementContext | null {
  if (
    !propertyElement.matches(PROPERTY_ELEMENT_SELECTOR) ||
    propertyElement.closest(METADATA_CONTAINER_SELECTOR) == null
  ) {
    return null;
  }

  const propertyKey = resolvePropertyKey(propertyElement);
  return propertyKey == null ? null : { propertyElement, propertyKey };
}

export function getContainerPills(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(PROPERTY_PILL_SELECTOR)).filter(
    (pill) => pill.closest(PROPERTY_CONTAINER_SELECTOR) === container,
  );
}

export function getPropertyPillDisplayValues(
  context: PropertyContainerContext,
): readonly string[] | null {
  if (context.editorKind !== "multi-select") {
    return null;
  }

  return context.pills.map((pill) => (pill.textContent ?? "").trim());
}

export function getListTypeMismatchDisplayValue(
  context: PropertyContainerContext,
): string | null {
  if (context.editorKind !== "list-type-mismatch") {
    return null;
  }

  const input = context.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );

  if (input != null) {
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      return input.checked ? "true" : "false";
    }

    return input.value;
  }

  const editable = context.container.querySelector<HTMLElement>('[contenteditable="true"]');

  if (editable != null) {
    return (editable.textContent ?? "").trim();
  }

  const unknownValue = context.container.querySelector<HTMLElement>(
    ".metadata-property-value-item.mod-unknown",
  );
  return unknownValue == null ? null : (unknownValue.textContent ?? "").trim();
}

export function resolveDraggablePropertyPill(target: EventTarget | null): HTMLElement | null {
  const targetElement = asElement(target);

  if (targetElement == null) {
    return null;
  }

  const pill = targetElement.closest<HTMLElement>(PROPERTY_PILL_SELECTOR);

  if (
    pill != null &&
    pill.closest(METADATA_CONTAINER_SELECTOR) != null &&
    targetElement.closest(PROPERTY_PILL_INTERACTIVE_SELECTOR) == null
  ) {
    return pill;
  }

  if (targetElement.closest(PROPERTY_WARNING_SELECTOR) != null) {
    return null;
  }

  const propertyElement = targetElement.closest<HTMLElement>(PROPERTY_ELEMENT_SELECTOR);
  const mismatchContext =
    propertyElement == null ? null : resolveListTypeMismatchContext(propertyElement);

  // A type-mismatch editor is normally one full-width native input, leaving no
  // separate pill or blank drag handle. Pointerdown remains native; the feature
  // only takes ownership after movement crosses the drag threshold, so clicks
  // continue to edit the input while a deliberate drag can move its sole value.
  return mismatchContext?.container.contains(targetElement) === true
    ? mismatchContext.container
    : null;
}

export function isPropertyPillTarget(target: EventTarget | null): boolean {
  return resolveDraggablePropertyPill(target) != null;
}

export function isPropertyPillElement(element: Element): boolean {
  return element.matches(PROPERTY_PILL_SELECTOR);
}

export function blurFocusedPropertyEditor(propertyElement: HTMLElement): void {
  const activeElement = propertyElement.ownerDocument.activeElement;

  if (
    activeElement != null &&
    propertyElement.contains(activeElement) &&
    typeof (activeElement as HTMLElement).blur === "function"
  ) {
    (activeElement as HTMLElement).blur();
  }
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

export function findPropertyElementAtPoint(
  clientX: number,
  clientY: number,
  targetDocument: Document,
): HTMLElement | null {
  const targetElement = targetDocument.elementFromPoint(clientX, clientY);
  const directProperty = targetElement?.closest<HTMLElement>(PROPERTY_ELEMENT_SELECTOR);

  if (directProperty?.closest(METADATA_CONTAINER_SELECTOR) != null) {
    return directProperty;
  }

  const candidates = targetDocument.querySelectorAll<HTMLElement>(
    `${METADATA_CONTAINER_SELECTOR} ${PROPERTY_ELEMENT_SELECTOR}`,
  );
  return (
    Array.from(candidates).find((propertyElement) =>
      isPointInsideRect(clientX, clientY, propertyElement.getBoundingClientRect()),
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
  const hostIdentity = attributeCandidates
    .map((candidate) => normalizePropertyKey(candidate, true))
    .find((candidate) => candidate != null);

  for (const selector of [
    ".metadata-property-key input",
    ".metadata-property-key textarea",
  ]) {
    const element = propertyElement.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      selector,
    );

    // A focused key editor can contain an uncommitted rename that does not yet
    // identify the YAML property rendered by this row. Fail closed until the
    // host commits/blurs it instead of targeting the wrong key.
    if (element != null && element.ownerDocument.activeElement === element) {
      return null;
    }

    const normalizedCandidate = normalizePropertyKey(element?.value, true);

    if (normalizedCandidate != null) {
      // Obsidian preserves the authored key spelling in the native editor but
      // exposes a normalized/lowercase identity on the row. When both exist,
      // they must identify the same committed property; otherwise the DOM is
      // stale or mid-rerender and targeting must fail closed.
      if (
        hostIdentity != null &&
        normalizeHostPropertyKeyIdentity(normalizedCandidate) !==
          normalizeHostPropertyKeyIdentity(hostIdentity)
      ) {
        return null;
      }

      return normalizedCandidate;
    }
  }

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

    if (element == null || element.matches("input, textarea")) {
      continue;
    }

    const normalizedCandidate = normalizePropertyKey(element.textContent);

    if (normalizedCandidate != null) {
      return normalizedCandidate;
    }
  }

  const fallbackLabel = propertyElement.getAttribute("aria-label");
  return normalizePropertyKey(fallbackLabel);
}

function normalizeHostPropertyKeyIdentity(propertyKey: string): string {
  return propertyKey.trim().toLowerCase();
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

export function hasNativeListTypeEvidence(propertyElement: HTMLElement): boolean {
  return getNativePropertyTypeEvidence(propertyElement) === "list";
}

export function getNativePropertyTypeEvidence(
  propertyElement: HTMLElement,
): NativePropertyTypeEvidence {
  const iconElement = propertyElement.querySelector<HTMLElement>(PROPERTY_ICON_SELECTOR);

  if (iconElement == null) {
    return "unknown";
  }

  const dataIcons = [
    iconElement.dataset.icon,
    iconElement.getAttribute("data-icon"),
    ...Array.from(
      iconElement.querySelectorAll<HTMLElement | SVGElement>("[data-icon]"),
      (candidate) => candidate.getAttribute("data-icon"),
    ),
  ];

  if (dataIcons.some((iconName) => iconName === "list")) {
    return "list";
  }

  if (iconElement.querySelector("svg.lucide-list, .lucide-list") != null) {
    return "list";
  }

  const hasNonListIcon =
    dataIcons.some((iconName) => typeof iconName === "string" && iconName.length > 0) ||
    iconElement.querySelector<SVGElement>(
      'svg[class*="lucide-"]:not(.lucide-list)',
    ) != null;
  return hasNonListIcon ? "non-list" : "unknown";
}

export function findPropertyListContextByKey(
  paneContainer: HTMLElement,
  propertyKey: string,
): PropertyContainerContext | null {
  const matches = Array.from(
    paneContainer.querySelectorAll<HTMLElement>(PROPERTY_ELEMENT_SELECTOR),
  ).filter(
    (propertyElement) => resolvePropertyElementContext(propertyElement)?.propertyKey === propertyKey,
  );

  const [match] = matches;
  return matches.length === 1 && match != null
    ? resolvePropertyElementListContext(match)
    : null;
}

function isPointInsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
