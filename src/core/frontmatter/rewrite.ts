import type {
  FrontmatterMoveOptions,
  FrontmatterReorderOptions,
  ListWritebackFormat,
} from "../../shared/types";
import {
  isSupportedBlockScalar,
  renderBlockProperty,
  parseBlockSequence,
  toBlockItemToken,
  toBlockRenderContext,
} from "./block-list";
import { detectNewline, extractFrontmatterBounds, getLineOffsets, splitLines } from "./bounds";
import { parseFlowSequence, renderFlowProperty, toFlowItemToken } from "./flow-list";
import { parseTopLevelPropertyLine } from "./property-line";
import {
  parseScalar,
  renderInlineComment,
  serializeNormalizedScalar,
  splitInlineComment,
  trimEndYamlSeparationWhitespace,
  trimStartYamlSeparationWhitespace,
  trimYamlSeparationWhitespace,
} from "./scalar";
import { normalizeTextListItems, textListItemValue } from "./text-list";
import type {
  FlowPropertyMatch,
  FrontmatterRewritePlan,
  FrontmatterScalar,
  ListItemToken,
  PropertyItem,
  PropertyMatch,
} from "./types";

export function reorderFrontmatterListProperty(
  content: string,
  options: FrontmatterReorderOptions,
): string | null {
  return planFrontmatterListPropertyReorder(content, options)?.content ?? null;
}

export function planFrontmatterListPropertyReorder(
  content: string,
  options: FrontmatterReorderOptions,
): FrontmatterRewritePlan | null {
  const frontmatter = extractFrontmatterBounds(content);

  if (frontmatter == null) {
    return null;
  }

  const property =
    findProperty(frontmatter.body, options.propertyKey) ??
    (options.normalizeAsTextList
      ? findCoercibleScalarProperty(frontmatter.body, options.propertyKey)
      : null);

  if (property == null || property.items.length === 0) {
    return null;
  }

  if (options.sourceIndex < 0 || options.sourceIndex >= property.items.length) {
    return null;
  }

  const normalizedTargetSlot = clamp(options.targetSlot, 0, property.items.length);
  const insertionIndex =
    normalizedTargetSlot > options.sourceIndex ? normalizedTargetSlot - 1 : normalizedTargetSlot;

  if (insertionIndex === options.sourceIndex) {
    return { changes: [], content };
  }

  const propertyItems = options.normalizeAsTextList
    ? normalizeTextListItems(property.items)
    : property.items;
  const renderedProperty = renderProperty(
    property,
    moveItem(propertyItems, options.sourceIndex, normalizedTargetSlot),
    frontmatter.newline,
    options.writebackFormat,
  );
  const replacementStart = frontmatter.bodyStart + property.start;
  const replacementEnd = frontmatter.bodyStart + property.end;

  return createRewritePlan(content, [
    { fromOffset: replacementStart, text: renderedProperty, toOffset: replacementEnd },
  ]);
}

export function moveFrontmatterListPropertyValue(
  content: string,
  options: FrontmatterMoveOptions,
): string | null {
  return planFrontmatterListPropertyMove(content, options)?.content ?? null;
}

export function planFrontmatterListPropertyMove(
  content: string,
  options: FrontmatterMoveOptions,
): FrontmatterRewritePlan | null {
  if (options.sourcePropertyKey === options.targetPropertyKey) {
    return planFrontmatterListPropertyReorder(content, {
      normalizeAsTextList: options.normalizeAsTextList,
      propertyKey: options.sourcePropertyKey,
      sourceIndex: options.sourceIndex,
      targetSlot: options.targetSlot,
      writebackFormat: options.writebackFormat,
    });
  }

  const frontmatter = extractFrontmatterBounds(content);

  if (frontmatter == null) {
    return null;
  }

  const sourceProperty =
    findProperty(frontmatter.body, options.sourcePropertyKey) ??
    (options.normalizeAsTextList
      ? findCoercibleScalarProperty(frontmatter.body, options.sourcePropertyKey)
      : null);
  const targetProperty =
    findProperty(frontmatter.body, options.targetPropertyKey) ??
    (options.normalizeAsTextList
      ? findCoercibleScalarProperty(frontmatter.body, options.targetPropertyKey)
      : null);

  if (
    sourceProperty == null ||
    targetProperty == null ||
    sourceProperty.items.length === 0 ||
    options.sourceIndex < 0 ||
    options.sourceIndex >= sourceProperty.items.length
  ) {
    return null;
  }

  const normalizedTargetSlot = clamp(options.targetSlot, 0, targetProperty.items.length);

  if (
    options.writebackFormat === "preserve" &&
    sourceProperty.kind === "block" &&
    targetProperty.kind === "flow"
  ) {
    const movedBlockItem = sourceProperty.items[options.sourceIndex];

    if (
      movedBlockItem != null &&
      (movedBlockItem.inlineComment.length > 0 || movedBlockItem.leadingLines.length > 0)
    ) {
      // Flow sequence items have no independent position for comments or
      // blank lines. Refuse the whole move instead of silently discarding
      // formatting attached to the moved block item.
      return null;
    }
  }

  const sourcePropertyItems = options.normalizeAsTextList
    ? normalizeTextListItems(sourceProperty.items)
    : sourceProperty.items;
  const targetPropertyItems = options.normalizeAsTextList
    ? normalizeTextListItems(targetProperty.items)
    : targetProperty.items;
  const movedItem = sourcePropertyItems[options.sourceIndex];
  const sourceItems = removeItem(sourcePropertyItems, options.sourceIndex);
  const sourceRendered =
    sourceItems.length === 0
      ? renderEmptyProperty(sourceProperty, frontmatter.newline, options.writebackFormat)
      : renderProperty(sourceProperty, sourceItems, frontmatter.newline, options.writebackFormat);
  const targetRendered = renderProperty(
    targetProperty,
    insertItem(targetPropertyItems, movedItem, normalizedTargetSlot),
    frontmatter.newline,
    options.writebackFormat,
  );

  return createPropertyRewritePlan(content, frontmatter.bodyStart, [
    { property: sourceProperty, renderedProperty: sourceRendered },
    { property: targetProperty, renderedProperty: targetRendered },
  ]);
}

function readListProperty(
  content: string,
  propertyKey: string,
  coerceScalarToList: boolean,
): PropertyMatch | null {
  const frontmatter = extractFrontmatterBounds(content);
  if (frontmatter == null) return null;
  return findProperty(frontmatter.body, propertyKey) ??
    (coerceScalarToList ? findCoercibleScalarProperty(frontmatter.body, propertyKey) : null);
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

export function getFrontmatterTextListProperty(content: string, propertyKey: string) {
  const property = readListProperty(content, propertyKey, true);
  return property == null ? null : {
    values: property.items.map(textListItemValue),
    scalars: property.items.map((item) => item.scalar),
  };
}

function findCoercibleScalarProperty(
  frontmatterBody: string,
  propertyKey: string,
): FlowPropertyMatch | null {
  const newline = detectNewline(frontmatterBody);
  const lines = splitLines(frontmatterBody, newline);
  const lineOffsets = getLineOffsets(lines, newline);

  if (!hasExactlyOneTopLevelProperty(lines, propertyKey)) {
    return null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const propertyLine = parseTopLevelPropertyLine(line);

    if (propertyLine == null || propertyLine.key !== propertyKey) {
      continue;
    }

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

export function findProperty(
  frontmatterBody: string,
  propertyKey: string,
): PropertyMatch | null {
  const newline = detectNewline(frontmatterBody);
  const lines = splitLines(frontmatterBody, newline);
  const lineOffsets = getLineOffsets(lines, newline);

  if (!hasExactlyOneTopLevelProperty(lines, propertyKey)) {
    return null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const propertyLine = parseTopLevelPropertyLine(line);

    if (propertyLine == null || propertyLine.key !== propertyKey) {
      continue;
    }

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
        hasTrailingNewline: frontmatterBody.slice(lineOffsets[index], endOffset).endsWith(newline),
        preambleLines,
        items,
        inlineComment,
      };
    }
  }

  return null;
}

function hasExactlyOneTopLevelProperty(lines: readonly string[], propertyKey: string): boolean {
  const root = lines.find((line) => !/^[ \t]*(?:#.*)?$/.test(line));
  // This rewriter owns column-zero keys in a block mapping. A flow root can
  // contain identical-looking lines at any nesting depth; converting one of
  // them to a block list can also make the surrounding YAML invalid.
  if (
    root == null ||
    /^[&*!|>%]|^[-?](?:[ \t]|$)/.test(root) ||
    parseTopLevelPropertyLine(root) == null
  ) {
    return false;
  }

  let count = 0;

  for (const line of lines) {
    if (parseTopLevelPropertyLine(line)?.key !== propertyKey) {
      continue;
    }

    count += 1;

    if (count > 1) {
      return false;
    }
  }

  return count === 1;
}

function isBlockSequenceItem(line: string): boolean {
  return /^[ \t]*-(?:[ \t]|$)/.test(line);
}

function renderProperty(
  property: PropertyMatch,
  items: PropertyItem[],
  newline: string,
  writebackFormat: ListWritebackFormat,
): string {
  if (writebackFormat === "flow" || (writebackFormat === "preserve" && property.kind === "flow")) {
    const renderedProperty = renderFlowProperty(
      property,
      items.map((item) => toFlowItemToken(item)),
      writebackFormat,
    );
    return property.kind === "block" && property.hasTrailingNewline
      ? `${renderedProperty}${newline}`
      : renderedProperty;
  }

  const blockContext = toBlockRenderContext(property);
  return renderBlockProperty(
    blockContext,
    items.map((item) =>
      toBlockItemToken(item, blockContext, writebackFormat === "preserve"),
    ),
    newline,
    writebackFormat,
  );
}

function renderEmptyProperty(
  property: PropertyMatch,
  newline: string,
  writebackFormat: ListWritebackFormat,
): string {
  if (writebackFormat === "block" || (writebackFormat === "preserve" && property.kind === "block")) {
    const renderedLines = [
      trimEndYamlSeparationWhitespace(
        `${property.keyText}: ${trimStartYamlSeparationWhitespace(property.inlineComment)}`,
      ),
    ];

    if (property.kind === "block") {
      renderedLines.push(...property.preambleLines);
    }

    const renderedProperty = renderedLines.join(newline);
    return property.kind === "block" && property.hasTrailingNewline
      ? `${renderedProperty}${newline}`
      : renderedProperty;
  }

  const renderedProperty = `${property.keyText}: []${renderInlineComment(
    property.inlineComment,
  )}`;
  return property.kind === "block" && property.hasTrailingNewline
    ? `${renderedProperty}${newline}`
    : renderedProperty;
}

function createPropertyRewritePlan(
  content: string,
  bodyStart: number,
  replacements: Array<{ property: PropertyMatch; renderedProperty: string }>,
): FrontmatterRewritePlan | null {
  return createRewritePlan(
    content,
    replacements.map((replacement) => ({
      fromOffset: bodyStart + replacement.property.start,
      text: replacement.renderedProperty,
      toOffset: bodyStart + replacement.property.end,
    })),
  );
}

function createRewritePlan(
  content: string,
  changes: FrontmatterRewritePlan["changes"],
): FrontmatterRewritePlan | null {
  const orderedChanges = changes.slice().sort((left, right) => left.fromOffset - right.fromOffset);

  if (
    orderedChanges.some(
      (change, index) =>
        !Number.isInteger(change.fromOffset) ||
        !Number.isInteger(change.toOffset) ||
        change.fromOffset < 0 ||
        change.toOffset < change.fromOffset ||
        change.toOffset > content.length ||
        (index > 0 &&
          (orderedChanges.at(index - 1)?.toOffset ?? Number.POSITIVE_INFINITY) >
            change.fromOffset),
    )
  ) {
    return null;
  }

  const nextContent = orderedChanges
    .slice()
    .reverse()
    .reduce(
      (result, change) =>
        `${result.slice(0, change.fromOffset)}${change.text}${result.slice(change.toOffset)}`,
      content,
    );

  return { changes: orderedChanges, content: nextContent };
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

function moveItem<T>(items: T[], fromIndex: number, targetSlot: number): T[] {
  const nextItems = items.slice();
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (movedItem == null) {
    return items.slice();
  }

  nextItems.splice(targetSlot > fromIndex ? targetSlot - 1 : targetSlot, 0, movedItem);
  return nextItems;
}

function removeItem<T>(items: T[], index: number): T[] {
  const nextItems = items.slice();
  nextItems.splice(index, 1);
  return nextItems;
}

function insertItem<T>(items: T[], item: T, targetSlot: number): T[] {
  const nextItems = items.slice();
  nextItems.splice(targetSlot, 0, item);
  return nextItems;
}
