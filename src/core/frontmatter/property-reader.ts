import { isSupportedBlockScalar, parseBlockSequence } from "./block-list";
import { extractFrontmatterBounds, physicalLines } from "./bounds";
import { parseFlowSequence } from "./flow-list";
import { parseTopLevelPropertyLine, type PropertyLine } from "./property-line";
import { parseScalar, serializeNormalizedScalar, splitInlineComment, trimYamlSeparationWhitespace } from "./scalar";
import { textListItemValue } from "./text-list";
import type { FrontmatterScalar, ListItemToken, PropertyMatch } from "./types";

interface IndexedKey {
  readonly index: number;
  readonly propertyLine: PropertyLine;
}

/** One index belongs to one immutable YAML body. Duplicate keys cannot be edited. */
export function indexFrontmatterProperties(body: string) {
  const lines: string[] = [];
  const lineOffsets: number[] = [];
  for (const { text, start } of physicalLines(body)) {
    lines.push(text);
    lineOffsets.push(start);
  }
  const keys = new Map<string, IndexedKey | null>();
  const root = lines.find((line) => !/^[ \t]*(?:#.*)?$/.test(line));
  if (root !== undefined && !/^[&*!|>%]|^[-?](?:[ \t]|$)/.test(root) && parseTopLevelPropertyLine(root) !== null) {
    for (const [index, line] of lines.entries()) {
      const propertyLine = parseTopLevelPropertyLine(line);
      if (propertyLine !== null) {
        keys.set(propertyLine.key, keys.has(propertyLine.key) ? null : { index, propertyLine });
      }
    }
  }
  return (key: string, coerceScalarToList = false): PropertyMatch | null => {
    const location = keys.get(key);
    if (location == null) return null;
    const list = parseListAt(body, lines, lineOffsets, location);
    if (list !== null || !coerceScalarToList) return list;
    return parseScalarAt(lines, lineOffsets, location);
  };
}

function readListProperty(content: string, key: string, coerceScalarToList: boolean): PropertyMatch | null {
  const frontmatter = extractFrontmatterBounds(content);
  return frontmatter === null ? null : indexFrontmatterProperties(frontmatter.body)(key, coerceScalarToList);
}

export function createTextListReader(content: string) {
  const frontmatter = extractFrontmatterBounds(content);
  const lookup = frontmatter === null ? null : indexFrontmatterProperties(frontmatter.body);
  return (key: string) => {
    const property = lookup?.(key, true);
    return property == null ? null : {
      values: property.items.map(textListItemValue),
      scalars: property.items.map((item) => item.scalar),
    };
  };
}

export function getFrontmatterTextListProperty(content: string, propertyKey: string) {
  return createTextListReader(content)(propertyKey);
}

export function getFrontmatterListPropertyValues(
  content: string,
  propertyKey: string,
  coerceScalarToList = false,
): string[] | null {
  return readListProperty(content, propertyKey, coerceScalarToList)?.items.map((item) => item.scalar.value) ?? null;
}

export function getFrontmatterListPropertyScalars(
  content: string,
  propertyKey: string,
  coerceScalarToList = false,
): FrontmatterScalar[] | null {
  return readListProperty(content, propertyKey, coerceScalarToList)?.items.map((item) => item.scalar) ?? null;
}

export function getFrontmatterTextListPropertyValues(content: string, propertyKey: string): string[] | null {
  return readListProperty(content, propertyKey, true)?.items.map(textListItemValue) ?? null;
}

function parseScalarAt(lines: string[], lineOffsets: number[], { index, propertyLine }: IndexedKey): PropertyMatch | null {
  const line = lines[index];
  const { rawValue, inlineComment } = splitInlineComment(trimYamlSeparationWhitespace(propertyLine.restText));
  const rawScalar = trimYamlSeparationWhitespace(rawValue);

  if (
    rawScalar.length === 0 ||
    !isSupportedBlockScalar(rawScalar) ||
    !hasSingleLineScalarValue(lines, index)
  ) {
    return null;
  }

  const scalar = parseScalar(rawScalar);
  const items = scalar.kind === "null" ? [] : [toSafeFlowItem(rawScalar, scalar)];

  return {
    kind: "flow",
    keyText: propertyLine.keyText,
    start: lineOffsets[index],
    end: lineOffsets[index] + line.length,
    items,
    inlineComment,
  };
}

function parseListAt(
  frontmatterBody: string, lines: string[], lineOffsets: number[],
  { index, propertyLine }: IndexedKey,
): PropertyMatch | null {
  const line = lines[index];
  const { keyText } = propertyLine;
  const propertyRest = trimYamlSeparationWhitespace(propertyLine.restText);
  const { rawValue: rawRestValue, inlineComment } = splitInlineComment(
    propertyRest,
    propertyRest.startsWith("[") ? "flow" : "scalar",
  );
  const rest = trimYamlSeparationWhitespace(rawRestValue);

  if (rest.startsWith("[") && rest.endsWith("]")) {
    const items = parseFlowSequence(rest);

    if (items == null) {
      return null;
    }

    return {
      kind: "flow",
      keyText,
      start: lineOffsets[index],
      end: lineOffsets[index] + line.length,
      items,
      inlineComment,
    };
  }

  if (rest.length === 0 || rest.startsWith("#")) {
    let blockEndLine = index + 1;

    while (blockEndLine < lines.length) {
      const candidate = lines[blockEndLine];

      if (candidate.length === 0 && blockEndLine === lines.length - 1) {
        break;
      }

      if (!isBlockSequenceItem(candidate) && parseTopLevelPropertyLine(candidate) != null) {
        break;
      }

      blockEndLine += 1;
    }

    // A standalone comment or blank line after the last item may belong to
    // the next key or the document. Keep that suffix outside the edit range.
    while (blockEndLine > index + 1 && /^[ \t]*(?:#|$)/.test(lines[blockEndLine - 1])) {
      blockEndLine -= 1;
    }

    const parsedSequence = parseBlockSequence(lines.slice(index + 1, blockEndLine));

    if (parsedSequence == null) {
      return null;
    }

    const { items, preambleLines } = parsedSequence;
    const endOffset =
      blockEndLine < lines.length ? lineOffsets[blockEndLine] : frontmatterBody.length;

    return {
      kind: "block",
      keyText,
      start: lineOffsets[index],
      end: endOffset,
      hasTrailingNewline: /[\r\n]/u.test(frontmatterBody.charAt(endOffset - 1)),
      preambleLines,
      items,
      inlineComment,
    };
  }
  return null;
}

function hasSingleLineScalarValue(lines: readonly string[], propertyLineIndex: number): boolean {
  for (let index = propertyLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = trimYamlSeparationWhitespace(line);

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    // Plain scalars can continue on later lines. Do not treat their first
    // line as the full value, including when checking a drag for conflicts.
    return !isBlockSequenceItem(line) && parseTopLevelPropertyLine(line) != null;
  }

  return true;
}

function toSafeFlowItem(rawScalar: string, scalar: FrontmatterScalar): ListItemToken {
  const parsedItems = parseFlowSequence(`[${rawScalar}]`);
  const parsedItem = parsedItems?.length === 1 ? parsedItems[0] : null;

  return parsedItem != null && areScalarsEqual(parsedItem.scalar, scalar)
    ? parsedItem
    : { raw: serializeNormalizedScalar(scalar), scalar };
}

function areScalarsEqual(left: FrontmatterScalar, right: FrontmatterScalar): boolean {
  return left.kind === right.kind && left.value === right.value;
}

function isBlockSequenceItem(line: string): boolean {
  return /^[ \t]*-(?:[ \t]|$)/.test(line);
}
