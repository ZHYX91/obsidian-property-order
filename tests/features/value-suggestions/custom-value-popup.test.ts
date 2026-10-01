// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.restoreAllMocks());

  it.each([
    { height: 300, width: 400, x: 350, y: 270, editorWidth: 120, popupHeight: 120 },
    { height: 300, width: 400, x: 20, y: 20, editorWidth: 120, popupHeight: 120 },
    { height: 100, width: 120, x: 100, y: 45, editorWidth: 200, popupHeight: 200 },
  ])("keeps fallback candidates inside a $width x $height owner window", (sample) => {
    const targetWindow = new HappyDomWindow(sample);
    const { context } = createContext(targetWindow.document as unknown as Document);
    vi.spyOn(context.editor, "getBoundingClientRect").mockReturnValue({
      left: sample.x,
      top: sample.y,
      bottom: sample.y + 30,
      width: sample.editorWidth,
    } as DOMRect);
    vi.spyOn(targetWindow.HTMLElement.prototype as unknown as HTMLElement, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          width: Math.min(Number.parseFloat(this.style.minWidth), Number.parseFloat(this.style.maxWidth)),
          height: Math.min(sample.popupHeight, Number.parseFloat(this.style.maxHeight)),
        } as DOMRect;
      },
    );
    const mount = mountCustomValuePopup(context, ["draft", "done"], () => undefined)!;
    const rect = mount.container.getBoundingClientRect();
    const left = Number.parseFloat(mount.container.style.left);
    const top = Number.parseFloat(mount.container.style.top);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(left + rect.width).toBeLessThanOrEqual(sample.width - 8);
    expect(top + rect.height).toBeLessThanOrEqual(sample.height - 8);
    expect(rect.height).toBeGreaterThan(0);
    if (sample.y + 30 === sample.height) expect(top).toBeLessThan(sample.y);
    mount.cleanup();
    targetWindow.close();
  });

  it("repositions within the visual viewport and removes layout listeners on cleanup", () => {
    const targetWindow = new HappyDomWindow({ height: 600, width: 400 });
    const { context } = createContext(targetWindow.document as unknown as Document);
    const viewport = new targetWindow.EventTarget();
    Object.assign(viewport, { width: 240, height: 200, offsetLeft: 40, offsetTop: 100 });
    Object.defineProperty(targetWindow, "visualViewport", { value: viewport });
    const editorRect = { left: 270, top: 280, bottom: 310, width: 180 };
    vi.spyOn(context.editor, "getBoundingClientRect").mockImplementation(() => editorRect as DOMRect);
    vi.spyOn(targetWindow.HTMLElement.prototype as unknown as HTMLElement, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return { width: Number.parseFloat(this.style.minWidth), height: 80 } as DOMRect;
      },
    );
    const mount = mountCustomValuePopup(context, ["draft"], () => undefined)!;
    expect(Number.parseFloat(mount.container.style.left)).toBe(92);
    expect(Number.parseFloat(mount.container.style.top)).toBe(200);
    editorRect.top = 120;
    editorRect.bottom = 150;
    viewport.dispatchEvent(new targetWindow.Event("resize"));
    expect(Number.parseFloat(mount.container.style.top)).toBe(150);
    editorRect.top = 280;
    editorRect.bottom = 310;
    context.editor.ownerDocument.dispatchEvent(new targetWindow.Event("scroll") as unknown as Event);
    expect(Number.parseFloat(mount.container.style.top)).toBe(200);
    mount.cleanup();
    editorRect.top = 120;
    editorRect.bottom = 150;
    viewport.dispatchEvent(new targetWindow.Event("resize"));
    targetWindow.dispatchEvent(new targetWindow.Event("resize"));
    context.editor.ownerDocument.dispatchEvent(new targetWindow.Event("scroll") as unknown as Event);
    expect(Number.parseFloat(mount.container.style.top)).toBe(200);
    targetWindow.close();
  });

  it("commits and filters the contenteditable list editor used by Properties", () => {
    const { context, input } = createContext();
    const wrapper = document.createElement("div");
    wrapper.className = "metadata-property-value";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.tabIndex = 0;
    editable.textContent = "pla";
    wrapper.appendChild(editable);
    input.replaceWith(wrapper);
    context.editor = wrapper;
    editable.focus();
    const committed: string[] = [];
    editable.addEventListener("keydown", (event) => {
      if (event.key === "Enter") committed.push(editable.textContent ?? "");
    });
    const mount = mountCustomValuePopup(context, ["planned", "draft"], () => undefined);
    expect(mount?.container.textContent).toBe("planned");
    expect(commitCustomPropertyValueCandidate(context, "planned")).toBe(true);
    expect(committed).toEqual(["planned"]);
    mount?.cleanup();
  });

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
