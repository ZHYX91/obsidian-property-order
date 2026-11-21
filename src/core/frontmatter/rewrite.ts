import type {
  FrontmatterMoveOptions,
  FrontmatterReorderOptions,
  ListWritebackFormat,
} from "../../shared/types";
import {
  renderBlockProperty,
  toBlockItemToken,
  toBlockRenderContext,
} from "./block-list";
import { extractFrontmatterBounds } from "./bounds";
import { renderFlowProperty, toFlowItemToken } from "./flow-list";
import { indexFrontmatterProperties } from "./property-reader";
import {
  renderInlineComment,
  trimEndYamlSeparationWhitespace,
  trimStartYamlSeparationWhitespace,
} from "./scalar";
import { normalizeTextListItems } from "./text-list";
import type {
  FrontmatterRewritePlan,
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

  const property = indexFrontmatterProperties(frontmatter.body)(options.propertyKey, options.normalizeAsTextList);

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
  return createPropertyRewritePlan(content, frontmatter.bodyStart, [{ property, renderedProperty }]);
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

  const lookup = indexFrontmatterProperties(frontmatter.body);
  const sourceProperty = lookup(options.sourcePropertyKey, options.normalizeAsTextList);
  const targetProperty = lookup(options.targetPropertyKey, options.normalizeAsTextList);

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
    replacements.map(({ property, renderedProperty }) => {
      const fromOffset = bodyStart + property.start;
      const toOffset = bodyStart + property.end;
      const original = content.slice(fromOffset, toOffset);
      const breaks = original.match(/\r\n|[\r\n]/gu) ?? [];
      const after = content.startsWith("\r\n", toOffset) ? "\r\n" : content.charAt(toOffset);
      let cursor = 0;
      // Keep existing physical separators. Added lines follow the local convention,
      // and the last boundary still separates the rewritten block from the next key.
      const text = renderedProperty.replace(/\r\n|[\r\n]/gu, (newline, offset: number) => {
        if (offset + newline.length === renderedProperty.length && breaks.length > 0) return breaks.at(-1)!;
        return breaks[cursor++] ?? breaks.at(-1) ?? (after === "\n" || after === "\r" || after === "\r\n" ? after : newline);
      });
      return { fromOffset, text, toOffset };
    }),
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
