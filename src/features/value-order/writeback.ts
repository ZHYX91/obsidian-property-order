import type { Editor, EditorChange } from "obsidian";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyScalars,
  moveFrontmatterListPropertyValue,
  reorderFrontmatterListProperty,
  type FrontmatterScalar,
} from "../../core/frontmatter";
import type { TranslationKey } from "../../shared/i18n";
import type { ListWritebackFormat } from "../../shared/types";
import type { PropertyPillContext } from "../../obsidian/properties-dom";
import type { DropTarget } from "./types";

export type ValueWritebackResult =
  | { status: "conflict" }
  | { status: "diagnostic"; messageKey: TranslationKey }
  | { status: "skipped" }
  | { status: "written" };

interface ValueWritebackOptions {
  canWrite?: () => boolean;
  editor: Editor;
  expectedContent: string | null;
  expectedSourceValues?: readonly FrontmatterScalar[] | null;
  expectedTargetValues?: readonly FrontmatterScalar[] | null;
  sourceContext: PropertyPillContext;
  target: DropTarget;
  writebackFormat: ListWritebackFormat;
}

export async function writePropertyValueDrop(
  options: ValueWritebackOptions,
): Promise<ValueWritebackResult> {
  if (options.expectedContent == null || options.canWrite?.() === false) {
    return { status: "conflict" };
  }

  const expectedContent = options.expectedContent;
  const currentContent = options.editor.getValue();
  const hasSourceConflict =
    hasPropertyValuesChanged(
      expectedContent,
      currentContent,
      options.sourceContext.propertyKey,
    ) ||
    hasExpectedPropertyValuesChanged(
      options.expectedSourceValues,
      currentContent,
      options.sourceContext.propertyKey,
    );
  const hasTargetConflict =
    options.target.mode === "move" &&
    (hasPropertyValuesChanged(
      expectedContent,
      currentContent,
      options.target.context.propertyKey,
    ) ||
      hasExpectedPropertyValuesChanged(
        options.expectedTargetValues,
        currentContent,
        options.target.context.propertyKey,
      ));

  if (hasSourceConflict || hasTargetConflict || options.canWrite?.() === false) {
    return { status: "conflict" };
  }

  const nextContent =
    options.target.mode === "reorder"
      ? reorderFrontmatterListProperty(currentContent, {
          propertyKey: options.sourceContext.propertyKey,
          sourceIndex: options.sourceContext.sourceIndex,
          targetSlot: options.target.slot,
          writebackFormat: options.writebackFormat,
        })
      : moveFrontmatterListPropertyValue(currentContent, {
          sourcePropertyKey: options.sourceContext.propertyKey,
          targetPropertyKey: options.target.context.propertyKey,
          sourceIndex: options.sourceContext.sourceIndex,
          targetSlot: options.target.slot,
          writebackFormat: options.writebackFormat,
        });

  if (nextContent == null) {
    const diagnosticMessageKey = getWritebackFailureMessageKey(
      currentContent,
      options.sourceContext.propertyKey,
      options.target,
    );

    return diagnosticMessageKey == null
      ? { status: "skipped" }
      : { status: "diagnostic", messageKey: diagnosticMessageKey };
  }

  if (nextContent === currentContent) {
    return { status: "skipped" };
  }

  if (options.canWrite?.() === false || options.editor.getValue() !== currentContent) {
    return { status: "conflict" };
  }

  options.editor.transaction(
    { changes: [createMinimalEditorChange(options.editor, currentContent, nextContent)] },
    "property-order-drag",
  );
  return { status: "written" };
}

function createMinimalEditorChange(
  editor: Editor,
  currentContent: string,
  nextContent: string,
): EditorChange {
  let prefixLength = 0;
  const maximumPrefixLength = Math.min(currentContent.length, nextContent.length);

  while (
    prefixLength < maximumPrefixLength &&
    currentContent[prefixLength] === nextContent[prefixLength]
  ) {
    prefixLength += 1;
  }

  let currentSuffixStart = currentContent.length;
  let nextSuffixStart = nextContent.length;

  while (
    currentSuffixStart > prefixLength &&
    nextSuffixStart > prefixLength &&
    currentContent[currentSuffixStart - 1] === nextContent[nextSuffixStart - 1]
  ) {
    currentSuffixStart -= 1;
    nextSuffixStart -= 1;
  }

  return {
    from: editor.offsetToPos(prefixLength),
    to: editor.offsetToPos(currentSuffixStart),
    text: nextContent.slice(prefixLength, nextSuffixStart),
  };
}

function getDiagnosticMessageKey(
  diagnosis: ReturnType<typeof diagnoseFrontmatterReorder>,
): TranslationKey | null {
  return diagnosis === "no_frontmatter"
    ? "notice.noFrontmatter"
    : diagnosis === "property_not_found"
      ? "notice.propertyNotFound"
      : diagnosis === "unsupported_property"
        ? "notice.unsupportedProperty"
        : null;
}

function getWritebackFailureMessageKey(
  content: string,
  sourcePropertyKey: string,
  target: DropTarget,
): TranslationKey | null {
  const sourceDiagnosis = diagnoseFrontmatterReorder(content, sourcePropertyKey);

  if (target.mode === "reorder" || sourceDiagnosis !== "ok") {
    return getDiagnosticMessageKey(sourceDiagnosis);
  }

  const targetDiagnosis = diagnoseFrontmatterReorder(content, target.context.propertyKey);
  return getDiagnosticMessageKey(targetDiagnosis) ?? "notice.unsupportedProperty";
}

function hasPropertyValuesChanged(
  expectedContent: string,
  currentContent: string,
  propertyKey: string,
): boolean {
  const expectedValues = getFrontmatterListPropertyScalars(expectedContent, propertyKey);

  if (expectedValues == null) {
    return false;
  }

  const currentValues = getFrontmatterListPropertyScalars(currentContent, propertyKey);
  return !arePropertyValuesEqual(expectedValues, currentValues);
}

function hasExpectedPropertyValuesChanged(
  expectedValues: readonly FrontmatterScalar[] | null | undefined,
  currentContent: string,
  propertyKey: string,
): boolean {
  if (expectedValues == null) {
    return false;
  }

  const currentValues = getFrontmatterListPropertyScalars(currentContent, propertyKey);
  return !arePropertyValuesEqual(expectedValues, currentValues);
}

function arePropertyValuesEqual(
  expectedValues: readonly FrontmatterScalar[],
  currentValues: readonly FrontmatterScalar[] | null,
): boolean {
  return (
    currentValues != null &&
    currentValues.length === expectedValues.length &&
    expectedValues.every((scalar, index) => {
      const currentScalar = currentValues[index];
      return currentScalar?.kind === scalar.kind && currentScalar.value === scalar.value;
    })
  );
}
