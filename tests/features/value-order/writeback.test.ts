// @vitest-environment happy-dom

import type { Editor, EditorTransaction } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { PropertyPillContext } from "../../../src/obsidian/properties-dom";
import type { DropTarget } from "../../../src/features/value-order/types";
import { writePropertyValueDrop } from "../../../src/features/value-order/writeback";

type WritebackOptions = Parameters<typeof writePropertyValueDrop>[0];

function writeTestPropertyValueDrop(
  options: Omit<WritebackOptions, "view">,
  viewOverrides: Partial<WritebackOptions["view"]> = {},
): ReturnType<typeof writePropertyValueDrop> {
  const view = Object.assign({
    containerEl: document.createElement("div"),
    getViewData: () => options.editor.getValue(),
    requestSave: vi.fn(),
    setViewData: vi.fn(),
  }, viewOverrides) as unknown as WritebackOptions["view"];

  return writePropertyValueDrop({ ...options, view });
}

function createContext(propertyKey: string, sourceIndex: number): PropertyPillContext {
  return {
    container: {} as HTMLElement,
    editorKind: "multi-select",
    pill: {} as HTMLElement,
    pills: [],
    propertyElement: document.createElement("div"),
    propertyKey,
    sourceIndex,
  };
}

function createTarget(
  propertyKey: string,
  mode: "reorder" | "move",
  slot: number | "append",
): DropTarget {
  return {
    context: {
      container: {} as HTMLElement,
      editorKind: "multi-select",
      pills: [],
      propertyElement: {} as HTMLElement,
      propertyKey,
    },
    kind: "drop",
    mode,
    slot,
  };
}

function createEditorWithCurrentContent(
  initialContent: string,
  applyTransaction: boolean | ((transactionIndex: number) => boolean) = true,
): {
  editor: Editor;
  getContent(): string;
  setContent(content: string): void;
  transactions: Array<{ origin: string | undefined; transaction: EditorTransaction }>;
} {
  let content = initialContent;
  const transactions: Array<{
    origin: string | undefined;
    transaction: EditorTransaction;
  }> = [];
  const editor = {
    getValue: () => content,
    offsetToPos: (offset: number) => {
      const lines = content.slice(0, offset).split("\n");
      return { line: lines.length - 1, ch: lines.at(-1)?.length ?? 0 };
    },
    transaction: (transaction: EditorTransaction, origin?: string) => {
      transactions.push({ origin, transaction });
      const changes = transaction.changes;

      const shouldApply =
        typeof applyTransaction === "function"
          ? applyTransaction(transactions.length - 1)
          : applyTransaction;

      if (changes == null || !shouldApply) {
        return;
      }

      const resolvedChanges = changes.map((change) => ({
        fromOffset: positionToOffset(content, change.from),
        text: change.text,
        toOffset: positionToOffset(content, change.to ?? change.from),
      }));
      content = resolvedChanges
        .slice()
        .sort((left, right) => right.fromOffset - left.fromOffset)
        .reduce(
          (result, change) =>
            `${result.slice(0, change.fromOffset)}${change.text}${result.slice(change.toOffset)}`,
          content,
        );
    },
  } as unknown as Editor;

  return {
    editor,
    getContent: () => content,
    setContent: (nextContent) => {
      content = nextContent;
    },
    transactions,
  };
}

function positionToOffset(
  content: string,
  position: { ch: number; line: number },
): number {
  const lines = content.split("\n");
  let offset = 0;

  for (let line = 0; line < position.line; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }

  return offset + position.ch;
}

describe("writePropertyValueDrop", () => {
  it("reports failure when the host editor ignores the transaction", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content, false);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "failed",
      reason: "transaction-ignored",
    });
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.getContent()).toBe(content);
  });

  it("fails safely when the drag-start content snapshot could not be read", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: null,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(content);
  });

  it("rechecks the lifecycle guard immediately before the editor transaction", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    let guardChecks = 0;

    const result = await writeTestPropertyValueDrop({
      canWrite: () => {
        guardChecks += 1;
        return guardChecks < 3;
      },
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(content);
    expect(fixture.transactions).toEqual([]);
  });

  it("reports an aborted finalization after the atomic editor commit", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      canFinalize: () => false,
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "aborted",
      committedContent: ["---", "tags: [beta, alpha]", "---"].join("\n"),
    });
    expect(fixture.transactions).toHaveLength(1);
  });

  it("distinguishes persistence scheduling failure from content divergence", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const expectedContent = ["---", "tags: [beta, alpha]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await writeTestPropertyValueDrop(
      {
        editor: fixture.editor,
        expectedContent: content,
        sourceContext: createContext("tags", 0),
        target: createTarget("tags", "reorder", 2),
        writebackFormat: "preserve",
      },
      {
        requestSave: () => {
          throw new Error("save scheduling rejected");
        },
      },
    );

    expect(result).toEqual({
      status: "persistence-failed",
      changedPropertyKeys: ["tags"],
      committedContent: expectedContent,
      previousContent: content,
    });
    expect(fixture.getContent()).toBe(expectedContent);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("detects a source property conflict and preserves the latest content", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, changed]", "---", "latest body"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it.each([
    ["boolean", "true", '"true"'],
    ["null", "null", '"null"'],
    ["number", "1", '"1"'],
    ["infinity", ".inf", "Infinity"],
    ["NaN", ".nan", "NaN"],
  ])(
    "detects a source conflict when only the %s scalar type changed",
    async (_label, expectedScalar, currentScalar) => {
      const expectedContent = ["---", `tags: [${expectedScalar}, tail]`, "---"].join("\n");
      const latestContent = ["---", `tags: [${currentScalar}, tail]`, "---"].join("\n");
      const fixture = createEditorWithCurrentContent(latestContent);

      const result = await writeTestPropertyValueDrop({
        editor: fixture.editor,
        expectedContent,
        sourceContext: createContext("tags", 0),
        target: createTarget("tags", "reorder", 2),
        writebackFormat: "preserve",
      });

      expect(result).toEqual({ status: "conflict" });
      expect(fixture.getContent()).toBe(latestContent);
    },
  );

  it("normalizes an unchanged implicit empty list item", async () => {
    const content = ["---", "tags:", "  -", "  - other", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags:", "  - other", '  - ""', "---"].join("\n"),
    );
  });

  it("normalizes unchanged typed YAML scalars from their source spelling", async () => {
    const content = [
      "---",
      "tags: [TRUE, 0xFF, 1.50, .inf, .NaN, other]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 5),
      target: createTarget("tags", "reorder", 0),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      [
        "---",
        'tags: [other, "TRUE", "0xFF", "1.50", ".inf", ".NaN"]',
        "---",
      ].join("\n"),
    );
  });

  it("moves a scalar-backed source value out through the host list editor", async () => {
    const content = ["---", "source: 123", "target: [beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", "append"),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "source: []", 'target: [beta, "123"]', "---"].join("\n"),
    );
  });

  it("detects a scalar-backed source change before moving it out", async () => {
    const expectedContent = ["---", "source: 123", "target: [beta]", "---"].join("\n");
    const latestContent = ["---", "source: 124", "target: [beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
    expect(fixture.transactions).toHaveLength(0);
  });

  it("rebases the property rewrite onto the editor's latest content in one transaction", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, beta]", "---", "latest body"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags: [beta, alpha]", "---", "latest body"].join("\n"),
    );
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.transactions[0]?.origin).toBe("set");
    expect(fixture.transactions[0]?.transaction.changes).toHaveLength(1);
  });

  it("checks both properties before a cross-property move", async () => {
    const expectedContent = [
      "---",
      "source: [alpha, beta]",
      "target: [gamma]",
      "---",
    ].join("\n");
    const latestContent = [
      "---",
      "source: [alpha, beta]",
      "target: [changed]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("coerces a scalar target selected through the host list editor", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: existing",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "source: [beta]", "target: [existing, alpha]", "---"].join("\n"),
    );
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.transactions[0]?.origin).toBe("set");
    expect(fixture.transactions[0]?.transaction.changes).toHaveLength(2);
  });

  it("commits a cross-property move as one public transaction with two exact changes", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const expectedContent = [
      "---",
      "source: [beta]",
      "target: [existing, alpha]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "written",
      changedPropertyKeys: ["source", "target"],
      committedContent: expectedContent,
      previousContent: content,
    });
    expect(fixture.getContent()).toBe(expectedContent);
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.transactions[0]?.transaction.changes).toHaveLength(2);
    expect(
      fixture.transactions[0]?.transaction.changes?.map((change) => change.from.line),
    ).toEqual([1, 2]);
  });

  it.each([
    [
      "preserve" as const,
      [
        "---",
        'source: ["123"] # source comment',
        "unrelated: keep",
        'target: ["TRUE", beta, alpha] # target comment',
        "---",
        "Unsaved body text",
      ].join("\n"),
    ],
    [
      "flow" as const,
      [
        "---",
        'source: ["123"] # source comment',
        "unrelated: keep",
        'target: ["TRUE", beta, alpha] # target comment',
        "---",
        "Unsaved body text",
      ].join("\n"),
    ],
    [
      "block" as const,
      [
        "---",
        "source: # source comment",
        '  - "123"',
        "unrelated: keep",
        "target: # target comment",
        '  - "TRUE"',
        "  - beta",
        "  - alpha",
        "---",
        "Unsaved body text",
      ].join("\n"),
    ],
  ])(
    "preserves the exact planned %s representation and unsaved body in one move transaction",
    async (writebackFormat, expectedContent) => {
      const content = [
        "---",
        "source: [alpha, 123] # source comment",
        "unrelated: keep",
        "target: [TRUE, beta] # target comment",
        "---",
        "Unsaved body text",
      ].join("\n");
      const fixture = createEditorWithCurrentContent(content);

      const result = await writeTestPropertyValueDrop({
        editor: fixture.editor,
        expectedContent: content,
        sourceContext: createContext("source", 0),
        target: createTarget("target", "move", 2),
        writebackFormat,
      });

      expect(result).toEqual({
        status: "written",
        changedPropertyKeys: ["source", "target"],
        committedContent: expectedContent,
        previousContent: content,
      });
      expect(fixture.getContent()).toBe(expectedContent);
      expect(fixture.transactions).toHaveLength(1);
      expect(fixture.transactions[0]?.transaction.changes).toHaveLength(2);
    },
  );

  it("reports divergence when the host applies only one change from the transaction", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content, false);
    fixture.editor.transaction = vi.fn((transaction: EditorTransaction, origin?: string) => {
      fixture.transactions.push({ origin, transaction });
      const change = transaction.changes?.[0];

      if (change == null) {
        return;
      }

      const currentContent = fixture.getContent();
      const fromOffset = positionToOffset(currentContent, change.from);
      const toOffset = positionToOffset(currentContent, change.to ?? change.from);
      fixture.setContent(
        `${currentContent.slice(0, fromOffset)}${change.text}${currentContent.slice(toOffset)}`,
      );
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "diverged",
      actualContent: fixture.getContent(),
    });
    expect(fixture.getContent()).not.toBe(content);
    expect(fixture.getContent()).not.toBe(
      ["---", "source: [beta]", "target: [existing, alpha]", "---"].join("\n"),
    );
    expect(fixture.transactions).toHaveLength(1);
  });

  it("reports divergence when the host applies one change and then throws", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content, false);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fixture.editor.transaction = vi.fn((transaction: EditorTransaction, origin?: string) => {
      fixture.transactions.push({ origin, transaction });
      const change = transaction.changes?.[0];

      if (change != null) {
        const currentContent = fixture.getContent();
        const fromOffset = positionToOffset(currentContent, change.from);
        const toOffset = positionToOffset(currentContent, change.to ?? change.from);
        fixture.setContent(
          `${currentContent.slice(0, fromOffset)}${change.text}${currentContent.slice(toOffset)}`,
        );
      }

      throw new Error("host threw after a partial commit");
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "diverged",
      actualContent: fixture.getContent(),
    });
    expect(fixture.getContent()).not.toBe(content);
    expect(fixture.transactions).toHaveLength(1);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("reports divergence instead of accepting host-normalized serialization", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const hostContent = [
      "---",
      "source:",
      "  - beta",
      "target:",
      "  - existing",
      "  - alpha",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    fixture.editor.transaction = vi.fn(() => fixture.setContent(hostContent));

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "diverged", actualContent: hostContent });
    expect(fixture.getContent()).toBe(hostContent);
  });

  it("distinguishes a thrown transaction that leaves the editor unchanged", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fixture.editor.transaction = vi.fn(() => {
      throw new Error("host rejected transaction");
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "failed",
      reason: "transaction-threw",
    });
    expect(fixture.getContent()).toBe(content);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("fails safely when editor positions cannot be resolved", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(fixture.editor, "offsetToPos").mockImplementation(() => {
      throw new Error("position resolution failed");
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "failed",
      reason: "position-resolution-threw",
    });
    expect(fixture.getContent()).toBe(content);
    expect(fixture.transactions).toHaveLength(0);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("accepts an exact commit even when the host throws after applying it", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const expectedContent = [
      "---",
      "source: [beta]",
      "target: [existing, alpha]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const applyTransaction = fixture.editor.transaction.bind(fixture.editor);
    fixture.editor.transaction = vi.fn((transaction: EditorTransaction, origin?: string) => {
      applyTransaction(transaction, origin);
      throw new Error("host threw after commit");
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "written",
      changedPropertyKeys: ["source", "target"],
      committedContent: expectedContent,
      previousContent: content,
    });
    expect(fixture.getContent()).toBe(expectedContent);
    expect(fixture.transactions).toHaveLength(1);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("detects a host rollback scheduled after a synchronous transaction", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    const applyTransaction = fixture.editor.transaction.bind(fixture.editor);
    fixture.editor.transaction = vi.fn((transaction: EditorTransaction, origin?: string) => {
      applyTransaction(transaction, origin);
      window.setTimeout(() => fixture.setContent(content), 0);
    });

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "failed",
      reason: "transaction-ignored",
    });
    expect(fixture.getContent()).toBe(content);
    expect(fixture.transactions).toHaveLength(1);
  });

  it("captures the lifecycle guard once before a synchronous multi-property write", async () => {
    const content = [
      "---",
      "source: [alpha, beta]",
      "target: [existing]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);
    let guardChecks = 0;

    const result = await writeTestPropertyValueDrop({
      canWrite: () => {
        guardChecks += 1;
        return guardChecks < 4;
      },
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toMatchObject({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "source: [beta]", "target: [existing, alpha]", "---"].join("\n"),
    );
    expect(fixture.transactions).toHaveLength(1);
    expect(guardChecks).toBe(3);
  });

  it("detects a scalar target change before coercing it into a list", async () => {
    const expectedContent = [
      "---",
      "source: [alpha]",
      "target: existing",
      "---",
    ].join("\n");
    const latestContent = [
      "---",
      "source: [alpha]",
      "target: externally changed",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
    expect(fixture.transactions).toHaveLength(0);
  });

  it("skips a same-property noop without changing content", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "skipped" });
    expect(fixture.getContent()).toBe(content);
  });

  it("reports unsupported when a preserving move would discard block-item formatting", async () => {
    const content = [
      "---",
      "source:",
      "  - retained",
      "  # keep with alpha",
      "  - alpha",
      "target: [beta]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writeTestPropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({
      status: "diagnostic",
      messageKey: "notice.unsupportedProperty",
    });
    expect(fixture.getContent()).toBe(content);
  });
});
