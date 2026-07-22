// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPreviewElement,
  positionPreview,
} from "../../../src/features/value-order/drag-dom";

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

  function createWindow(width: number, height: number): HappyDomWindow {
    const targetWindow = new HappyDomWindow({ height, width });
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
