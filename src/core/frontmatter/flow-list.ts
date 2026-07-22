import type { ListWritebackFormat } from "../../shared/types";
import {
  isValidQuotedScalar,
  parseScalar,
  renderInlineComment,
  serializeNormalizedScalar,
} from "./scalar";
import type { FrontmatterScalar, ListItemToken, PropertyItem } from "./types";

export function parseFlowSequence(rawSequence: string): ListItemToken[] | null {
  if (!rawSequence.startsWith("[") || !rawSequence.endsWith("]")) {
    return null;
  }

  const inner = rawSequence.slice(1, -1);
  const items: ListItemToken[] = [];
  let buffer = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    const nextCharacter = inner[index + 1] ?? "";

    if (character === "'" && !inDoubleQuote) {
      if (inSingleQuote && nextCharacter === "'") {
        buffer += "''";
        index += 1;
        continue;
      }

      if (inSingleQuote || buffer.trim().length === 0) {
        inSingleQuote = !inSingleQuote;
      }
      buffer += character;
      continue;
    }

    if (character === "\"" && !inSingleQuote) {
      let escaping = false;
      let cursor = index - 1;

      while (cursor >= 0 && inner[cursor] === "\\") {
        escaping = !escaping;
        cursor -= 1;
      }

      if (!escaping && (inDoubleQuote || buffer.trim().length === 0)) {
        inDoubleQuote = !inDoubleQuote;
      }

      buffer += character;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && "[]{}".includes(character)) {
      return null;
    }

    if (character === "," && !inSingleQuote && !inDoubleQuote) {
      const raw = buffer.trim();

      if (raw.length === 0) {
        return null;
      }

      if (!isSupportedScalarToken(raw)) {
        return null;
      }

      items.push({ raw, scalar: parseScalar(raw) });
      buffer = "";
      continue;
    }

    buffer += character;
  }

  if (inSingleQuote || inDoubleQuote) {
    return null;
  }

  const finalItem = buffer.trim();

  if (finalItem.length > 0) {
    if (!isSupportedScalarToken(finalItem)) {
      return null;
    }

    items.push({ raw: finalItem, scalar: parseScalar(finalItem) });
  }

  return items;
}

export function toFlowItemToken(item: PropertyItem): ListItemToken {
  if ("raw" in item) {
    return item;
  }

  const raw = item.rawValue.trim();

  if (raw.length === 0) {
    return {
      raw: "null",
      scalar: item.scalar,
    };
  }

  const parsedAsFlow = parseFlowSequence(`[${raw}]`);

  if (
    parsedAsFlow?.length === 1 &&
    areScalarsEqual(parsedAsFlow[0].scalar, item.scalar)
  ) {
    return {
      raw,
      scalar: item.scalar,
    };
  }

  return {
    // A plain block scalar can contain flow delimiters such as commas. Quote
    // only tokens that cannot represent the same single scalar in flow
    // context; reusable raw tokens retain their original YAML type semantics.
    raw: serializeNormalizedScalar(item.scalar),
    scalar: item.scalar,
  };
}

export function renderFlowProperty(
  property: { keyText: string; inlineComment: string },
  items: ListItemToken[],
  writebackFormat: ListWritebackFormat,
): string {
  const renderedItems = items.map((item) =>
    writebackFormat === "preserve"
      ? item.raw.trim()
      : serializeNormalizedScalar(item.scalar),
  );
  return `${property.keyText}: [${renderedItems.join(", ")}]${renderInlineComment(
    property.inlineComment,
  )}`;
}

function areScalarsEqual(left: FrontmatterScalar, right: FrontmatterScalar): boolean {
  return left.kind === right.kind && left.value === right.value;
}

function isSupportedScalarToken(raw: string): boolean {
  if (raw.startsWith("'") || raw.startsWith("\"")) {
    return isValidQuotedScalar(raw);
  }

  if (/^(?:[?&*!|>]|-(?:\s|$))/.test(raw)) {
    return false;
  }

  return !hasMappingSeparator(raw);
}

function hasMappingSeparator(raw: string): boolean {
  for (let index = 0; index < raw.length; index += 1) {
    const nextCharacter = raw[index + 1] ?? "";

    if (raw[index] === ":" && (nextCharacter.length === 0 || /\s/.test(nextCharacter))) {
      return true;
    }
  }

  return false;
}
