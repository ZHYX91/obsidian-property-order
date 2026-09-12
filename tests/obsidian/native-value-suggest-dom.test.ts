// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import {
  getPropertyValueSuggestionContext,
  getSuggestionItems,
  hasActivePropertyValueSuggestionContext,
  isPropertyValueSuggestionContainer,
  resolvePropertyValueSuggestionContainer,
} from "../../src/obsidian/native-suggest-dom";

describe("native property value suggestion DOM", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("resolves a body-level popup from the focused property value editor", () => {
    const row = document.createElement("div");
    row.className = "metadata-property";
    row.dataset.propertyKey = "status";
    const valueEditor = document.createElement("input");
    valueEditor.className = "metadata-property-value";
    row.appendChild(valueEditor);
    document.body.appendChild(row);

    const container = document.createElement("div");
    container.className = "suggestion-container";
    container.innerHTML = [
      '<div class="suggestion-item">draft</div>',
      '<div class="suggestion-item">done</div>',
    ].join("");
    document.body.appendChild(container);
    valueEditor.focus();

    expect(getPropertyValueSuggestionContext(container)).toMatchObject({
      editor: valueEditor,
      propertyKey: "status",
      row,
    });
    expect(hasActivePropertyValueSuggestionContext(container)).toBe(true);
    expect(isPropertyValueSuggestionContainer(container)).toBe(true);
    expect(getSuggestionItems(container).map((item) => item.key)).toEqual([
      "draft",
      "done",
    ]);
  });

  it("does not classify property-name suggestions as value suggestions", () => {
    const keyEditor = document.createElement("input");
    keyEditor.className = "metadata-property-key";
    document.body.appendChild(keyEditor);
    const container = document.createElement("div");
    container.className = "suggestion-container mod-property-key";
    container.innerHTML = [
      '<div class="suggestion-item">status</div>',
      '<div class="suggestion-item">priority</div>',
    ].join("");
    document.body.appendChild(container);
    keyEditor.focus();

    expect(isPropertyValueSuggestionContainer(container)).toBe(false);
  });

  it("rejects generic context menus", () => {
    const menu = document.createElement("div");
    menu.className = "menu";
    const item = document.createElement("div");
    item.className = "menu-item";
    menu.appendChild(item);
    document.body.appendChild(menu);

    expect(resolvePropertyValueSuggestionContainer(item)).toBeNull();
  });
});
