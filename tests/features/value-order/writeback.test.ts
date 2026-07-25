import type { Editor, EditorTransaction } from "obsidian";
import { describe, expect, it } from "vitest";

import type { PropertyPillContext } from "../../../src/obsidian/properties-dom";
import type { DropTarget } from "../../../src/features/value-order/types";
import { writePropertyValueDrop } from "../../../src/features/value-order/writeback";

function createContext(propertyKey: string, sourceIndex: number): PropertyPillContext {
  return {
    container: {} as HTMLElement,
    pill: {} as HTMLElement,
    pills: [],
    propertyElement: {} as HTMLElement,
    propertyKey,
    sourceIndex,
  };
}

function createTarget(propertyKey: string, mode: "reorder" | "move", slot: number): DropTarget {
  return {
    context: {
      container: {} as HTMLElement,
      pills: [],
      propertyElement: {} as HTMLElement,
      propertyKey,
    },
    kind: "drop",
    mode,
    slot,
  };
}

function createEditorWithCurrentContent(initialContent: string): {
  editor: Editor;
  getContent(): string;
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
      const change = transaction.changes?.[0];

      if (change == null) {
        return;
      }

      const fromOffset = positionToOffset(content, change.from);
      const toOffset = positionToOffset(content, change.to ?? change.from);
      content = content.slice(0, fromOffset) + change.text + content.slice(toOffset);
    },
  } as unknown as Editor;

  return { editor, getContent: () => content, transactions };
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
  it("fails safely when the drag-start content snapshot could not be read", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writePropertyValueDrop({
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

    const result = await writePropertyValueDrop({
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

  it("detects a source property conflict and preserves the latest content", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, changed]", "---", "latest body"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
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

      const result = await writePropertyValueDrop({
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

  it.each([
    ["boolean", { kind: "boolean", value: "true" } as const, '"true"'],
    ["null", { kind: "null", value: "null" } as const, '"null"'],
    ["number", { kind: "number", value: "1" } as const, '"1"'],
  ])(
    "detects a stale metadata snapshot when only the %s scalar type changed",
    async (_label, expectedScalar, currentScalar) => {
      const currentContent = ["---", `tags: [${currentScalar}, tail]`, "---"].join("\n");
      const fixture = createEditorWithCurrentContent(currentContent);

      const result = await writePropertyValueDrop({
        editor: fixture.editor,
        expectedContent: currentContent,
        expectedSourceValues: [
          expectedScalar,
          { kind: "string", value: "tail" },
        ],
        sourceContext: createContext("tags", 0),
        target: createTarget("tags", "reorder", 2),
        writebackFormat: "preserve",
      });

      expect(result).toEqual({ status: "conflict" });
      expect(fixture.getContent()).toBe(currentContent);
    },
  );

  it("detects a type-only target metadata conflict before a cross-property move", async () => {
    const currentContent = [
      "---",
      "source: [alpha]",
      'target: ["true"]',
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(currentContent);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent: currentContent,
      expectedSourceValues: [{ kind: "string", value: "alpha" }],
      expectedTargetValues: [{ kind: "boolean", value: "true" }],
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(currentContent);
  });

  it("accepts the metadata-cache null value for an unchanged implicit empty item", async () => {
    const content = ["---", "tags:", "  -", "  - other", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      expectedSourceValues: [
        { kind: "null", value: "null" },
        { kind: "string", value: "other" },
      ],
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags:", "  - other", "  -", "---"].join("\n"),
    );
  });

  it("accepts metadata-cache values for unchanged typed YAML scalars", async () => {
    const content = [
      "---",
      "tags: [TRUE, 0xFF, 1.50, .inf, .NaN, other]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent: content,
      expectedSourceValues: [
        { kind: "boolean", value: "true" },
        { kind: "number", value: "255" },
        { kind: "number", value: "1.5" },
        { kind: "number", value: "Infinity" },
        { kind: "number", value: "NaN" },
        { kind: "string", value: "other" },
      ],
      sourceContext: createContext("tags", 5),
      target: createTarget("tags", "reorder", 0),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags: [other, TRUE, 0xFF, 1.50, .inf, .NaN]", "---"].join("\n"),
    );
  });

  it("uses the metadata snapshot to reject stale property DOM", async () => {
    const latestContent = ["---", "tags: [external-alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent: latestContent,
      expectedSourceValues: [
        { kind: "string", value: "alpha" },
        { kind: "string", value: "beta" },
      ],
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("checks the target metadata snapshot before a cross-property move", async () => {
    const latestContent = [
      "---",
      "source: [alpha, beta]",
      "target: [external-gamma]",
      "---",
    ].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent: latestContent,
      expectedSourceValues: [
        { kind: "string", value: "alpha" },
        { kind: "string", value: "beta" },
      ],
      expectedTargetValues: [{ kind: "string", value: "gamma" }],
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("rebases the property rewrite onto the editor's latest content in one transaction", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, beta]", "---", "latest body"].join("\n");
    const fixture = createEditorWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags: [beta, alpha]", "---", "latest body"].join("\n"),
    );
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.transactions[0]?.origin).toBe("property-order-drag");
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

    const result = await writePropertyValueDrop({
      editor: fixture.editor,
      expectedContent,
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("skips a same-property noop without changing content", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createEditorWithCurrentContent(content);

    const result = await writePropertyValueDrop({
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

    const result = await writePropertyValueDrop({
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
