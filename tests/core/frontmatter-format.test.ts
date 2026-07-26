import { describe, expect, it } from "vitest";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyScalars,
  getFrontmatterListPropertyValues,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

describe("reorderFrontmatterListProperty normalized formats", () => {
  it("rewrites a block list as a flow list when requested", () => {
    const input = ["---", "tags:", "  -    alpha", "  - beta", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "flow",
    });

    expect(output).toBe(["---", "tags: [beta, alpha]", "---"].join("\n"));
  });

  it("drops block-only formatting when rewriting a block list as a flow list", () => {
    const input = [
      "---",
      "tags:",
      "  - alpha # A",
      "",
      "  # pinned",
      "  - beta",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "flow",
    });

    expect(output).toBe(["---", "tags: [beta, alpha]", "---"].join("\n"));
  });

  it("keeps a safe separator before a block head comment when writing a flow list", () => {
    const input = ["---", "tags: # note", "  - alpha", "  - beta", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "flow",
    });

    expect(output).toBe(["---", "tags: [beta, alpha] # note", "---"].join("\n"));
  });

  it("normalizes item text when writing a flow list", () => {
    const input = ["---", 'item: [alpha, \'two words\', "three:value"]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 0,
      targetSlot: 3,
      writebackFormat: "flow",
    });

    expect(output).toBe(["---", 'item: ["two words", "three:value", alpha]', "---"].join("\n"));
  });

  it("preserves typed plain scalars while quoting ambiguous strings in flow format", () => {
    const input = ["---", "item: [123, 2026-07-04, true, null, safe-value]", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 4,
      targetSlot: 0,
      writebackFormat: "flow",
    });

    expect(output).toBe(
      ["---", 'item: [safe-value, 123, "2026-07-04", true, null]', "---"].join("\n"),
    );
  });

  it("preserves scalar kinds when forcing a flow list into block format", () => {
    const input = [
      "---",
      'item: [TRUE, "true", NULL, "null", 0xFF, "255", .inf, ".inf", .NaN, ".NaN", other]',
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 10,
      targetSlot: 0,
      writebackFormat: "block",
    });

    expect(output).toBe(
      [
        "---",
        "item:",
        "  - other",
        "  - true",
        '  - "true"',
        "  - null",
        '  - "null"',
        "  - 255",
        '  - "255"',
        "  - .inf",
        '  - ".inf"',
        "  - .nan",
        '  - ".NaN"',
        "---",
      ].join("\n"),
    );
    expect(getFrontmatterListPropertyScalars(output ?? "", "item")).toEqual([
      { kind: "string", value: "other" },
      { kind: "boolean", value: "true" },
      { kind: "string", value: "true" },
      { kind: "null", value: "null" },
      { kind: "string", value: "null" },
      { kind: "number", value: "255" },
      { kind: "string", value: "255" },
      { kind: "number", value: "Infinity" },
      { kind: "string", value: ".inf" },
      { kind: "number", value: "NaN" },
      { kind: "string", value: ".NaN" },
    ]);
  });

  it("preserves scalar kinds when forcing a block list into flow format", () => {
    const input = [
      "---",
      "item:",
      "  - FALSE",
      '  - "false"',
      "  - ~",
      '  - "null"',
      "  - 0o17",
      '  - "15"',
      "  - -.Inf",
      '  - "-.Inf"',
      "  - .NaN",
      '  - ".NaN"',
      "  - other",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 10,
      targetSlot: 0,
      writebackFormat: "flow",
    });

    expect(output).toBe(
      [
        "---",
        'item: [other, false, "false", null, "null", 15, "15", -.inf, "-.Inf", .nan, ".NaN"]',
        "---",
      ].join("\n"),
    );
    expect(getFrontmatterListPropertyScalars(output ?? "", "item")).toEqual([
      { kind: "string", value: "other" },
      { kind: "boolean", value: "false" },
      { kind: "string", value: "false" },
      { kind: "null", value: "null" },
      { kind: "string", value: "null" },
      { kind: "number", value: "15" },
      { kind: "string", value: "15" },
      { kind: "number", value: "-Infinity" },
      { kind: "string", value: "-.Inf" },
      { kind: "number", value: "NaN" },
      { kind: "string", value: ".NaN" },
    ]);
  });

  it("keeps YAML numeric-looking text values quoted during normalized writeback", () => {
    const input = [
      "---",
      'item: ["1e3", "0xFF", "0o17", ".inf", ".NaN", "-", safe-value]',
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 6,
      targetSlot: 0,
      writebackFormat: "flow",
    });

    expect(output).toBe(
      [
        "---",
        'item: [safe-value, "1e3", "0xFF", "0o17", ".inf", ".NaN", "-"]',
        "---",
      ].join("\n"),
    );
  });

  it("decodes YAML-only double-quoted escapes before normalized writeback", () => {
    const input = ["---", 'item: ["\\x41", "\\N", safe]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "flow",
    });

    expect(output).toBe(["---", 'item: [safe, A, "\\u0085"]', "---"].join("\n"));
  });

  it("decodes YAML x, u, U, and named double-quoted escapes", () => {
    const input = [
      "---",
      'item: ["\\x41", "\\u0042", "\\U0001F600", "\\N", "\\_", "\\L", "\\P"]',
      "---",
    ].join("\n");

    expect(getFrontmatterListPropertyValues(input, "item")).toEqual([
      "A",
      "B",
      "😀",
      "\u0085",
      "\u00a0",
      "\u2028",
      "\u2029",
    ]);
  });

  it("matches Obsidian metadata values for YAML core-schema plain scalars", () => {
    const input = [
      "---",
      "item: [null, Null, NULL, ~, true, True, TRUE, false, False, FALSE, 01, +2, -0, 0o17, 0xFF, 1.50, .5, 1e3, .inf, -.Inf, .NaN, 0b10, 1_000]",
      "---",
    ].join("\n");

    expect(getFrontmatterListPropertyValues(input, "item")).toEqual([
      "null",
      "null",
      "null",
      "null",
      "true",
      "true",
      "true",
      "false",
      "false",
      "false",
      "1",
      "2",
      "0",
      "15",
      "255",
      "1.5",
      "0.5",
      "1000",
      "Infinity",
      "-Infinity",
      "NaN",
      "0b10",
      "1_000",
    ]);
  });

  it("preserves YAML core-schema scalar spelling during preserve writeback", () => {
    const input = ["---", "item: [TRUE, 0xFF, 1.50, other]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "item",
        sourceIndex: 3,
        targetSlot: 0,
        writebackFormat: "preserve",
      }),
    ).toBe(["---", "item: [other, TRUE, 0xFF, 1.50]", "---"].join("\n"));
  });

  it.each(["\\q", "\\x4", "\\uD800", "\\U00110000"])(
    "fails closed for invalid YAML double-quoted escape %s",
    (escape) => {
      const input = ["---", `item: ["${escape}", safe]`, "---"].join("\n");

      expect(getFrontmatterListPropertyValues(input, "item")).toBeNull();
      expect(diagnoseFrontmatterReorder(input, "item")).toBe("unsupported_property");
    },
  );

  it.each([
    "item: [''', safe]",
    ["item:", "  - '''", "  - safe"].join("\n"),
  ])("fails closed for an unterminated single-quoted scalar: %s", (propertyText) => {
    const input = ["---", propertyText, "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "item")).toBeNull();
    expect(diagnoseFrontmatterReorder(input, "item")).toBe("unsupported_property");
  });

  it("accepts four single quotes as the quoted scalar containing one quote", () => {
    const input = ["---", "item: ['''', safe]", "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "item")).toEqual(["'", "safe"]);
  });


  it("rewrites a flow list as a block list when requested", () => {
    const input = ["---", 'item: [alpha, "two words", beta]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 0,
      targetSlot: 3,
      writebackFormat: "block",
    });

    expect(output).toBe(
      ["---", "item:", '  - "two words"', "  - beta", "  - alpha", "---"].join("\n"),
    );
  });
});

