import type { ListWritebackFormat } from "../../shared/types";
import {
  isValidQuotedScalar,
  parseScalar,
  serializeNormalizedScalar,
  splitInlineComment,
} from "./scalar";
import type {
  BlockItemToken,
  BlockRenderContext,
  PropertyItem,
  PropertyMatch,
} from "./types";

export function parseBlockSequence(lines: string[]): {
  items: BlockItemToken[];
  preambleLines: string[];
  trailingLines: string[];
} | null {
  const items: BlockItemToken[] = [];
  const preambleLines: string[] = [];
  let pendingLines: string[] = [];
  let hasSeenItem = false;
  let sequenceIndent: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const itemMatch = /^(\s*)-(\s*)(.*)$/.exec(line);

    if (itemMatch == null && (trimmed.length === 0 || trimmed.startsWith("#"))) {
      if (hasSeenItem) {
        pendingLines.push(line);
      } else {
        preambleLines.push(line);
      }
      continue;
    }

    if (itemMatch != null) {
      const lineIndent = itemMatch[1];
      const dashSpace = itemMatch[2];
      const remainder = itemMatch[3];
      const { rawValue, inlineComment } = splitInlineComment(remainder);

      if (
        (dashSpace.length === 0 && remainder.length > 0) ||
        (sequenceIndent != null && lineIndent !== sequenceIndent) ||
        !isSupportedBlockScalar(rawValue)
      ) {
        return null;
      }

      hasSeenItem = true;
      sequenceIndent ??= lineIndent;

      items.push({
        leadingLines: pendingLines,
        lineIndent,
        dashSpace,
        originalLine: line,
        rawValue,
        scalar: parseScalar(rawValue),
        inlineComment,
        continuationLines: [],
      });
      pendingLines = [];
      continue;
    }

    // Any other indented content represents a nested mapping, sequence,
    // multiline scalar, or malformed YAML. This rewriter only handles flat
    // scalar sequences, so it must fail closed instead of moving fragments.
    return null;
  }

  return { items, preambleLines, trailingLines: pendingLines };
}

export function toBlockRenderContext(property: PropertyMatch): BlockRenderContext {
  if (property.kind === "block") {
    return property;
  }

  return {
    keyText: property.keyText,
    hasTrailingNewline: false,
    preambleLines: [],
    trailingLines: [],
    items: [],
    inlineComment: property.inlineComment,
  };
}

export function toBlockItemToken(
  item: PropertyItem,
  targetProperty: BlockRenderContext,
  preserveExistingStyle: boolean,
): BlockItemToken {
  const { lineIndent, dashSpace } = getBlockInsertionStyle(targetProperty);

  if (!("raw" in item)) {
    if (preserveExistingStyle && targetProperty.items.includes(item)) {
      return item;
    }

    const rawValue = item.rawValue.trim();

    return {
      ...item,
      lineIndent,
      dashSpace,
      originalLine: `${lineIndent}-${dashSpace}${rawValue}${item.inlineComment}`,
      rawValue,
    };
  }

  const rawValue = item.raw.trim();
  return {
    leadingLines: [],
    lineIndent,
    dashSpace,
    originalLine: `${lineIndent}-${dashSpace}${rawValue}`,
    rawValue,
    scalar: item.scalar,
    inlineComment: "",
    continuationLines: [],
  };
}

function isSupportedBlockScalar(raw: string): boolean {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return true;
  }

  if (trimmed.startsWith("'") || trimmed.startsWith("\"")) {
    return isValidQuotedScalar(trimmed);
  }

  if (/^(?:[\[\]{?}&*!|>]|-(?:\s|$))/.test(trimmed) || /[\[\]{}]/.test(trimmed)) {
    return false;
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const nextCharacter = trimmed[index + 1] ?? "";

    if (trimmed[index] === ":" && (nextCharacter.length === 0 || /\s/.test(nextCharacter))) {
      return false;
    }
  }

  return true;
}

export function renderBlockProperty(
  property: BlockRenderContext,
  items: BlockItemToken[],
  newline: string,
  writebackFormat: ListWritebackFormat,
): string {
  const renderedLines: string[] = [];
  renderedLines.push(`${property.keyText}: ${property.inlineComment.trimStart()}`.trimEnd());
  renderedLines.push(...property.preambleLines);

  for (const item of items) {
    renderedLines.push(...item.leadingLines);

    if (writebackFormat === "preserve") {
      renderedLines.push(item.originalLine);
      renderedLines.push(...item.continuationLines);
    } else {
      const renderedValue = serializeNormalizedScalar(item.scalar);
      renderedLines.push(`${item.lineIndent}-${item.dashSpace}${renderedValue}${item.inlineComment}`);
      renderedLines.push(...item.continuationLines);
    }
  }

  renderedLines.push(...property.trailingLines);
  const blockProperty = renderedLines.join(newline);
  return property.hasTrailingNewline ? `${blockProperty}${newline}` : blockProperty;
}

function getBlockInsertionStyle(property: BlockRenderContext): {
  dashSpace: string;
  lineIndent: string;
} {
  return {
    lineIndent: property.items[0]?.lineIndent ?? "  ",
    dashSpace: property.items[0]?.dashSpace ?? " ",
  };
}
