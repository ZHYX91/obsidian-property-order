// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findSuggestionContainers,
  getSuggestionItemParent,
  getSuggestionItems,
  hasActivePropertyKeySuggestionContext,
  isLikelyPropertyKeySuggestionContainer,
  isPropertyKeySuggestionContainer,
  resolveSuggestionContainer,
} from "../../src/obsidian/native-suggest-dom";

function suggestionItem(key: string, className = "suggestion-item"): HTMLElement {
  const item = document.createElement("div");
  item.className = className;
  const title = document.createElement("div");
  title.className = className === "menu-item" ? "menu-item-title" : "suggestion-title";
  title.textContent = key;
  item.appendChild(title);
  return item;
}

describe("native suggestion DOM adapter", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("recognizes supported container and item selector variants without duplicates", () => {
    const root = document.createElement("div");
    root.className = "metadata-property-key";
    const container = document.createElement("div");
    container.className = "suggestion-container menu";
    container.append(suggestionItem(" tags "), suggestionItem("aliases", "menu-item"));
    root.appendChild(container);
    document.body.appendChild(root);

    const containers = findSuggestionContainers(document);
    const items = getSuggestionItems(container);

    expect(containers).toEqual([container]);
    expect(items.map((item) => item.key)).toEqual(["tags", "aliases"]);
    expect(getSuggestionItemParent(items)).toBe(container);
    expect(isLikelyPropertyKeySuggestionContainer(container, items)).toBe(true);
  });

  it.each([
    "suggestion-container mod-property-key",
    "suggestion mod-property-key",
    "menu mod-property-key",
  ])("recognizes the dedicated property-key container variant %s", (className) => {
    const container = document.createElement("div");
    container.className = className;
    container.append(suggestionItem("tags"), suggestionItem("aliases"));
    document.body.appendChild(container);

    expect(isPropertyKeySuggestionContainer(container)).toBe(true);
    expect(resolveSuggestionContainer(container.firstElementChild as HTMLElement)).toBe(
      container,
    );
  });

  it("keeps suggestion names that differ only by repeated internal whitespace distinct", () => {
    const container = document.createElement("div");
    container.className = "suggestion-container";
    container.append(suggestionItem("a b"), suggestionItem("a  b"));

    expect(getSuggestionItems(container).map((item) => item.key)).toEqual([
      "a b",
      "a  b",
    ]);
  });

  it("recognizes a portaled menu only while the property-key editor owns focus", () => {
    const property = document.createElement("div");
    property.className = "metadata-property";
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = document.createElement("input");
    keyEditor.appendChild(keyInput);
    property.appendChild(keyEditor);
    const container = document.createElement("div");
    container.className = "suggestion-container";
    container.append(suggestionItem("tags"), suggestionItem("aliases"));
    document.body.append(property, container);

    keyInput.focus();

    expect(isLikelyPropertyKeySuggestionContainer(container)).toBe(true);
  });

  it("binds two property-name portals to their own editors and yields ambiguous ownership", () => {
    const editors = ["first", "second"].map((id) => {
      const input = document.createElement("input");
      input.className = "metadata-property-key";
      const container = document.createElement("div");
      container.className = "suggestion-container";
      const list = document.createElement("div");
      list.id = id;
      list.append(suggestionItem("tags"), suggestionItem("aliases"));
      container.append(list);
      input.setAttribute("aria-owns", id);
      document.body.append(input, container);
      return { container, input };
    });
    const [first, second] = editors;
    first.input.focus();
    expect(hasActivePropertyKeySuggestionContext(first.container)).toBe(true);
    expect(isPropertyKeySuggestionContainer(second.container)).toBe(false);
    second.input.focus();
    expect(hasActivePropertyKeySuggestionContext(first.container)).toBe(false);
    expect(isPropertyKeySuggestionContainer(second.container)).toBe(true);
    // A stale duplicate ID cannot prove which list receives keystrokes.
    first.container.firstElementChild!.id = "second";
    expect(hasActivePropertyKeySuggestionContext(second.container)).toBe(false);
    first.input.removeAttribute("aria-owns");
    second.input.removeAttribute("aria-owns");
    expect(isPropertyKeySuggestionContainer(first.container)).toBe(false);
    expect(isPropertyKeySuggestionContainer(second.container)).toBe(false);
  });

  it("resolves a property popup without looking up every unrelated workspace control target", () => {
    const input = document.createElement("input");
    input.className = "metadata-property-key";
    const popup = document.createElement("div");
    popup.className = "suggestion-container";
    popup.id = "native-properties";
    popup.append(suggestionItem("tags"), suggestionItem("aliases"));
    input.setAttribute("aria-controls", popup.id);
    document.body.append(input, popup);
    for (let index = 0; index < 200; index += 1) {
      const tab = document.createElement("button");
      const panel = document.createElement("section");
      panel.id = `workspace-panel-${index}`;
      tab.setAttribute("aria-controls", panel.id);
      document.body.append(tab, panel);
    }
    input.focus();
    const queries = vi.spyOn(document, "querySelectorAll");
    try {
      expect(hasActivePropertyKeySuggestionContext(popup)).toBe(true);
      expect(queries.mock.calls.filter(([selector]) =>
        selector.startsWith("#workspace-panel-"))).toHaveLength(0);
    } finally {
      queries.mockRestore();
    }
  });

  it("rejects value suggestions even inside a Properties row", () => {
    const property = document.createElement("div");
    property.className = "metadata-property";
    const valueEditor = document.createElement("div");
    valueEditor.className = "metadata-property-value";
    const valueInput = document.createElement("input");
    valueEditor.appendChild(valueInput);
    const container = document.createElement("div");
    container.className = "suggestion-container";
    container.append(suggestionItem("one"), suggestionItem("two"));
    property.append(valueEditor, container);
    document.body.appendChild(property);

    valueInput.focus();

    expect(isLikelyPropertyKeySuggestionContainer(container)).toBe(false);
  });

  it("finds an owning suggestion container from a mutated descendant", () => {
    const keyEditor = document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const container = document.createElement("div");
    container.className = "suggestion-container";
    const item = suggestionItem("tags");
    container.append(item, suggestionItem("aliases"));
    keyEditor.appendChild(container);
    document.body.appendChild(keyEditor);

    const title = item.querySelector<HTMLElement>(".suggestion-title");

    expect(title).not.toBeNull();
    expect(findSuggestionContainers(title!)).toEqual([container]);
  });

  it("uses the container owner document across window realms", () => {
    const foreignWindow = new HappyDomWindow();
    const keyEditor = foreignWindow.document.createElement("div");
    keyEditor.className = "metadata-property-key";
    const keyInput = foreignWindow.document.createElement("input");
    keyEditor.appendChild(keyInput);
    const container = foreignWindow.document.createElement("div");
    container.className = "suggestion-container";
    const tags = foreignWindow.document.createElement("div");
    tags.className = "suggestion-item";
    tags.textContent = "tags";
    const aliases = foreignWindow.document.createElement("div");
    aliases.className = "suggestion-item";
    aliases.textContent = "aliases";
    container.append(tags, aliases);
    foreignWindow.document.body.append(keyEditor, container);
    keyInput.focus();

    expect(findSuggestionContainers(container as unknown as HTMLElement)).toEqual([container]);
    expect(
      isLikelyPropertyKeySuggestionContainer(container as unknown as HTMLElement),
    ).toBe(true);
    foreignWindow.close();
  });

  it("fails open when items do not share a parent or menu lacks Properties context", () => {
    const container = document.createElement("div");
    container.className = "suggestion-container";
    const groupA = document.createElement("div");
    const groupB = document.createElement("div");
    groupA.appendChild(suggestionItem("tags"));
    groupB.appendChild(suggestionItem("aliases"));
    container.append(groupA, groupB);
    document.body.appendChild(container);

    const items = getSuggestionItems(container);
    expect(getSuggestionItemParent(items)).toBeNull();
    expect(isLikelyPropertyKeySuggestionContainer(container, items)).toBe(false);
  });
});
