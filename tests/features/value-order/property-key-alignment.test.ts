// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";

import { isSourceContextAlignedWithContent } from "../../../src/features/value-order/property-list-alignment";
import { resolvePropertyContainerContext } from "../../../src/obsidian/properties-dom";

afterEach(() => {
  document.body.replaceChildren();
});

describe("authored property key alignment", () => {
  it.each([
    "tags\u00a0",
    "\u00a0tags",
    "tags\u3000",
    "\u3000tags",
    "a:\u00a0b",
    "a:\u3000b",
  ])("aligns the authored key %j with its plain YAML property", (key) => {
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    const row = document.createElement("div");
    row.className = "metadata-property";
    row.dataset.propertyKey = key.trim().toLowerCase();
    const keyContainer = document.createElement("div");
    keyContainer.className = "metadata-property-key";
    const input = document.createElement("input");
    input.value = key;
    keyContainer.append(input);
    const container = document.createElement("div");
    container.className = "multi-select-container";

    for (const value of ["alpha", "beta"]) {
      const pill = document.createElement("div");
      pill.className = "multi-select-pill";
      const label = document.createElement("span");
      label.className = "multi-select-pill-content";
      label.textContent = value;
      pill.append(label);
      container.append(pill);
    }

    row.append(keyContainer, container);
    metadata.append(row);
    document.body.append(metadata);
    const context = resolvePropertyContainerContext(container);
    expect(context?.propertyKey).toBe(key);
    expect(context).not.toBeNull();

    if (context != null) {
      expect(isSourceContextAlignedWithContent(
        context,
        `---\n${key}: [alpha, beta]\n---\nBody\n`,
      )).toBe(true);
      expect(isSourceContextAlignedWithContent(
        context,
        `---\n${key}: [newer, beta]\n---\nBody\n`,
      )).toBe(false);
    }
  });
});
