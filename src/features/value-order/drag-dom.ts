import type { DropTarget, InvalidDropTarget } from "./types";

const DRAG_PREVIEW_OFFSET_X = 16;
const DRAG_PREVIEW_OFFSET_Y = 16;
const DRAG_PREVIEW_VIEWPORT_MARGIN = 8;
const DRAG_AUTOSCROLL_EDGE = 40;
const DRAG_AUTOSCROLL_MAX_STEP = 20;

interface ViewportFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function suppressNativeDrag(pill: HTMLElement): () => void {
  const elements = [pill, ...pill.querySelectorAll<HTMLElement>("a, [draggable]")];
  const previousDraggableState = new Map<HTMLElement, string | null>();
  let didRestore = false;

  for (const element of elements) {
    previousDraggableState.set(element, element.getAttribute("draggable"));
    element.setAttribute("draggable", "false");
  }

  return () => {
    if (didRestore) {
      return;
    }

    didRestore = true;

    for (const [element, previousValue] of previousDraggableState) {
      if (previousValue == null) {
        element.removeAttribute("draggable");
        continue;
      }

      element.setAttribute("draggable", previousValue);
    }

    refreshHoverCursor(elements);
  };
}

export function setDocumentDragCursorActive(targetDocument: Document, active: boolean): void {
  targetDocument.body.classList.toggle("property-order-drag-cursor-active", active);
}

export function updateInvalidDropTarget(
  targetDocument: Document,
  previousTarget: InvalidDropTarget | null,
  nextTarget: InvalidDropTarget | null,
): void {
  if (previousTarget?.propertyElement !== nextTarget?.propertyElement) {
    previousTarget?.propertyElement.classList.remove("property-order-invalid-drop-target");
    nextTarget?.propertyElement.classList.add("property-order-invalid-drop-target");
  }

  targetDocument.body.classList.toggle(
    "property-order-drag-cursor-invalid",
    nextTarget != null,
  );
}

export function updateIndicator(indicatorElement: HTMLElement, target: DropTarget | null): void {
  indicatorElement.classList.remove("is-reorder", "is-move");

  if (target == null || target.kind !== "drop") {
    indicatorElement.classList.remove("is-visible");
    return;
  }

  const pillRects = target.context.pills.map((pill) => pill.getBoundingClientRect());
  const requestedSlot = target.slot === "append" ? pillRects.length : target.slot;
  const slot = Math.min(Math.max(requestedSlot, 0), pillRects.length);
  const direction = getInlineDirection(target.context.container);
  const frame =
    pillRects.length === 0
      ? getEmptyContainerIndicatorFrame(
          target.context.container.getBoundingClientRect(),
          direction,
        )
      : getIndicatorFrame(pillRects, slot, direction);

  indicatorElement.style.left = `${Math.round(frame.left)}px`;
  indicatorElement.style.top = `${Math.round(frame.top)}px`;
  indicatorElement.style.height = `${Math.max(Math.round(frame.height), 16)}px`;
  indicatorElement.classList.add("is-visible", target.mode === "move" ? "is-move" : "is-reorder");
}

export function positionPreview(previewElement: HTMLElement, clientX: number, clientY: number): void {
  let left = Math.round(clientX + DRAG_PREVIEW_OFFSET_X);
  let top = Math.round(clientY + DRAG_PREVIEW_OFFSET_Y);
  previewElement.style.left = `${left}px`;
  previewElement.style.top = `${top}px`;

  const viewport = getViewportFrame(previewElement.ownerDocument.defaultView);

  if (viewport == null) {
    return;
  }

  const horizontalMargin = getViewportMargin(viewport.width);
  const verticalMargin = getViewportMargin(viewport.height);
  const availableWidth = viewport.width - horizontalMargin * 2;
  const availableHeight = viewport.height - verticalMargin * 2;

  fitPreviewDimension(previewElement, "width", availableWidth);
  fitPreviewDimension(previewElement, "height", availableHeight);

  const previewRect = previewElement.getBoundingClientRect();
  left += getViewportCorrection(
    previewRect.left,
    previewRect.right,
    viewport.left + horizontalMargin,
    viewport.left + viewport.width - horizontalMargin,
  );
  top += getViewportCorrection(
    previewRect.top,
    previewRect.bottom,
    viewport.top + verticalMargin,
    viewport.top + viewport.height - verticalMargin,
  );

  previewElement.style.left = `${left}px`;
  previewElement.style.top = `${top}px`;
}

export function createPreviewElement(sourcePill: HTMLElement): HTMLElement {
  const previewElement = sourcePill.cloneNode(true) as HTMLElement;
  previewElement.classList.add("property-order-drag-preview");
  previewElement.setAttribute("aria-hidden", "true");
  const sourceRect = sourcePill.getBoundingClientRect();
  const viewport = getViewportFrame(sourcePill.ownerDocument.defaultView);
  const availableWidth =
    viewport == null ? sourceRect.width : viewport.width - getViewportMargin(viewport.width) * 2;
  const availableHeight =
    viewport == null
      ? sourceRect.height
      : viewport.height - getViewportMargin(viewport.height) * 2;

  setLockedPreviewDimension(previewElement, "width", sourceRect.width, availableWidth);
  setLockedPreviewDimension(previewElement, "height", sourceRect.height, availableHeight);
  return previewElement;
}

export function createIndicatorElement(parentElement: HTMLElement): HTMLElement {
  const indicatorElement = parentElement.createDiv();
  indicatorElement.className = "property-order-drop-indicator";
  indicatorElement.setAttribute("aria-hidden", "true");
  return indicatorElement;
}

export function createDragStatusElement(parentElement: HTMLElement): HTMLElement {
  const statusElement = parentElement.createDiv();
  statusElement.className = "property-order-drag-status";
  statusElement.setAttribute("role", "status");
  statusElement.setAttribute("aria-live", "polite");
  statusElement.setAttribute("aria-atomic", "true");
  return statusElement;
}

export function announceDragStatus(statusElement: HTMLElement, message: string): void {
  if (statusElement.textContent !== message) {
    statusElement.textContent = message;
  }
}

export function autoScrollDragContainer(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const targetDocument = root.ownerDocument;
  const rootRect = root.getBoundingClientRect();
  if (!isPointInsideRect(clientX, clientY, rootRect)) {
    return false;
  }

  const hit = targetDocument.elementFromPoint?.(clientX, clientY);
  const candidates: HTMLElement[] = [];
  let current =
    hit != null && hit.nodeType === 1 ? (hit as HTMLElement) : null;

  while (current != null && root.contains(current)) {
    candidates.push(current);
    if (current === root) {
      break;
    }
    current = current.parentElement;
  }

  if (!candidates.includes(root)) {
    candidates.push(root);
  }

  for (const candidate of candidates) {
    const targetWindow = candidate.ownerDocument.defaultView;
    const overflowY = targetWindow?.getComputedStyle(candidate).overflowY ?? "";
    if (
      !["auto", "scroll", "overlay"].includes(overflowY) ||
      candidate.scrollHeight <= candidate.clientHeight
    ) {
      continue;
    }

    const candidateRect = candidate.getBoundingClientRect();
    if (!isPointInsideRect(clientX, clientY, candidateRect)) {
      continue;
    }

    const delta = getDragAutoScrollDelta(
      clientY,
      candidateRect.top,
      candidateRect.bottom,
    );
    if (delta === 0) {
      continue;
    }

    const before = candidate.scrollTop;
    candidate.scrollTop += delta;
    if (candidate.scrollTop !== before) {
      return true;
    }
  }

  return false;
}

export function getDragAutoScrollDelta(
  clientY: number,
  top: number,
  bottom: number,
): number {
  const height = bottom - top;
  if (!Number.isFinite(height) || height <= 0) {
    return 0;
  }

  const edge = Math.min(DRAG_AUTOSCROLL_EDGE, height / 3);
  if (clientY < top + edge) {
    const ratio = Math.min(1, Math.max(0, (top + edge - clientY) / edge));
    return -Math.max(1, Math.ceil(DRAG_AUTOSCROLL_MAX_STEP * ratio));
  }

  if (clientY > bottom - edge) {
    const ratio = Math.min(1, Math.max(0, (clientY - (bottom - edge)) / edge));
    return Math.max(1, Math.ceil(DRAG_AUTOSCROLL_MAX_STEP * ratio));
  }

  return 0;
}

function getEmptyContainerIndicatorFrame(
  rect: DOMRect,
  direction: "ltr" | "rtl",
): { height: number; left: number; top: number } {
  return {
    left: direction === "rtl" ? rect.right - 6 : rect.left + 2,
    top: rect.top + 2,
    height: rect.height - 4,
  };
}

function getIndicatorFrame(
  pillRects: DOMRect[],
  slot: number,
  direction: "ltr" | "rtl",
): { height: number; left: number; top: number } {
  if (slot <= 0) {
    const rect = pillRects[0];

    return {
      left: direction === "rtl" ? rect.right + 4 : rect.left - 4,
      top: rect.top + 2,
      height: rect.height - 4,
    };
  }

  if (slot >= pillRects.length) {
    const rect = pillRects[pillRects.length - 1];

    return {
      left: direction === "rtl" ? rect.left - 4 : rect.right + 4,
      top: rect.top + 2,
      height: rect.height - 4,
    };
  }

  const previousRect = pillRects[slot - 1];
  const nextRect = pillRects[slot];
  const wrappedToNextRow = Math.abs(nextRect.top - previousRect.top) > nextRect.height / 2;

  if (wrappedToNextRow) {
    return {
      left: direction === "rtl" ? nextRect.right + 4 : nextRect.left - 4,
      top: nextRect.top + 2,
      height: nextRect.height - 4,
    };
  }

  return {
    left:
      direction === "rtl"
        ? (previousRect.left + nextRect.right) / 2
        : (previousRect.right + nextRect.left) / 2,
    top: nextRect.top + 2,
    height: nextRect.height - 4,
  };
}

function refreshHoverCursor(elements: HTMLElement[]): void {
  const connectedElements = elements.filter((element) => element.isConnected);

  if (connectedElements.length === 0) {
    return;
  }

  for (const element of connectedElements) {
    element.classList.add("property-order-cursor-refresh");
  }

  const targetWindow = connectedElements[0].ownerDocument.defaultView;

  if (targetWindow == null) {
    for (const element of connectedElements) {
      element.classList.remove("property-order-cursor-refresh");
    }
    return;
  }

  targetWindow.requestAnimationFrame(() => {
    for (const element of connectedElements) {
      element.classList.remove("property-order-cursor-refresh");
    }
  });
}

function getViewportFrame(targetWindow: Window | null): ViewportFrame | null {
  if (targetWindow == null) {
    return null;
  }

  const visualViewport = targetWindow.visualViewport;

  if (
    visualViewport != null &&
    isPositiveFinite(visualViewport.width) &&
    isPositiveFinite(visualViewport.height)
  ) {
    return {
      height: visualViewport.height,
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
    };
  }

  if (!isPositiveFinite(targetWindow.innerWidth) || !isPositiveFinite(targetWindow.innerHeight)) {
    return null;
  }

  return {
    height: targetWindow.innerHeight,
    left: 0,
    top: 0,
    width: targetWindow.innerWidth,
  };
}

function getViewportMargin(viewportSize: number): number {
  return Math.min(DRAG_PREVIEW_VIEWPORT_MARGIN, viewportSize / 4);
}

function setLockedPreviewDimension(
  previewElement: HTMLElement,
  dimension: "height" | "width",
  sourceSize: number,
  availableSize: number,
): void {
  if (!isPositiveFinite(sourceSize) || !isPositiveFinite(availableSize)) {
    return;
  }

  previewElement.style[dimension] = `${roundCssPixel(Math.min(sourceSize, availableSize))}px`;
}

function fitPreviewDimension(
  previewElement: HTMLElement,
  dimension: "height" | "width",
  availableSize: number,
): void {
  if (!isPositiveFinite(availableSize)) {
    return;
  }

  const rect = previewElement.getBoundingClientRect();
  const renderedSize = dimension === "width" ? rect.width : rect.height;

  if (!isPositiveFinite(renderedSize) || renderedSize <= availableSize) {
    return;
  }

  const inlineSize = Number.parseFloat(previewElement.style[dimension]);
  const basisSize = isPositiveFinite(inlineSize) ? inlineSize : renderedSize;
  previewElement.style[dimension] = `${basisSize * (availableSize / renderedSize)}px`;
}

function getViewportCorrection(
  itemStart: number,
  itemEnd: number,
  viewportStart: number,
  viewportEnd: number,
): number {
  const itemSize = itemEnd - itemStart;
  const availableSize = viewportEnd - viewportStart;

  if (itemSize > availableSize) {
    return (viewportStart + viewportEnd - itemStart - itemEnd) / 2;
  }

  if (itemStart < viewportStart) {
    return viewportStart - itemStart;
  }

  if (itemEnd > viewportEnd) {
    return viewportEnd - itemEnd;
  }

  return 0;
}

function roundCssPixel(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function getInlineDirection(container: HTMLElement): "ltr" | "rtl" {
  try {
    return container.ownerDocument.defaultView?.getComputedStyle(container).direction === "rtl"
      ? "rtl"
      : "ltr";
  } catch {
    return "ltr";
  }
}
