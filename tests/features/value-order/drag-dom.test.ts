// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";

import {
  autoScrollDragContainer,
  createDragStatusElement,
  createIndicatorElement,
  createPreviewElement,
  getDragAutoScrollDelta,
  positionPreview,
  updateIndicator,
} from "../../../src/features/value-order/drag-dom";
import { installObsidianDomFactories } from "../../setup/obsidian-dom";

describe("drag preview geometry", () => {
  const openedWindows: HappyDomWindow[] = [];

  afterEach(() => {
    for (const openedWindow of openedWindows) {
      openedWindow.close();
    }
    openedWindows.length = 0;
  });

  it("locks the clone to the source size and clamps it in its owner window", () => {
    const targetWindow = createWindow(200, 100);
    const sourcePill = targetWindow.document.createElement("div") as unknown as HTMLElement;
    sourcePill.textContent = "a pill that must not wrap near the right edge";
    sourcePill.getBoundingClientRect = () => createRect(10, 10, 140, 32);
    (targetWindow.document.body as unknown as HTMLElement).appendChild(sourcePill);

    const previewElement = createPreviewElement(sourcePill);
    (targetWindow.document.body as unknown as HTMLElement).appendChild(previewElement);
    installScaledRect(previewElement);

    positionPreview(previewElement, 20, 20);
    expect(previewElement.style.left).toBe("36px");
    expect(previewElement.style.top).toBe("36px");

    positionPreview(previewElement, 194, 94);

    const previewRect = previewElement.getBoundingClientRect();
    expect(previewElement.ownerDocument).toBe(targetWindow.document);
    expect(previewElement.style.width).toBe("140px");
    expect(previewElement.style.height).toBe("32px");
    expect(previewRect.left).toBeGreaterThanOrEqual(8);
    expect(previewRect.right).toBeLessThanOrEqual(192);
    expect(previewRect.top).toBeGreaterThanOrEqual(8);
    expect(previewRect.bottom).toBeLessThanOrEqual(92);
  });

  it("preserves short value content inside a source-sized clone", () => {
    const targetWindow = createWindow(200, 100);
    const sourcePill = targetWindow.document.createElement("div") as unknown as HTMLElement;
    sourcePill.className = "multi-select-pill";
    sourcePill.innerHTML = [
      '<div class="multi-select-pill-content">one</div>',
      '<div class="multi-select-pill-remove-button">×</div>',
    ].join("");
    sourcePill.getBoundingClientRect = () => createRect(10, 10, 43.14, 18.2);

    const previewElement = createPreviewElement(sourcePill);
    const previewContent = previewElement.querySelector<HTMLElement>(
      ".multi-select-pill-content",
    );

    expect(previewElement.style.width).toBe("43.14px");
    expect(previewContent?.textContent).toBe("one");
    expect(previewElement.querySelector(".multi-select-pill-remove-button")).not.toBeNull();
  });

  it("shrinks an oversized source enough to fit a small visual viewport", () => {
    const targetWindow = createWindow(400, 300);
    Object.defineProperty(targetWindow, "visualViewport", {
      configurable: true,
      value: {
        height: 60,
        offsetLeft: 30,
        offsetTop: 20,
        width: 80,
      },
    });
    const sourcePill = targetWindow.document.createElement("div") as unknown as HTMLElement;
    sourcePill.getBoundingClientRect = () => createRect(0, 0, 240, 90);
    (targetWindow.document.body as unknown as HTMLElement).appendChild(sourcePill);

    const previewElement = createPreviewElement(sourcePill);
    (targetWindow.document.body as unknown as HTMLElement).appendChild(previewElement);
    expect(previewElement.style.width).toBe("64px");
    expect(previewElement.style.height).toBe("44px");
    installScaledRect(previewElement);
    positionPreview(previewElement, 100, 70);

    const previewRect = previewElement.getBoundingClientRect();
    expect(previewRect.left).toBeGreaterThanOrEqual(37.999);
    expect(previewRect.right).toBeLessThanOrEqual(102.001);
    expect(previewRect.top).toBeGreaterThanOrEqual(27.999);
    expect(previewRect.bottom).toBeLessThanOrEqual(72.001);
  });

  it("computes bounded edge autoscroll steps", () => {
    expect(getDragAutoScrollDelta(5, 0, 120)).toBeLessThan(0);
    expect(getDragAutoScrollDelta(60, 0, 120)).toBe(0);
    expect(getDragAutoScrollDelta(115, 0, 120)).toBeGreaterThan(0);
    expect(Math.abs(getDragAutoScrollDelta(-100, 0, 120))).toBeLessThanOrEqual(20);
  });

  it("scrolls only near the edge of an actual scrollable hit target and caps each step", () => {
    const targetWindow = createWindow(240, 160);
    const root = targetWindow.document.createElement("div") as unknown as HTMLElement;
    const scroller = targetWindow.document.createElement("div") as unknown as HTMLElement;
    root.appendChild(scroller);
    (targetWindow.document.body as unknown as HTMLElement).appendChild(root);
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 300 });
    scroller.scrollTop = 50;
    scroller.getBoundingClientRect = () => createRect(0, 0, 120, 100);
    Object.defineProperty(targetWindow.document, "elementFromPoint", {
      configurable: true,
      value: () => scroller,
    });

    expect(autoScrollDragContainer(root, 60, 50)).toBe(false);
    expect(scroller.scrollTop).toBe(50);

    expect(autoScrollDragContainer(root, 60, 95)).toBe(true);
    expect(scroller.scrollTop).toBeGreaterThan(50);
    expect(scroller.scrollTop).toBeLessThanOrEqual(70);
  });

  it("places a wrapped RTL insertion indicator on the logical leading edge", () => {
    const targetWindow = createWindow(320, 160);
    const container = targetWindow.document.createElement("div") as unknown as HTMLElement;
    container.style.direction = "rtl";
    const pills = [
      createRect(200, 0, 50, 20),
      createRect(140, 0, 50, 20),
      createRect(200, 30, 50, 20),
    ].map((pillRect) => {
      const pill = targetWindow.document.createElement("div") as unknown as HTMLElement;
      pill.getBoundingClientRect = () => pillRect;
      container.appendChild(pill);
      return pill;
    });
    (targetWindow.document.body as unknown as HTMLElement).appendChild(container);
    const indicator = createIndicatorElement(
      targetWindow.document.body as unknown as HTMLElement,
    );

    updateIndicator(indicator, {
      context: {
        container,
        editorKind: "multi-select",
        pills,
        propertyElement: targetWindow.document.createElement("div") as unknown as HTMLElement,
        propertyKey: "tags",
      },
      kind: "drop",
      mode: "reorder",
      slot: 2,
    });

    expect(indicator.style.left).toBe("254px");
    expect(indicator.style.top).toBe("32px");
    expect(indicator.style.height).toBe("16px");
  });

  it("creates a polite live status in the requested owner window", () => {
    const targetWindow = createWindow(200, 100);
    const status = createDragStatusElement(
      targetWindow.document.body as unknown as HTMLElement,
    );

    expect(status.ownerDocument).toBe(targetWindow.document);
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("creates the drop indicator in the requested owner window", () => {
    const targetWindow = createWindow(200, 100);

    const indicator = createIndicatorElement(
      targetWindow.document.body as unknown as HTMLElement,
    );

    expect(indicator.ownerDocument).toBe(targetWindow.document);
    expect(indicator.className).toBe("property-order-drop-indicator");
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
  });

  function createWindow(width: number, height: number): HappyDomWindow {
    const targetWindow = new HappyDomWindow({ height, width });
    installObsidianDomFactories(targetWindow.document as unknown as Document);
    openedWindows.push(targetWindow);
    return targetWindow;
  }
});

function installScaledRect(element: HTMLElement): void {
  element.getBoundingClientRect = () => {
    const baseWidth = Number.parseFloat(element.style.width);
    const baseHeight = Number.parseFloat(element.style.height);
    const renderedWidth = baseWidth * 1.06;
    const renderedHeight = baseHeight * 1.06;
    const left = Number.parseFloat(element.style.left) - (renderedWidth - baseWidth) / 2;
    const top = Number.parseFloat(element.style.top) - (renderedHeight - baseHeight) / 2;
    return createRect(left, top, renderedWidth, renderedHeight);
  };
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
