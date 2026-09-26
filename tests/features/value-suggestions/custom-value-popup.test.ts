// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { describe, expect, it, vi } from "vitest";

import {
  commitCustomPropertyValueCandidate,
  mountCustomValuePopup,
} from "../../../src/features/value-suggestions/custom-value-popup";
import type { PropertyValueSuggestionContext } from "../../../src/obsidian/native-suggest-dom";

function createContext(
  targetDocument: Document = document,
): { context: PropertyValueSuggestionContext; input: HTMLInputElement } {
  const row = targetDocument.createElement("div");
  row.className = "metadata-property";
  row.dataset.propertyKey = "status";
  const input = targetDocument.createElement("input") as HTMLInputElement;
  input.className = "metadata-property-value";
  row.appendChild(input);
  targetDocument.body.appendChild(row);
  input.focus();

  return {
    context: {
      editor: input,
      propertyKey: "status",
      row,
    },
    input,
  };
}

describe("custom value fallback popup", () => {
  it("filters preset candidates against the current editor query", () => {
    const { context, input } = createContext();
    input.value = "do";
    const onCommit = vi.fn();

    const mount = mountCustomValuePopup(
      context,
      ["draft", "done", "archived"],
      onCommit,
    );

    expect(mount).not.toBeNull();
    expect(
      Array.from(
        mount!.container.querySelectorAll<HTMLElement>(".suggestion-title"),
        (element) => element.textContent,
      ),
    ).toEqual(["done"]);

    mount!.container.querySelector<HTMLElement>(".suggestion-item")?.click();
    expect(onCommit).toHaveBeenCalledWith("done");
    mount!.cleanup();
    expect(mount!.container.isConnected).toBe(false);
  });

  it("keeps focus on mouse press and commits the selected fallback with Tab", () => {
    const { context, input } = createContext();
    const onCommit = vi.fn();
    const mount = mountCustomValuePopup(context, ["draft", "done"], onCommit);

    if (mount == null) {
      throw new Error("Expected fallback popup.");
    }

    const selected = mount.container.querySelector<HTMLElement>(
      ".suggestion-item.is-selected",
    );
    if (selected == null) {
      throw new Error("Expected selected fallback candidate.");
    }

    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    selected.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);

    const modifiedTab = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
      shiftKey: true,
    });
    input.dispatchEvent(modifiedTab);
    expect(onCommit).not.toHaveBeenCalled();

    const tab = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    input.dispatchEvent(tab);
    expect(onCommit).toHaveBeenCalledWith("draft");

    mount.cleanup();
    mount.cleanup();
  });

  it("commits through the focused native editor input path", () => {
    const { context, input } = createContext();
    const inputEvents: string[] = [];
    input.addEventListener("input", () => inputEvents.push("input"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        inputEvents.push("enter");
      }
    });

    expect(commitCustomPropertyValueCandidate(context, "preset")).toBe(true);
    expect(input.value).toBe("preset");
    expect(inputEvents).toEqual(["input", "enter"]);
  });

  it("uses the editor owner realm for popout inputs", () => {
    const targetWindow = new HappyDomWindow({ height: 300, width: 400 });
    const { context, input } = createContext(
      targetWindow.document as unknown as Document,
    );

    expect(commitCustomPropertyValueCandidate(context, "popout")).toBe(true);
    expect(input.value).toBe("popout");

    targetWindow.close();
  });
});
