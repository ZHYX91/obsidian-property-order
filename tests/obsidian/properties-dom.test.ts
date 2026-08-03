// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  blurFocusedPropertyEditor,
  findPropertyContainerAtPoint,
  findPropertyElementAtPoint,
  findPropertyListContextByKey,
  getListTypeMismatchDisplayValue,
  getNativePropertyTypeEvidence,
  getPropertyPillValueEvidence,
  isPropertyPillTarget,
  resolveDraggablePropertyPill,
  resolveListTypeMismatchContext,
  resolvePropertyContainerContext,
  resolvePropertyElementContext,
  resolvePropertyPillContext,
} from "../../src/obsidian/properties-dom";

function createPill(insideMetadata: boolean): HTMLElement {
  const metadata = document.createElement("div");
  metadata.className = insideMetadata ? "metadata-container" : "unrelated-view";
  const container = document.createElement("div");
  container.className = "multi-select-container";
  const pill = document.createElement("div");
  pill.className = "multi-select-pill";
  container.appendChild(pill);
  metadata.appendChild(container);
  document.body.appendChild(metadata);
  return pill;
}

describe("Properties DOM", () => {
  it("recognizes native drag targets only inside a metadata container", () => {
    const propertyPill = createPill(true);
    const unrelatedPill = createPill(false);

    expect(isPropertyPillTarget(propertyPill)).toBe(true);
    expect(resolveDraggablePropertyPill(propertyPill)).toBe(propertyPill);
    expect(isPropertyPillTarget(unrelatedPill)).toBe(false);
    expect(resolveDraggablePropertyPill(unrelatedPill)).toBeNull();
  });

  it("uses the supplied owner document for point lookup", () => {
    const pill = createPill(true);
    const container = pill.closest<HTMLElement>(".multi-select-container");
    const targetDocument = {
      elementFromPoint: () => pill,
      querySelectorAll: () => [],
    } as unknown as Document;

    expect(findPropertyContainerAtPoint(10, 20, targetDocument)).toBe(container);
  });

  it("rejects a point lookup that hits an unrelated multi-select", () => {
    const pill = createPill(false);
    const targetDocument = {
      elementFromPoint: () => pill,
      querySelectorAll: () => [],
    } as unknown as Document;

    expect(findPropertyContainerAtPoint(10, 20, targetDocument)).toBeNull();
  });

  it("resolves a scalar property row at a point without requiring a list container", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "status";
    const valueInput = document.createElement("input");
    property.appendChild(valueInput);
    metadata.appendChild(property);
    document.body.appendChild(metadata);
    const targetDocument = {
      elementFromPoint: () => valueInput,
      querySelectorAll: () => [],
    } as unknown as Document;

    expect(findPropertyElementAtPoint(10, 20, targetDocument)).toBe(property);
    expect(resolvePropertyElementContext(property)).toEqual({
      propertyElement: property,
      propertyKey: "status",
    });
  });

  it("recognizes the full-width native mismatch input as a threshold drag source", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "related";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "list";
    const value = document.createElement("div");
    value.className = "metadata-property-value";
    const input = document.createElement("input");
    input.className = "metadata-input-number";
    input.value = "123";
    const warning = document.createElement("div");
    warning.className = "metadata-property-warning-icon";
    value.append(input, warning);
    property.append(icon, value);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolveListTypeMismatchContext(property)).toMatchObject({
      container: value,
      editorKind: "list-type-mismatch",
      pills: [],
      propertyKey: "related",
    });
    expect(resolveDraggablePropertyPill(input)).toBe(value);
    expect(resolveDraggablePropertyPill(value)).toBe(value);
    expect(resolvePropertyPillContext(value)).toMatchObject({
      editorKind: "list-type-mismatch",
      pill: value,
      pills: [value],
      sourceIndex: 0,
    });
    expect(resolveDraggablePropertyPill(warning)).toBeNull();
    const mismatchContext = resolveListTypeMismatchContext(property);
    expect(mismatchContext == null ? null : getListTypeMismatchDisplayValue(mismatchContext)).toBe(
      "123",
    );
    expect(findPropertyListContextByKey(metadata, "related")).toMatchObject({
      container: value,
      editorKind: "list-type-mismatch",
    });
  });

  it("reads a mixed list rendered as the native unknown-value item", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "related";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "list";
    const value = document.createElement("div");
    value.className = "metadata-property-value";
    const unknownValue = document.createElement("span");
    unknownValue.className = "metadata-property-value-item mod-unknown";
    unknownValue.textContent = '[true, "gamma"]';
    const warning = document.createElement("div");
    warning.className = "metadata-property-warning-icon";
    value.append(unknownValue, warning);
    property.append(icon, value);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    const mismatchContext = resolveListTypeMismatchContext(property);

    expect(mismatchContext).not.toBeNull();
    expect(
      mismatchContext == null ? null : getListTypeMismatchDisplayValue(mismatchContext),
    ).toBe('[true, "gamma"]');
  });

  it("does not infer a list type from a mismatch warning without the native list icon", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "count";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "binary";
    const value = document.createElement("div");
    value.className = "metadata-property-value";
    const input = document.createElement("input");
    const warning = document.createElement("div");
    warning.className = "metadata-property-warning-icon";
    value.append(input, warning);
    property.append(icon, value);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolveListTypeMismatchContext(property)).toBeNull();
    expect(resolveDraggablePropertyPill(input)).toBeNull();
    expect(getNativePropertyTypeEvidence(property)).toBe("non-list");
  });

  it("distinguishes list, non-list, and missing native type evidence", () => {
    const listProperty = document.createElement("div");
    const listIcon = document.createElement("div");
    listIcon.className = "metadata-property-icon";
    listIcon.innerHTML = '<svg class="lucide-list"></svg>';
    listProperty.appendChild(listIcon);

    const textProperty = document.createElement("div");
    const textIcon = document.createElement("div");
    textIcon.className = "metadata-property-icon";
    textIcon.dataset.icon = "text";
    textProperty.appendChild(textIcon);

    expect(getNativePropertyTypeEvidence(listProperty)).toBe("list");
    expect(getNativePropertyTypeEvidence(textProperty)).toBe("non-list");
    expect(getNativePropertyTypeEvidence(document.createElement("div"))).toBe("unknown");
  });

  it("preserves the exact property key exposed by a native input", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "project  status";
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = document.createElement("input");
    keyInput.value = " Project  Status ";
    const container = document.createElement("div");
    container.className = "multi-select-container";
    keyEditor.appendChild(keyInput);
    property.append(keyEditor, container);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolvePropertyContainerContext(container)?.propertyKey).toBe(
      " Project  Status ",
    );
  });

  it("prefers the mixed-case native key over Obsidian's lowercased data attribute", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "projectstatus";
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = document.createElement("input");
    keyInput.value = "ProjectStatus";
    const container = document.createElement("div");
    container.className = "multi-select-container";
    keyEditor.appendChild(keyInput);
    property.append(keyEditor, container);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolvePropertyContainerContext(container)?.propertyKey).toBe("ProjectStatus");
  });

  it("fails closed when the native key and host row identity disagree", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "status";
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = document.createElement("input");
    keyInput.value = "ProjectStatus";
    const container = document.createElement("div");
    container.className = "multi-select-container";
    keyEditor.appendChild(keyInput);
    property.append(keyEditor, container);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolvePropertyContainerContext(container)).toBeNull();
  });

  it("fails closed while the native property key editor contains an uncommitted value", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "projectstatus";
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = document.createElement("input");
    keyInput.value = "RenamingNow";
    const container = document.createElement("div");
    container.className = "multi-select-container";
    keyEditor.appendChild(keyInput);
    property.append(keyEditor, container);
    metadata.appendChild(property);
    document.body.appendChild(metadata);
    keyInput.focus();

    expect(resolvePropertyContainerContext(container)).toBeNull();
  });

  it("falls back to the lowercased host data attribute without a native key editor", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "projectstatus";
    const container = document.createElement("div");
    container.className = "multi-select-container";
    property.appendChild(container);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    expect(resolvePropertyContainerContext(container)?.propertyKey).toBe("projectstatus");
  });

  it("releases native property focus when a drag starts", () => {
    const property = document.createElement("div");
    const input = document.createElement("input");
    property.appendChild(input);
    document.body.appendChild(property);
    input.focus();

    blurFocusedPropertyEditor(property);

    expect(document.activeElement).not.toBe(input);
  });

  it("reports plain pill values as text evidence", () => {
    const { context } = createEvidenceContext("alpha", "beta");

    expect(getPropertyPillValueEvidence(context)).toEqual([
      { kind: "text", text: "alpha" },
      { kind: "text", text: "beta" },
    ]);
  });

  it("reports a single verified host link as link evidence with its target", () => {
    const { context, contentElements } = createEvidenceContext("alpha", "[[医院 A|医院]]");
    const linkElement = document.createElement("a");
    linkElement.className = "internal-link";
    linkElement.setAttribute("data-href", "医院 A");
    linkElement.textContent = "医院";
    if (contentElements[1] != null) {
      contentElements[1].textContent = "";
      contentElements[1].appendChild(linkElement);
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([
      { kind: "text", text: "alpha" },
      { kind: "link", target: "医院 A", text: "医院" },
    ]);
  });

  it("reports the host pill content itself as link evidence when it carries the link", () => {
    const { context, contentElements } = createEvidenceContext("alpha", "[[医院 A|医院]]");
    if (contentElements[1] != null) {
      contentElements[1].className = "multi-select-pill-content internal-link";
      contentElements[1].setAttribute("data-href", "医院 A");
      contentElements[1].textContent = "医院";
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([
      { kind: "text", text: "alpha" },
      { kind: "link", target: "医院 A", text: "医院" },
    ]);
  });

  it("fails closed when a host link has an empty target", () => {
    const { context, contentElements } = createEvidenceContext("alpha");
    const linkElement = document.createElement("a");
    linkElement.className = "internal-link";
    linkElement.setAttribute("data-href", "");
    linkElement.textContent = "医院";
    if (contentElements[0] != null) {
      contentElements[0].textContent = "";
      contentElements[0].appendChild(linkElement);
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([{ kind: "unsupported" }]);
  });

  it("fails closed when a pill contains multiple candidate links", () => {
    const { context, contentElements } = createEvidenceContext("alpha");
    const firstLink = document.createElement("a");
    firstLink.className = "internal-link";
    firstLink.setAttribute("data-href", "医院 A");
    firstLink.textContent = "医院 A";
    const secondLink = document.createElement("a");
    secondLink.className = "internal-link";
    secondLink.setAttribute("data-href", "医院 B");
    secondLink.textContent = "医院 B";
    if (contentElements[0] != null) {
      contentElements[0].textContent = "";
      contentElements[0].append(firstLink, secondLink);
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([{ kind: "unsupported" }]);
  });

  it("fails closed when a host link is mixed with extra pill text", () => {
    const { context, contentElements } = createEvidenceContext("alpha");
    const linkElement = document.createElement("a");
    linkElement.className = "internal-link";
    linkElement.setAttribute("data-href", "医院 A");
    linkElement.textContent = "医院";
    if (contentElements[0] != null) {
      contentElements[0].textContent = "";
      contentElements[0].appendChild(linkElement);
      contentElements[0].append(document.createTextNode("后缀"));
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([{ kind: "unsupported" }]);
  });

  it("keeps external link pills as text evidence", () => {
    const { context, contentElements } = createEvidenceContext("alpha");
    const externalLink = document.createElement("a");
    externalLink.className = "external-link";
    externalLink.setAttribute("data-href", "https://example.com");
    externalLink.textContent = "https://example.com";
    if (contentElements[0] != null) {
      contentElements[0].textContent = "";
      contentElements[0].appendChild(externalLink);
    }

    expect(getPropertyPillValueEvidence(context)).toEqual([
      { kind: "text", text: "https://example.com" },
    ]);
  });

  it("returns null outside a multi-select context", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
    property.dataset.propertyKey = "related";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "list";
    const value = document.createElement("div");
    value.className = "metadata-property-value";
    const input = document.createElement("input");
    input.value = "123";
    const warning = document.createElement("div");
    warning.className = "metadata-property-warning-icon";
    value.append(input, warning);
    property.append(icon, value);
    metadata.appendChild(property);
    document.body.appendChild(metadata);

    const context = resolveListTypeMismatchContext(property);

    expect(context).not.toBeNull();
    expect(getPropertyPillValueEvidence(context!)).toBeNull();
  });
});

function createEvidenceContext(...values: string[]): {
  context: NonNullable<ReturnType<typeof resolvePropertyContainerContext>>;
  contentElements: (HTMLElement | null)[];
} {
  const metadata = document.createElement("div");
  metadata.className = "metadata-container";
  const property = document.createElement("div");
  property.className = "metadata-property";
  property.dataset.propertyKey = "project";
  const container = document.createElement("div");
  container.className = "multi-select-container";
  const contentElements = values.map((value) => {
    const pill = document.createElement("div");
    pill.className = "multi-select-pill";
    const content = document.createElement("div");
    content.className = "multi-select-pill-content";
    content.textContent = value;
    pill.appendChild(content);
    container.appendChild(pill);
    return content;
  });
  property.appendChild(container);
  metadata.appendChild(property);
  document.body.appendChild(metadata);
  return {
    context: resolvePropertyContainerContext(container) as NonNullable<
      ReturnType<typeof resolvePropertyContainerContext>
    >,
    contentElements,
  };
}
