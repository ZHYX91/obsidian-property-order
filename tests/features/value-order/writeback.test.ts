import type { Plugin, TFile } from "obsidian";
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

function createPluginWithCurrentContent(initialContent: string): {
  getContent(): string;
  plugin: Plugin;
} {
  let content = initialContent;
  const plugin = {
    app: {
      vault: {
        process: async (_file: TFile, transform: (currentContent: string) => string) => {
          content = transform(content);
          return content;
        },
      },
    },
  } as unknown as Plugin;

  return { plugin, getContent: () => content };
}

describe("writePropertyValueDrop", () => {
  it("fails safely when the drag-start content snapshot could not be read", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createPluginWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      expectedContent: null,
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(content);
  });

  it("rechecks the lifecycle guard inside a delayed vault transform", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    let currentContent = content;
    let canWrite = true;
    let runTransform!: () => void;
    const plugin = {
      app: {
        vault: {
          process: (_file: TFile, transform: (value: string) => string) =>
            new Promise<void>((resolve) => {
              runTransform = () => {
                currentContent = transform(currentContent);
                resolve();
              };
            }),
        },
      },
    } as unknown as Plugin;

    const resultPromise = writePropertyValueDrop({
      canWrite: () => canWrite,
      expectedContent: content,
      file: {} as TFile,
      plugin,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });
    canWrite = false;
    runTransform();

    await expect(resultPromise).resolves.toEqual({ status: "skipped" });
    expect(currentContent).toBe(content);
  });

  it("detects a source property conflict and preserves the latest content", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, changed]", "---", "latest body"].join("\n");
    const fixture = createPluginWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      expectedContent,
      file: {} as TFile,
      plugin: fixture.plugin,
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
      const fixture = createPluginWithCurrentContent(latestContent);

      const result = await writePropertyValueDrop({
        expectedContent,
        file: {} as TFile,
        plugin: fixture.plugin,
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
      const fixture = createPluginWithCurrentContent(currentContent);

      const result = await writePropertyValueDrop({
        expectedContent: currentContent,
        expectedSourceValues: [
          expectedScalar,
          { kind: "string", value: "tail" },
        ],
        file: {} as TFile,
        plugin: fixture.plugin,
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
    const fixture = createPluginWithCurrentContent(currentContent);

    const result = await writePropertyValueDrop({
      expectedContent: currentContent,
      expectedSourceValues: [{ kind: "string", value: "alpha" }],
      expectedTargetValues: [{ kind: "boolean", value: "true" }],
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("source", 0),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(currentContent);
  });

  it("accepts the metadata-cache null value for an unchanged implicit empty item", async () => {
    const content = ["---", "tags:", "  -", "  - other", "---"].join("\n");
    const fixture = createPluginWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      expectedContent: content,
      expectedSourceValues: [
        { kind: "null", value: "null" },
        { kind: "string", value: "other" },
      ],
      file: {} as TFile,
      plugin: fixture.plugin,
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
    const fixture = createPluginWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      expectedContent: content,
      expectedSourceValues: [
        { kind: "boolean", value: "true" },
        { kind: "number", value: "255" },
        { kind: "number", value: "1.5" },
        { kind: "number", value: "Infinity" },
        { kind: "number", value: "NaN" },
        { kind: "string", value: "other" },
      ],
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("tags", 5),
      target: createTarget("tags", "reorder", 0),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags: [other, TRUE, 0xFF, 1.50, .inf, .NaN]", "---"].join("\n"),
    );
  });

  it("uses the synchronous metadata snapshot when the async read resolves late", async () => {
    const latestContent = ["---", "tags: [external-alpha, beta]", "---"].join("\n");
    const fixture = createPluginWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      expectedContent: latestContent,
      expectedSourceValues: [
        { kind: "string", value: "alpha" },
        { kind: "string", value: "beta" },
      ],
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("checks a synchronous target snapshot when the async read resolves late", async () => {
    const latestContent = [
      "---",
      "source: [alpha, beta]",
      "target: [external-gamma]",
      "---",
    ].join("\n");
    const fixture = createPluginWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      expectedContent: latestContent,
      expectedSourceValues: [
        { kind: "string", value: "alpha" },
        { kind: "string", value: "beta" },
      ],
      expectedTargetValues: [{ kind: "string", value: "gamma" }],
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("rebases the property rewrite onto vault.process latest content", async () => {
    const expectedContent = ["---", "tags: [alpha, beta]", "---", "old body"].join("\n");
    const latestContent = ["---", "tags: [alpha, beta]", "---", "latest body"].join("\n");
    const fixture = createPluginWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      expectedContent,
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("tags", 0),
      target: createTarget("tags", "reorder", 2),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "written" });
    expect(fixture.getContent()).toBe(
      ["---", "tags: [beta, alpha]", "---", "latest body"].join("\n"),
    );
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
    const fixture = createPluginWithCurrentContent(latestContent);

    const result = await writePropertyValueDrop({
      expectedContent,
      file: {} as TFile,
      plugin: fixture.plugin,
      sourceContext: createContext("source", 1),
      target: createTarget("target", "move", 1),
      writebackFormat: "preserve",
    });

    expect(result).toEqual({ status: "conflict" });
    expect(fixture.getContent()).toBe(latestContent);
  });

  it("skips a same-property noop without changing content", async () => {
    const content = ["---", "tags: [alpha, beta]", "---"].join("\n");
    const fixture = createPluginWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      expectedContent: content,
      file: {} as TFile,
      plugin: fixture.plugin,
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
    const fixture = createPluginWithCurrentContent(content);

    const result = await writePropertyValueDrop({
      expectedContent: content,
      file: {} as TFile,
      plugin: fixture.plugin,
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
