import {
  findPropertyContainerAtPoint,
  resolvePropertyContainerContext,
  type PropertyContainerContext,
  type PropertyPillContext,
} from "../../obsidian/properties-dom";
import type { DropTarget } from "./types";

export function resolveDropContextAtPoint(
  sourceContext: PropertyPillContext,
  clientX: number,
  clientY: number,
  enableCrossPropertyDrag: boolean,
  paneContainer: HTMLElement | null,
): PropertyContainerContext | null {
  const sourceContainerRect = sourceContext.container.getBoundingClientRect();

  if (isPointInsideRect(clientX, clientY, sourceContainerRect)) {
    return sourceContext;
  }

  if (!enableCrossPropertyDrag) {
    return null;
  }

  const container = findPropertyContainerAtPoint(
    clientX,
    clientY,
    sourceContext.container.ownerDocument,
  );

  if (container == null || container === sourceContext.container) {
    return null;
  }

  if (!isSamePaneContainer(container, paneContainer)) {
    return null;
  }

  const targetContext = resolvePropertyContainerContext(container);

  if (targetContext == null) {
    return null;
  }

  return targetContext;
}

export function resolveDropTarget(
  sourceContext: PropertyPillContext,
  targetContext: PropertyContainerContext,
  clientX: number,
  clientY: number,
): DropTarget | null {
  const pillRects = targetContext.pills.map((pill) => pill.getBoundingClientRect());
  const mode = targetContext.container === sourceContext.container ? "reorder" : "move";

  if (pillRects.length === 0) {
    return mode === "move" ? buildDropTarget(targetContext, mode, 0, -1) : null;
  }

  if (mode === "reorder" && sourceContext.pills.length <= 1) {
    return {
      context: targetContext,
      mode,
      slot: sourceContext.sourceIndex,
      kind: "noop",
    };
  }

  const sourceIndex = mode === "reorder" ? sourceContext.sourceIndex : -1;
  const candidates = targetContext.pills.map((pill, index) => ({
    index,
    pill,
    rect: pillRects[index],
  }));
  const rows = groupIntoVisualRows(candidates);
  const closestRow = rows.reduce((closest, row) =>
    getDistanceToRow(clientY, row) < getDistanceToRow(clientY, closest) ? row : closest,
  );
  const rowCandidates = closestRow.candidates.filter(
    (candidate) => candidate.pill !== sourceContext.pill,
  );
  const targetCandidates = rowCandidates.length > 0 ? rowCandidates : closestRow.candidates;
  const closestPill = targetCandidates.reduce((closest, candidate) =>
    getAxisDistance(clientX, candidate.rect.left, candidate.rect.right) <
    getAxisDistance(clientX, closest.rect.left, closest.rect.right)
      ? candidate
      : closest,
  );
  const slot =
    clientX < closestPill.rect.left + closestPill.rect.width / 2
      ? closestPill.index
      : closestPill.index + 1;

  return buildDropTarget(targetContext, mode, slot, sourceIndex);
}

export function isSamePaneContainer(
  container: HTMLElement,
  paneContainer: HTMLElement | null,
): boolean {
  if (paneContainer == null) {
    return true;
  }

  return paneContainer.contains(container);
}

function buildDropTarget(
  context: PropertyContainerContext,
  mode: "reorder" | "move",
  slot: number,
  sourceIndex: number,
): DropTarget {
  if (mode === "reorder" && (slot === sourceIndex || slot === sourceIndex + 1)) {
    return {
      context,
      mode,
      slot,
      kind: "noop",
    };
  }

  return {
    context,
    mode,
    slot,
    kind: "drop",
  };
}

interface VisualRowCandidate {
  index: number;
  pill: HTMLElement;
  rect: DOMRect;
}

interface VisualRow {
  bottom: number;
  candidates: VisualRowCandidate[];
  top: number;
}

function groupIntoVisualRows(candidates: VisualRowCandidate[]): VisualRow[] {
  const rows: VisualRow[] = [];

  for (const candidate of candidates) {
    const currentRow = rows[rows.length - 1];

    if (currentRow == null || !isOnVisualRow(candidate.rect, currentRow)) {
      rows.push({
        bottom: candidate.rect.bottom,
        candidates: [candidate],
        top: candidate.rect.top,
      });
      continue;
    }

    currentRow.bottom = Math.max(currentRow.bottom, candidate.rect.bottom);
    currentRow.top = Math.min(currentRow.top, candidate.rect.top);
    currentRow.candidates.push(candidate);
  }

  return rows;
}

function isOnVisualRow(rect: DOMRect, row: VisualRow): boolean {
  const rectCenter = (rect.top + rect.bottom) / 2;
  const rowCenter = (row.top + row.bottom) / 2;
  const rectHeight = Math.max(rect.height, 1);
  const rowHeight = Math.max(row.bottom - row.top, 1);
  return Math.abs(rectCenter - rowCenter) <= Math.max(rectHeight, rowHeight) / 2;
}

function getDistanceToRow(clientY: number, row: VisualRow): number {
  return getAxisDistance(clientY, row.top, row.bottom);
}

function getAxisDistance(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue - value;
  }

  if (value > maxValue) {
    return value - maxValue;
  }

  return 0;
}

function isPointInsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
