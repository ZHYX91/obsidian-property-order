// @vitest-environment happy-dom

import type {
  Editor,
  EditorChange,
  EditorPosition,
  EditorTransaction,
  MarkdownView,
} from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { commitHiddenFrontmatterEditorTransaction } from "../../src/obsidian/editor-transaction";

interface RecordedTransaction {
  origin: string | undefined;
  transaction: EditorTransaction;
}

type HostBehavior = "accept-set" | "commit-then-throw" | "ignore" | "partial";

interface EditorHarness {
  editor: Editor;
  getContent(): string;
  transactions: RecordedTransaction[];
}

interface ViewHarness {
  getViewData: ReturnType<typeof vi.fn>;
  requestSave: ReturnType<typeof vi.fn>;
  setViewData: ReturnType<typeof vi.fn>;
  view: MarkdownView;
}

const originalContent = "AA11BB22CC";

const twoChanges: EditorChange[] = [
  { from: { ch: 2, line: 0 }, text: "xy", to: { ch: 4, line: 0 } },
  { from: { ch: 6, line: 0 }, text: "zz", to: { ch: 8, line: 0 } },
];

describe("hidden-frontmatter editor transactions", () => {
  it.each([
    {
      changes: [
        { from: { ch: 2, line: 0 }, text: "", to: { ch: 4, line: 0 } },
        { from: { ch: 6, line: 0 }, text: "Z", to: { ch: 8, line: 0 } },
      ],
      expectedContent: "AABBZCC",
      netDelta: "negative",
    },
    {
      changes: twoChanges,
      expectedContent: "AAxyBBzzCC",
      netDelta: "zero",
    },
    {
      changes: [
        { from: { ch: 2, line: 0 }, text: "1234", to: { ch: 4, line: 0 } },
        { from: { ch: 6, line: 0 }, text: "wxyz", to: { ch: 8, line: 0 } },
      ],
      expectedContent: "AA1234BBwxyzCC",
      netDelta: "positive",
    },
  ])(
    "commits one atomic multi-change transaction with a $netDelta text delta",
    async ({ changes, expectedContent }) => {
      const editorHarness = createEditorHarness(originalContent, "accept-set");
      const viewHarness = createViewHarness(editorHarness.getContent);

      await expect(
        commitHiddenFrontmatterEditorTransaction({
          changes,
          editor: editorHarness.editor,
          expectedContent,
          originalContent,
          view: viewHarness.view,
        }),
      ).resolves.toEqual({ status: "committed", transactionThrew: false });

      expect(editorHarness.getContent()).toBe(expectedContent);
      expect(editorHarness.transactions).toHaveLength(1);
      expect(editorHarness.transactions[0]).toEqual({
        origin: "set",
        transaction: { changes },
      });
      expect(viewHarness.setViewData).toHaveBeenCalledOnce();
      expect(viewHarness.setViewData).toHaveBeenCalledWith(expectedContent, false);
      expect(viewHarness.requestSave).toHaveBeenCalledOnce();
    },
  );

  it("reports an exact set transaction ignored by the host", async () => {
    const editorHarness = createEditorHarness(originalContent, "ignore");
    const viewHarness = createViewHarness(editorHarness.getContent);

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({ status: "ignored", transactionThrew: false });

    expect(editorHarness.transactions).toHaveLength(1);
    expect(editorHarness.transactions[0]?.origin).toBe("set");
    expect(editorHarness.getContent()).toBe(originalContent);
    expect(viewHarness.setViewData).not.toHaveBeenCalled();
    expect(viewHarness.requestSave).not.toHaveBeenCalled();
  });

  it("reports a partially applied transaction as diverged", async () => {
    const editorHarness = createEditorHarness(originalContent, "partial");
    const viewHarness = createViewHarness(editorHarness.getContent);

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({ status: "diverged", actualContent: "AAxyBB22CC" });

    expect(editorHarness.transactions).toHaveLength(1);
    expect(editorHarness.transactions[0]?.origin).toBe("set");
    expect(viewHarness.setViewData).not.toHaveBeenCalled();
    expect(viewHarness.requestSave).not.toHaveBeenCalled();
  });

  it("accepts an exact commit even when the host throws after applying it", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const editorHarness = createEditorHarness(originalContent, "commit-then-throw");
    const viewHarness = createViewHarness(editorHarness.getContent);

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({ status: "committed", transactionThrew: true });

    expect(editorHarness.getContent()).toBe("AAxyBBzzCC");
    expect(editorHarness.transactions).toHaveLength(1);
    expect(viewHarness.setViewData).toHaveBeenCalledWith("AAxyBBzzCC", false);
    expect(viewHarness.requestSave).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("reports persistence scheduling failure after an exact commit", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const editorHarness = createEditorHarness(originalContent, "accept-set");
    const requestSave = vi.fn(() => {
      throw new Error("save scheduling rejected");
    });
    const viewHarness = createViewHarness(editorHarness.getContent, requestSave);

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({
      status: "persistence-failed",
      actualContent: "AAxyBBzzCC",
    });

    expect(editorHarness.getContent()).toBe("AAxyBBzzCC");
    expect(viewHarness.setViewData).toHaveBeenCalledWith("AAxyBBzzCC", false);
    expect(viewHarness.requestSave).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("does not reconcile or schedule a save after the owning view becomes stale", async () => {
    const editorHarness = createEditorHarness(originalContent, "accept-set");
    const viewHarness = createViewHarness(editorHarness.getContent);

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        canFinalize: () => false,
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({ status: "aborted", actualContent: "AAxyBBzzCC" });

    expect(editorHarness.getContent()).toBe("AAxyBBzzCC");
    expect(viewHarness.setViewData).not.toHaveBeenCalled();
    expect(viewHarness.requestSave).not.toHaveBeenCalled();
  });

  it("rechecks ownership after reconciliation before scheduling persistence", async () => {
    const editorHarness = createEditorHarness(originalContent, "accept-set");
    const viewHarness = createViewHarness(editorHarness.getContent);
    let canFinalize = true;
    viewHarness.setViewData.mockImplementation(() => {
      canFinalize = false;
    });

    await expect(
      commitHiddenFrontmatterEditorTransaction({
        canFinalize: () => canFinalize,
        changes: twoChanges,
        editor: editorHarness.editor,
        expectedContent: "AAxyBBzzCC",
        originalContent,
        view: viewHarness.view,
      }),
    ).resolves.toEqual({ status: "aborted", actualContent: "AAxyBBzzCC" });

    expect(viewHarness.setViewData).toHaveBeenCalledWith("AAxyBBzzCC", false);
    expect(viewHarness.requestSave).not.toHaveBeenCalled();
  });
});

function createEditorHarness(initialContent: string, behavior: HostBehavior): EditorHarness {
  let content = initialContent;
  const transactions: RecordedTransaction[] = [];
  const editor = {
    getValue: () => content,
    transaction: (transaction: EditorTransaction, origin?: string) => {
      transactions.push({ origin, transaction });
      const changes = transaction.changes ?? [];

      // This models Obsidian's hidden-frontmatter compatibility guard: the
      // transaction is admitted by its exact origin, independently of change
      // count or whether the combined edit grows or shrinks the document.
      if (origin !== "set" || behavior === "ignore") {
        return;
      }

      content = applyAtomicChanges(
        content,
        behavior === "partial" ? changes.slice(0, 1) : changes,
      );

      if (behavior === "commit-then-throw") {
        throw new Error("host threw after committing");
      }
    },
  } as unknown as Editor;

  return { editor, getContent: () => content, transactions };
}

function createViewHarness(
  getContent: () => string,
  requestSave = vi.fn(),
): ViewHarness {
  const getViewData = vi.fn(getContent);
  const setViewData = vi.fn((_content: string, _clear: boolean) => undefined);
  const view = {
    containerEl: document.createElement("div"),
    getViewData,
    requestSave,
    setViewData,
  } as unknown as MarkdownView;

  return { getViewData, requestSave, setViewData, view };
}

function applyAtomicChanges(content: string, changes: readonly EditorChange[]): string {
  const resolvedChanges = changes.map((change) => ({
    fromOffset: positionToOffset(content, change.from),
    text: change.text,
    toOffset: positionToOffset(content, change.to ?? change.from),
  }));

  return resolvedChanges
    .slice()
    .sort((left, right) => right.fromOffset - left.fromOffset)
    .reduce(
      (result, change) =>
        `${result.slice(0, change.fromOffset)}${change.text}${result.slice(change.toOffset)}`,
      content,
    );
}

function positionToOffset(content: string, position: EditorPosition): number {
  const lines = content.split("\n");
  let offset = 0;

  for (let line = 0; line < position.line; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }

  return offset + position.ch;
}
