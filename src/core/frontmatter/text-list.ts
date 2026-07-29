import { renderInlineComment, serializeNormalizedScalar } from "./scalar";
import type { BlockItemToken, FrontmatterScalar, ListItemToken, PropertyItem } from "./types";

export function normalizeTextListItems(items: PropertyItem[]): PropertyItem[] {
  for (const item of items) {
    normalizeTextListItem(item);
  }

  return items;
}

function normalizeTextListItem(item: PropertyItem): void {
  if (item.scalar.kind === "string") {
    return;
  }

  if ("raw" in item) {
    normalizeFlowItem(item);
  } else {
    normalizeBlockItem(item);
  }
}

function normalizeFlowItem(item: ListItemToken): void {
  const scalar = toRawTextScalar(item.raw);
  item.raw = serializeNormalizedScalar(scalar);
  item.scalar = scalar;
}

function normalizeBlockItem(item: BlockItemToken): void {
  const scalar = toRawTextScalar(item.rawValue);
  const rawValue = serializeNormalizedScalar(scalar);
  const dashSpace = item.dashSpace.length > 0 ? item.dashSpace : " ";
  item.dashSpace = dashSpace;
  item.originalLine = `${item.lineIndent}-${dashSpace}${rawValue}${renderInlineComment(
    item.inlineComment,
  )}`;
  item.rawValue = rawValue;
  item.scalar = scalar;
}

function toRawTextScalar(raw: string): FrontmatterScalar {
  return {
    kind: "string",
    value: raw.trim(),
  };
}
