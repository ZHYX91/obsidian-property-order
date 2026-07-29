import type { Editor, MarkdownView } from "obsidian";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyScalars,
  planFrontmatterListPropertyMove,
  planFrontmatterListPropertyReorder,
  type FrontmatterScalar,
} from "../../core/frontmatter";
import type { TranslationKey } from "../../shared/i18n";
import type { ListWritebackFormat } from "../../shared/types";
import { commitHiddenFrontmatterEditorTransaction } from "../../obsidian/editor-transaction";
import type { PropertyPillContext } from "../../obsidian/properties-dom";
import type { DropTarget } from "./types";

export type ValueWritebackResult =
  | { status: "aborted"; committedContent: string }
  | { status: "conflict" }
  | { status: "diagnostic"; messageKey: TranslationKey }
  | {
      status: "failed";
      reason: "position-resolution-threw" | "transaction-ignored" | "transaction-threw";
    }
  | { status: "diverged"; actualContent: string }
  | { status: "persistence-failed"; committedContent: string }
  | { status: "skipped" }
  | {
      status: "written";
      changedPropertyKeys: readonly string[];
      committedContent: string;
    };

interface ValueWritebackOptions {
  canFinalize?: () => boolean;
  canWrite?: () => boolean;
  editor: Editor;
  expectedContent: string | null;
  sourceContext: PropertyPillContext;
  target: DropTarget;
  view: MarkdownView;
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
      true,
    );
  const hasTargetConflict =
    options.target.mode === "move" &&
    hasPropertyValuesChanged(
      expectedContent,
      currentContent,
      options.target.context.propertyKey,
      true,
    );

  if (hasSourceConflict || hasTargetConflict || options.canWrite?.() === false) {
    return { status: "conflict" };
  }

  const targetSlot =
    options.target.slot === "append"
      ? (getFrontmatterListPropertyScalars(
          currentContent,
          options.target.context.propertyKey,
          true,
        )?.length ?? 0)
      : options.target.slot;

  const rewritePlan =
    options.target.mode === "reorder"
      ? planFrontmatterListPropertyReorder(currentContent, {
          normalizeAsTextList: true,
          propertyKey: options.sourceContext.propertyKey,
          sourceIndex: options.sourceContext.sourceIndex,
          targetSlot,
          writebackFormat: options.writebackFormat,
        })
      : planFrontmatterListPropertyMove(currentContent, {
          normalizeAsTextList: true,
          sourcePropertyKey: options.sourceContext.propertyKey,
          targetPropertyKey: options.target.context.propertyKey,
          sourceIndex: options.sourceContext.sourceIndex,
          targetSlot,
          writebackFormat: options.writebackFormat,
        });

  if (rewritePlan == null) {
    const diagnosticMessageKey = getWritebackFailureMessageKey(
      currentContent,
      options.sourceContext.propertyKey,
      options.target,
    );

    return diagnosticMessageKey == null
      ? { status: "skipped" }
      : { status: "diagnostic", messageKey: diagnosticMessageKey };
  }

  const nextContent = rewritePlan.content;

  if (nextContent === currentContent) {
    return { status: "skipped" };
  }

  const changedPropertyKeys =
    options.target.mode === "reorder"
      ? [options.sourceContext.propertyKey]
      : [options.sourceContext.propertyKey, options.target.context.propertyKey];

  if (options.canWrite?.() === false || options.editor.getValue() !== currentContent) {
    return { status: "conflict" };
  }

  let changes: Array<{
    from: ReturnType<Editor["offsetToPos"]>;
    text: string;
    to: ReturnType<Editor["offsetToPos"]>;
  }>;

  try {
    changes = rewritePlan.changes
      .slice()
      .sort((left, right) => left.fromOffset - right.fromOffset)
      .map((change) => ({
        from: options.editor.offsetToPos(change.fromOffset),
        text: change.text,
        to: options.editor.offsetToPos(change.toOffset),
      }));
  } catch (error) {
    console.warn("Property Order: failed to resolve editor positions for value drag", error);
    return { status: "failed", reason: "position-resolution-threw" };
  }

  const commitResult = await commitHiddenFrontmatterEditorTransaction({
    canFinalize: options.canFinalize,
    changes,
    editor: options.editor,
    expectedContent: nextContent,
    originalContent: currentContent,
    view: options.view,
  });

  if (commitResult.status === "committed") {
    return {
      status: "written",
      changedPropertyKeys,
      committedContent: nextContent,
    };
  }

  if (commitResult.status === "ignored") {
    return {
      status: "failed",
      reason: commitResult.transactionThrew ? "transaction-threw" : "transaction-ignored",
    };
  }

  if (commitResult.status === "aborted") {
    return { status: "aborted", committedContent: commitResult.actualContent };
  }

  if (commitResult.status === "persistence-failed") {
    return {
      status: "persistence-failed",
      committedContent: commitResult.actualContent,
    };
  }

  return { status: "diverged", actualContent: commitResult.actualContent };
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
  coerceScalarToList = false,
): boolean {
  const expectedValues = getFrontmatterListPropertyScalars(
    expectedContent,
    propertyKey,
    coerceScalarToList,
  );

  if (expectedValues == null) {
    return false;
  }

  const currentValues = getFrontmatterListPropertyScalars(
    currentContent,
    propertyKey,
    coerceScalarToList,
  );
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
