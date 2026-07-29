import type { Editor, EditorChange, MarkdownView } from "obsidian";

const HIDDEN_FRONTMATTER_COMPATIBILITY_ORIGIN = "set";

export type EditorTransactionCommitResult =
  | { status: "aborted"; actualContent: string }
  | { status: "committed"; transactionThrew: boolean }
  | { status: "diverged"; actualContent: string }
  | { status: "ignored"; transactionThrew: boolean }
  | { status: "persistence-failed"; actualContent: string };

interface EditorTransactionCommitOptions {
  canFinalize?: () => boolean;
  changes: readonly EditorChange[];
  editor: Editor;
  expectedContent: string;
  originalContent: string;
  view: MarkdownView;
}

/**
 * Commits one atomic edit through Obsidian's public editor and schedules the
 * owning view for persistence only after the resulting buffer is exact.
 *
 * Obsidian 1.12.x filters hidden-frontmatter transactions against the old
 * frontmatter boundary unless the transaction carries the host's `set`
 * compatibility origin. That origin does not schedule the normal view save,
 * so both details stay encapsulated here instead of leaking into feature code.
 */
export async function commitHiddenFrontmatterEditorTransaction(
  options: EditorTransactionCommitOptions,
): Promise<EditorTransactionCommitResult> {
  let transactionThrew = false;

  try {
    options.editor.transaction(
      { changes: [...options.changes] },
      HIDDEN_FRONTMATTER_COMPATIBILITY_ORIGIN,
    );
  } catch (error) {
    transactionThrew = true;
    console.warn("Property Order: editor transaction threw during value drag", error);
  }

  await waitForEditorSettlement(options.view);

  const actualContent = options.editor.getValue();

  if (actualContent === options.expectedContent) {
    if (options.canFinalize?.() === false) {
      return { status: "aborted", actualContent };
    }

    try {
      options.view.setViewData(options.expectedContent, false);
    } catch (error) {
      console.warn("Property Order: failed to reload Properties after value drag", error);
    }

    const reloadedContent = options.editor.getValue();

    if (reloadedContent !== options.expectedContent) {
      return { status: "diverged", actualContent: reloadedContent };
    }

    if (options.canFinalize?.() === false) {
      return { status: "aborted", actualContent: reloadedContent };
    }

    try {
      options.view.requestSave();
    } catch (error) {
      console.warn("Property Order: failed to request persistence after value drag", error);
      return { status: "persistence-failed", actualContent: reloadedContent };
    }

    return { status: "committed", transactionThrew };
  }

  return actualContent === options.originalContent
    ? { status: "ignored", transactionThrew }
    : { status: "diverged", actualContent };
}

function waitForEditorSettlement(view: MarkdownView): Promise<void> {
  const targetWindow = view.containerEl.ownerDocument.defaultView;

  if (targetWindow == null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => targetWindow.setTimeout(resolve, 0));
}
