import { describe, expect, it } from "vitest";

import {
  getFrontmatterListPropertyValues,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

describe("reorderFrontmatterListProperty preserve mode", () => {
  it("reorders block list items while preserving original item style", () => {
    const input = [
      "---",
      "aliases:",
      "  - alpha",
      "  - 'beta value'",
      '  - "gamma:value"',
      "",
      "flow_list: [red, green, blue]",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "aliases",
      sourceIndex: 0,
      targetSlot: 3,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "---",
      "aliases:",
      "  - 'beta value'",
      '  - "gamma:value"',
      "  - alpha",
      "",
      "flow_list: [red, green, blue]",
      "---",
    ].join("\n"));
  });

  it("preserves the separator before the next property when reordering a block list", () => {
    const input = [
      "---",
      "mixed:",
      "  - one",
      '  - "three: value"',
      "  - two words",
      "flow_list: [red, green, blue]",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "mixed",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "---",
      "mixed:",
      "  - two words",
      "  - one",
      '  - "three: value"',
      "flow_list: [red, green, blue]",
      "---",
    ].join("\n"));
  });

  it("reorders block list items with comment lines and inline comments", () => {
    const input = [
      "---",
      "tags:",
      "  - alpha # A",
      "  # pinned",
      "  - beta # B",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "---",
      "tags:",
      "  # pinned",
      "  - beta # B",
      "  - alpha # A",
      "---",
    ].join("\n"));
  });

  it("supports block lists containing blank lines", () => {
    const input = [
      "---",
      "tags:",
      "  - alpha",
      "",
      "  - beta",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "---",
      "tags:",
      "",
      "  - beta",
      "  - alpha",
      "---",
    ].join("\n"));
  });

  it("supports indentless block scalars containing colons", () => {
    const input = [
      "---",
      "tags:",
      "- https://example.com/path",
      "- 'alpha: beta'",
      "- other",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "tags:",
        "- other",
        "- https://example.com/path",
        "- 'alpha: beta'",
        "---",
      ].join("\n"),
    );
  });

  it("tolerates BOM and whitespace around frontmatter delimiters", () => {
    const input = [
      "\uFEFF---  ",
      "tags:",
      "  - alpha",
      "  - beta",
      " ...",
      "",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "\uFEFF---  ",
      "tags:",
      "  - beta",
      "  - alpha",
      " ...",
      "",
    ].join("\n"));
  });

  it("preserves CRLF newlines when reordering", () => {
    const input = ["---", "tags:", "  - alpha", "  - beta", "---"].join("\r\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "tags:", "  - beta", "  - alpha", "---"].join("\r\n"));
  });

  it("preserves CR newlines when reordering", () => {
    const input = ["---", "tags:", "  - alpha", "  - beta", "---"].join("\r");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "tags:", "  - beta", "  - alpha", "---"].join("\r"));
  });

  it("does not treat # inside quotes as an inline comment", () => {
    const input = [
      "---",
      "tags:",
      '  - "alpha # not comment"',
      "  - beta # B",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe([
      "---",
      "tags:",
      "  - beta # B",
      '  - "alpha # not comment"',
      "---",
    ].join("\n"));
  });

  it("reorders flow sequence items while preserving mixed quoting", () => {
    const input = ["---", 'item: [a, \'b\', "c"]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", 'item: ["c", a, \'b\']', "---"].join("\n"));
  });

  it("supports flow sequences with an inline comment", () => {
    const input = ["---", 'item: [a, b, "c"] # note', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "item",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", 'item: ["c", a, b] # note', "---"].join("\n"));
  });

  it("preserves quoted flow items containing commas and hashes", () => {
    const input = ["---", 'links: ["[[Alpha, Beta]]", "topic #1", plain]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "links",
      sourceIndex: 2,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", 'links: [plain, "[[Alpha, Beta]]", "topic #1"]', "---"].join("\n"));
  });

  it("does not treat an unquoted # as a comment without preceding whitespace", () => {
    const input = ["---", "links: [topic#1, plain] # note", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "links",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "links: [plain, topic#1] # note", "---"].join("\n"));
  });

  it("preserves escaped single quotes in flow sequence items", () => {
    const input = ["---", "aliases: ['don''t', plain, end]", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "aliases",
      sourceIndex: 0,
      targetSlot: 3,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases: [plain, end, 'don''t']", "---"].join("\n"));
  });

  it("uses source index when preserving duplicate flow values", () => {
    const input = ["---", 'tags: [same, "same", \'same\']', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", 'tags: ["same", same, \'same\']', "---"].join("\n"));
  });

  it("preserves block list internal-link values with commas and headings", () => {
    const input = [
      "---",
      "related:",
      '  - "[[Alpha, Beta]]"',
      '  - "[[Note#Heading]]"',
      "  - plain",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "related:",
        '  - "[[Note#Heading]]"',
        '  - "[[Alpha, Beta]]"',
        "  - plain",
        "---",
      ].join("\n"),
    );
  });

  it("supports block lists with a head inline comment", () => {
    const input = ["---", "tags: # note", "  - alpha", "  - beta", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "tags: # note", "  - beta", "  - alpha", "---"].join("\n"));
  });

  it("treats a quote inside a block plain scalar as literal before an inline comment", () => {
    const input = [
      "---",
      "tags:",
      '  - abc:"def # keep-comment',
      "  - other",
      "---",
    ].join("\n");

    expect(getFrontmatterListPropertyValues(input, "tags")).toEqual(['abc:"def', "other"]);
    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBe(
      [
        "---",
        "tags:",
        "  - other",
        '  - abc:"def # keep-comment',
        "---",
      ].join("\n"),
    );
  });

  it.each([
    ["flow", ["---", String.raw`tags: [other, "abc:\"def"]`, "---"].join("\n")],
    [
      "block",
      ["---", "tags:", "  - other", String.raw`  - "abc:\"def" # keep-comment`, "---"].join(
        "\n",
      ),
    ],
  ] as const)("does not turn a block inline comment into data during %s writeback", (format, expected) => {
    const input = [
      "---",
      "tags:",
      '  - abc:"def # keep-comment',
      "  - other",
      "---",
    ].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: format,
      }),
    ).toBe(expected);
  });
});

