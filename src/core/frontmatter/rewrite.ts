import type {
  FrontmatterMoveOptions,
  FrontmatterReorderOptions,
  ListWritebackFormat,
} from "../../shared/types";
import {
  renderBlockProperty,
  parseBlockSequence,
  toBlockItemToken,
  toBlockRenderContext,
} from "./block-list";
import { detectNewline, extractFrontmatterBounds, getLineOffsets, splitLines } from "./bounds";
import { parseFlowSequence, renderFlowProperty, toFlowItemToken } from "./flow-list";
import { parseTopLevelPropertyLine } from "./property-line";
import { renderInlineComment, splitInlineComment } from "./scalar";
import type { FrontmatterScalar, PropertyItem, PropertyMatch } from "./types";

export function reorderFrontmatterListProperty(
  content: string,
  options: FrontmatterReorderOptions,
): string | null {
  const frontmatter = extractFrontmatterBounds(content);

  if (frontmatter == null) {
    return null;
  }

  const property = findProperty(frontmatter.body, options.propertyKey);

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
    return content;
  }

  const propertyItems: PropertyItem[] = property.items;
  const renderedProperty = renderProperty(
    property,
    moveItem(propertyItems, options.sourceIndex, normalizedTargetSlot),
    frontmatter.newline,
    options.writebackFormat,
  );
  const replacementStart = frontmatter.bodyStart + property.start;
  const replacementEnd = frontmatter.bodyStart + property.end;

  return `${content.slice(0, replacementStart)}${renderedProperty}${content.slice(replacementEnd)}`;
}

export function moveFrontmatterListPropertyValue(
  content: string,
  options: FrontmatterMoveOptions,
): string | null {
  if (options.sourcePropertyKey === options.targetPropertyKey) {
    return reorderFrontmatterListProperty(content, {
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

  const sourceProperty = findProperty(frontmatter.body, options.sourcePropertyKey);
  const targetProperty = findProperty(frontmatter.body, options.targetPropertyKey);

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

  const sourcePropertyItems: PropertyItem[] = sourceProperty.items;
  const targetPropertyItems: PropertyItem[] = targetProperty.items;
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

  return replaceProperties(content, frontmatter.bodyStart, [
    { property: sourceProperty, renderedProperty: sourceRendered },
    { property: targetProperty, renderedProperty: targetRendered },
  ]);
}

export function getFrontmatterListPropertyValues(
  content: string,
  propertyKey: string,
): string[] | null {
  const frontmatter = extractFrontmatterBounds(content);
  const property = frontmatter == null ? null : findProperty(frontmatter.body, propertyKey);
  return property == null ? null : property.items.map((item) => item.scalar.value);
}

export function getFrontmatterListPropertyScalars(
  content: string,
  propertyKey: string,
): FrontmatterScalar[] | null {
  const frontmatter = extractFrontmatterBounds(content);
  const property = frontmatter == null ? null : findProperty(frontmatter.body, propertyKey);
  return property == null ? null : property.items.map((item) => item.scalar);
}

export function findProperty(
  frontmatterBody: string,
  propertyKey: string,
): PropertyMatch | null {
  const newline = detectNewline(frontmatterBody);
  const lines = splitLines(frontmatterBody, newline);
  const lineOffsets = getLineOffsets(lines, newline);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const propertyLine = parseTopLevelPropertyLine(line);

    if (propertyLine == null || propertyLine.key !== propertyKey) {
      continue;
    }

    const { keyText } = propertyLine;
    const propertyRest = propertyLine.restText.trim();
    const { rawValue: rawRestValue, inlineComment } = splitInlineComment(
      propertyRest,
      propertyRest.startsWith("[") ? "flow" : "scalar",
    );
    const rest = rawRestValue.trim();

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
      const blockLines: string[] = [];
      let blockEndLine = index + 1;

      while (blockEndLine < lines.length) {
        const candidate = lines[blockEndLine];

        if (candidate.length === 0 && blockEndLine === lines.length - 1) {
          break;
        }

        if (!isBlockSequenceItem(candidate) && parseTopLevelPropertyLine(candidate) != null) {
          break;
        }

        blockLines.push(candidate);
        blockEndLine += 1;
      }

      const parsedSequence = parseBlockSequence(blockLines);

      if (parsedSequence == null) {
        return null;
      }

      const { items, preambleLines, trailingLines } = parsedSequence;
      const endOffset =
        blockEndLine < lines.length ? lineOffsets[blockEndLine] : frontmatterBody.length;

      return {
        kind: "block",
        keyText,
        start: lineOffsets[index],
        end: endOffset,
        hasTrailingNewline: frontmatterBody.slice(lineOffsets[index], endOffset).endsWith(newline),
        preambleLines,
        trailingLines,
        items,
        inlineComment,
      };
    }
  }

  return null;
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
      `${property.keyText}: ${property.inlineComment.trimStart()}`.trimEnd(),
    ];

    if (writebackFormat === "preserve" && property.kind === "block") {
      renderedLines.push(...property.preambleLines, ...property.trailingLines);
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

function replaceProperties(
  content: string,
  bodyStart: number,
  replacements: Array<{ property: PropertyMatch; renderedProperty: string }>,
): string {
  return replacements
    .slice()
    .sort((left, right) => right.property.start - left.property.start)
    .reduce((nextContent, replacement) => {
      const start = bodyStart + replacement.property.start;
      const end = bodyStart + replacement.property.end;
      return `${nextContent.slice(0, start)}${replacement.renderedProperty}${nextContent.slice(end)}`;
    }, content);
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
