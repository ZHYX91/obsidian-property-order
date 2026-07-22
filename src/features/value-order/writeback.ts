import type { Plugin, TFile } from "obsidian";

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
  expectedContent: string | null;
  expectedSourceValues?: readonly FrontmatterScalar[] | null;
  expectedTargetValues?: readonly FrontmatterScalar[] | null;
  file: TFile;
  plugin: Plugin;
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
  let didWriteback = false;
  let conflictDetected = false;
  let diagnosticMessageKey: TranslationKey | null = null;

  await options.plugin.app.vault.process(options.file, (currentContent) => {
    if (options.canWrite?.() === false) {
      return currentContent;
    }

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

    if (hasSourceConflict || hasTargetConflict) {
      conflictDetected = true;
      return currentContent;
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
      diagnosticMessageKey = getWritebackFailureMessageKey(
        currentContent,
        options.sourceContext.propertyKey,
        options.target,
      );
      return currentContent;
    }

    didWriteback ||= nextContent !== currentContent;
    return nextContent;
  });

  if (conflictDetected) {
    return { status: "conflict" };
  }

  if (!didWriteback && diagnosticMessageKey != null) {
    return { status: "diagnostic", messageKey: diagnosticMessageKey };
  }

  return didWriteback ? { status: "written" } : { status: "skipped" };
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
