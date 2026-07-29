import { describe, expect, it } from "vitest";

import {
  getFrontmatterTextListPropertyValues,
  moveFrontmatterListPropertyValue,
  planFrontmatterListPropertyMove,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

describe("Obsidian text-list normalization", () => {
  it("extracts the original text identity used to align Properties with YAML", () => {
    const input = ["---", "flow: [0xFF, TRUE, null, '123']", "scalar: 1.50", "---"].join(
      "\n",
    );

    expect(getFrontmatterTextListPropertyValues(input, "flow")).toEqual([
      "0xFF",
      "TRUE",
      "null",
      "123",
    ]);
    expect(getFrontmatterTextListPropertyValues(input, "scalar")).toEqual(["1.50"]);
  });

  it("plans two ordered non-overlapping property changes from one source snapshot", () => {
    const input = [
      "---",
      "source: [alpha, 123] # source comment",
      "unrelated: keep",
      "target: [TRUE, beta] # target comment",
      "---",
      "Unsaved body text",
    ].join("\n");

    const plan = planFrontmatterListPropertyMove(input, {
      normalizeAsTextList: true,
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(plan).not.toBeNull();
    expect(plan?.changes).toHaveLength(2);
    const [first, second] = plan?.changes ?? [];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.fromOffset).toBeLessThanOrEqual(first?.toOffset ?? -1);
    expect(first?.toOffset).toBeLessThanOrEqual(second?.fromOffset ?? -1);

    const applied = (plan?.changes ?? [])
      .slice()
      .reverse()
      .reduce(
        (content, change) =>
          `${content.slice(0, change.fromOffset)}${change.text}${content.slice(change.toOffset)}`,
        input,
      );
    expect(applied).toBe(plan?.content);
    expect(plan?.content).toContain("unrelated: keep");
    expect(plan?.content.endsWith("Unsaved body text")).toBe(true);
  });

  it("keeps physical change order when the target precedes the source in BOM CRLF content", () => {
    const input = [
      "\uFEFF---",
      "target: [existing]",
      "middle: untouched",
      "source: [alpha, beta]",
      "---",
      "Body",
    ].join("\r\n");
    const plan = planFrontmatterListPropertyMove(input, {
      normalizeAsTextList: true,
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(plan?.changes).toHaveLength(2);
    const [targetChange, sourceChange] = plan?.changes ?? [];
    expect(input.slice(targetChange?.fromOffset, targetChange?.toOffset)).toBe(
      "target: [existing]",
    );
    expect(input.slice(sourceChange?.fromOffset, sourceChange?.toOffset)).toBe(
      "source: [alpha, beta]",
    );
    expect(targetChange?.toOffset).toBeLessThanOrEqual(sourceChange?.fromOffset ?? -1);
    expect(plan?.content).toBe(
      [
        "\uFEFF---",
        "target: [existing, alpha]",
        "middle: untouched",
        "source: [beta]",
        "---",
        "Body",
      ].join("\r\n"),
    );
  });

  it("normalizes every flow item during a successful same-property reorder", () => {
    const input = [
      "---",
      'item: [alpha, 123, TRUE, null, "123"]',
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      normalizeAsTextList: true,
      propertyKey: "item",
      sourceIndex: 0,
      targetSlot: 5,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", 'item: ["123", "TRUE", "null", "123", alpha]', "---"].join("\n"),
    );
  });

  it("normalizes block items while preserving item comments and existing string quotes", () => {
    const input = [
      "---",
      "item:",
      "  - alpha",
      "  - # empty",
      "  - 0xFF # hex",
      "  - '0xFF'",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      normalizeAsTextList: true,
      propertyKey: "item",
      sourceIndex: 0,
      targetSlot: 4,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "item:",
        '  - "" # empty',
        '  - "0xFF" # hex',
        "  - '0xFF'",
        "  - alpha",
        "---",
      ].join("\n"),
    );
  });

  it("normalizes both properties even when the moved value is already a string", () => {
    const input = [
      "---",
      "source: [alpha, 0xFF]",
      "target: [TRUE, beta]",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      normalizeAsTextList: true,
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", 'source: ["0xFF"]', 'target: ["TRUE", beta, alpha]', "---"].join("\n"),
    );
  });

  it("moves a scalar-backed list value out and leaves an empty list", () => {
    const input = ["---", "source: 0xFF", "target: [beta]", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      normalizeAsTextList: true,
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "source: []", 'target: [beta, "0xFF"]', "---"].join("\n"),
    );
  });

  it("applies the configured block format to scalar-backed source and target properties", () => {
    const input = ["---", "source: TRUE", "target: 123", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      normalizeAsTextList: true,
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "block",
    });

    expect(output).toBe(
      ["---", "source:", "target:", '  - "123"', '  - "TRUE"', "---"].join("\n"),
    );
  });

  it.each([
    [
      "flow" as const,
      ["---", 'source: ["123"]', 'target: ["TRUE", beta, alpha]', "---"].join("\n"),
    ],
    [
      "block" as const,
      [
        "---",
        "source:",
        '  - "123"',
        "target:",
        '  - "TRUE"',
        "  - beta",
        "  - alpha",
        "---",
      ].join("\n"),
    ],
  ])("applies the configured %s format to both affected lists", (writebackFormat, expected) => {
    const input = [
      "---",
      "source: [alpha, 123]",
      "target: [TRUE, beta]",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        normalizeAsTextList: true,
        sourcePropertyKey: "source",
        targetPropertyKey: "target",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat,
      }),
    ).toBe(expected);
  });

  it("does not normalize a same-property no-op", () => {
    const input = ["---", "item: [123, alpha]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        normalizeAsTextList: true,
        propertyKey: "item",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBe(input);
  });

  it("fails closed when the affected property key is duplicated", () => {
    const input = ["---", "item: [alpha]", "item: [beta]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        normalizeAsTextList: true,
        propertyKey: "item",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });

  it("fails closed for a complex scalar-backed source", () => {
    const input = [
      "---",
      "source: {name: nested}",
      "target: [beta]",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        normalizeAsTextList: true,
        sourcePropertyKey: "source",
        targetPropertyKey: "target",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });
});
