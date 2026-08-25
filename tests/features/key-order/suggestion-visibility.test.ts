// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  isSuggestionElementVisible,
  PLUGIN_HIDDEN_SUGGESTION_CLASS,
} from "../../../src/features/key-order/suggestion-visibility";

describe("isSuggestionElementVisible", () => {
  it("accepts a connected suggestion whose ancestry is visible", () => {
    const item = appendSuggestion();

    expect(isSuggestionElementVisible(item)).toBe(true);
  });

  it.each([
    ["hidden attribute", (ancestor: HTMLElement) => { ancestor.hidden = true; }],
    ["aria-hidden", (ancestor: HTMLElement) => { ancestor.setAttribute("aria-hidden", "true"); }],
    ["plugin hidden class", (ancestor: HTMLElement) => {
      ancestor.classList.add(PLUGIN_HIDDEN_SUGGESTION_CLASS);
    }],
    ["display none", (ancestor: HTMLElement) => { ancestor.style.display = "none"; }],
    ["hidden visibility", (ancestor: HTMLElement) => { ancestor.style.visibility = "hidden"; }],
    ["collapsed visibility", (ancestor: HTMLElement) => {
      ancestor.style.visibility = "collapse";
    }],
  ])("rejects a suggestion under an ancestor with %s", (_name, hideAncestor) => {
    const item = appendSuggestion();
    const ancestor = item.parentElement;

    if (ancestor == null) {
      throw new Error("Expected suggestion ancestor.");
    }

    hideAncestor(ancestor);
    expect(isSuggestionElementVisible(item)).toBe(false);
  });
});

function appendSuggestion(): HTMLElement {
  document.body.replaceChildren();
  const ancestor = document.createElement("div");
  const item = document.createElement("div");
  ancestor.appendChild(item);
  document.body.appendChild(ancestor);
  return item;
}
