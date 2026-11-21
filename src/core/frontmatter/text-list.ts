import {
  renderInlineComment,
  serializeNormalizedScalar,
  trimYamlSeparationWhitespace,
} from "./scalar";
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
  const scalar: FrontmatterScalar = { kind: "string", value: textListItemValue(item) };
  item.raw = serializeNormalizedScalar(scalar);
  item.scalar = scalar;
}

function normalizeBlockItem(item: BlockItemToken): void {
  const scalar: FrontmatterScalar = { kind: "string", value: textListItemValue(item) };
  const rawValue = serializeNormalizedScalar(scalar);
  const dashSpace = item.dashSpace.length > 0 ? item.dashSpace : " ";
  item.dashSpace = dashSpace;
  item.originalLine = `${item.lineIndent}-${dashSpace}${rawValue}${renderInlineComment(
    item.inlineComment,
  )}`;
  item.rawValue = rawValue;
  item.scalar = scalar;
}

/** Text properties display the original spelling of a non-string YAML scalar. */
export function textListItemValue(item: PropertyItem): string {
  return item.scalar.kind === "string"
    ? item.scalar.value
    : trimYamlSeparationWhitespace("raw" in item ? item.raw : item.rawValue);
}
