// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  findPropertyContainerAtPoint,
  isPropertyPillTarget,
  resolveDraggablePropertyPill,
  resolvePropertyContainerContext,
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

  it("preserves the exact property key exposed by a native input", () => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const property = document.createElement("div");
    property.className = "metadata-property";
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
});
