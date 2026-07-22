import { describe, expect, it } from "vitest";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyScalars,
  getFrontmatterListPropertyValues,
  moveFrontmatterListPropertyValue,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";
import { parseDoubleQuotedScalar } from "../../src/core/frontmatter/scalar";

describe("parseDoubleQuotedScalar", () => {
  it.each([
    [String.raw`"\0"`, "\0"],
    [String.raw`"\a"`, "\u0007"],
    [String.raw`"\b"`, "\b"],
    [String.raw`"\t"`, "\t"],
    [String.raw`"\n"`, "\n"],
    [String.raw`"\v"`, "\u000b"],
    [String.raw`"\f"`, "\f"],
    [String.raw`"\r"`, "\r"],
    [String.raw`"\e"`, "\u001b"],
    [String.raw`"\ "`, " "],
    [String.raw`"\""`, "\""],
    [String.raw`"\/"`, "/"],
    [String.raw`"\\"`, "\\"],
  ])("decodes the standard single-character escape in %s", (raw, expected) => {
    expect(parseDoubleQuotedScalar(raw)).toBe(expected);
  });
});

describe("reorderFrontmatterListProperty", () => {
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

  it("preserves each unmoved block item's original dash spacing", () => {
    const input = ["---", "tags:", "  -   alpha", "  - beta", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "tags:", "  - beta", "  -   alpha", "---"].join("\n"));
  });

  it("supports quoted property keys containing colons", () => {
    const doubleQuoted = ["---", '"alpha:beta": [one, two]', "---"].join("\n");
    const singleQuoted = ["---", "'can''t': [one, two]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(doubleQuoted, {
        propertyKey: "alpha:beta",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBe(["---", '"alpha:beta": [two, one]', "---"].join("\n"));
    expect(
      reorderFrontmatterListProperty(singleQuoted, {
        propertyKey: "can't",
        sourceIndex: 1,
        targetSlot: 0,
        writebackFormat: "preserve",
      }),
    ).toBe(["---", "'can''t': [two, one]", "---"].join("\n"));
  });

  it("decodes YAML escapes in double-quoted property keys", () => {
    const input = ["---", '"alpha\\x3Abeta": [one, two]', "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "alpha:beta",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", '"alpha\\x3Abeta": [two, one]', "---"].join("\n"));
  });

  it("supports valid plain keys and values containing quote or hash characters", () => {
    const input = ["---", "owner's#key: [don't, other] # note", "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "owner's#key",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "owner's#key: [other, don't] # note", "---"].join("\n"));
  });

  it("does not close frontmatter on indented block-scalar marker text", () => {
    const input = [
      "---",
      "description: &copy |1",
      " ---",
      " ...",
      "tags:",
      "  - alpha",
      "  - beta",
      "---",
    ].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "description: &copy |1",
        " ---",
        " ...",
        "tags:",
        "  - beta",
        "  - alpha",
        "---",
      ].join("\n"),
    );
  });

  it.each(["|", ">-", "!<tag:yaml.org,2002:str> |"])(
    "does not close frontmatter inside a sequence block scalar with header %s",
    (header) => {
      const input = [
        "---",
        "notes:",
        `  - ${header}`,
        "    ---",
        "    ...",
        "tags: [alpha, beta]",
        "---",
      ].join("\n");

      const output = reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      });

      expect(output).toBe(
        [
          "---",
          "notes:",
          `  - ${header}`,
          "    ---",
          "    ...",
          "tags: [beta, alpha]",
          "---",
        ].join("\n"),
      );
    },
  );

  it.each([
    "tags: [one, [two, three], four]",
    "tags: [one, {name: nested}, four]",
    ["tags:", "  - one", "    - nested"].join("\n"),
    ["tags:", "  - - nested", "  - other"].join("\n"),
    ["tags:", "  - name: nested", "  - other"].join("\n"),
    ["tags:", "- name: nested", "- other"].join("\n"),
    ["tags:", "  name: nested"].join("\n"),
  ])("fails closed for nested collection syntax: %s", (propertyText) => {
    const input = ["---", propertyText, "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
    expect(getFrontmatterListPropertyValues(input, "tags")).toBeNull();
    expect(diagnoseFrontmatterReorder(input, "tags")).toBe("unsupported_property");
  });

  it("fails closed consistently for multiline flow sequences", () => {
    const input = ["---", "tags: [", "  one,", "  two", "]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
    expect(getFrontmatterListPropertyValues(input, "tags")).toBeNull();
    expect(diagnoseFrontmatterReorder(input, "tags")).toBe("unsupported_property");
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

describe("moveFrontmatterListPropertyValue", () => {
  it("moves into an indentless scalar sequence without mistaking colon values for properties", () => {
    const input = [
      "---",
      "source: [seed]",
      "tags:",
      "- https://example.com/path",
      "- 'alpha: beta'",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "source",
        targetPropertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBe(
      [
        "---",
        "source: []",
        "tags:",
        "- https://example.com/path",
        "- seed",
        "- 'alpha: beta'",
        "---",
      ].join("\n"),
    );
  });

  it("fails closed when an indentless target sequence contains a mapping item", () => {
    const input = [
      "---",
      "source: [seed]",
      "tags:",
      "- name: nested",
      "- other",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "source",
        targetPropertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 0,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });

  it("moves a block list item to another block list", () => {
    const input = [
      "---",
      "aliases:",
      "  - alpha",
      "  - beta # B",
      "related:",
      "  - gamma",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "aliases:",
        "  - alpha",
        "related:",
        "  - beta # B",
        "  - gamma",
        "---",
      ].join("\n"),
    );
  });

  it("moves a flow sequence item into a block list using the target list style", () => {
    const input = [
      "---",
      'aliases: [alpha, "beta value"]',
      "related:",
      "    - gamma",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "aliases: [alpha]",
        "related:",
        "    - gamma",
        '    - "beta value"',
        "---",
      ].join("\n"),
    );
  });

  it("moves a block list item into a flow sequence", () => {
    const input = [
      "---",
      "aliases:",
      "  - alpha",
      '  - "beta value"',
      "related: [gamma]",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "aliases:", "  - alpha", 'related: ["beta value", gamma]', "---"].join("\n"),
    );
  });

  it("serializes a plain block scalar safely when moving it into a flow sequence", () => {
    const input = [
      "---",
      "aliases:",
      "  - Alpha, Beta",
      "related: [gamma]",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "aliases:", 'related: ["Alpha, Beta", gamma]', "---"].join("\n"),
    );
    expect(getFrontmatterListPropertyValues(output ?? "", "related")).toEqual([
      "Alpha, Beta",
      "gamma",
    ]);
  });

  it.each([
    ["123", "123"],
    ["true", "true"],
    ["null", "null"],
    ["", "null"],
  ])(
    "preserves the YAML semantics of block scalar %j when moving it into flow",
    (sourceRaw, targetRaw) => {
      const sourceItem = sourceRaw.length === 0 ? "  -" : `  - ${sourceRaw}`;
      const input = [
        "---",
        "aliases:",
        sourceItem,
        "related: [seed]",
        "---",
      ].join("\n");

      const output = moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "aliases",
        targetPropertyKey: "related",
        sourceIndex: 0,
        targetSlot: 0,
        writebackFormat: "preserve",
      });

      expect(output).toBe(
        ["---", "aliases:", `related: [${targetRaw}, seed]`, "---"].join("\n"),
      );
    },
  );

  it("fails closed when moving a commented block item into a flow sequence", () => {
    const input = [
      "---",
      "aliases:",
      "  - alpha # keep this",
      "related: [beta]",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "aliases",
        targetPropertyKey: "related",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });

  it("fails closed when a quote inside a moved plain scalar precedes its inline comment", () => {
    const input = [
      "---",
      "aliases:",
      "  - retained",
      '  - abc:"def # keep-comment',
      "related: [gamma]",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "aliases",
        targetPropertyKey: "related",
        sourceIndex: 1,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });

  it.each([
    ["a leading comment", "  # keep with alpha"],
    ["a leading blank line", ""],
  ])("fails closed when moving a block item with %s into a flow sequence", (_label, line) => {
    const input = [
      "---",
      "aliases:",
      "  - retained",
      line,
      "  - alpha",
      "related: [beta]",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        sourcePropertyKey: "aliases",
        targetPropertyKey: "related",
        sourceIndex: 1,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
  });

  it("preserves block style when the source property is emptied", () => {
    const input = ["---", "aliases:", "  - alpha", "related: [beta]", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases:", "related: [beta, alpha]", "---"].join("\n"));
  });

  it("preserves standalone comments and blank lines when a block source is emptied", () => {
    const input = [
      "---",
      "aliases: # source",
      "  # before",
      "  - alpha",
      "  # after",
      "",
      "related: [beta]",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "aliases: # source",
        "  # before",
        "  # after",
        "",
        "related: [beta, alpha]",
        "---",
      ].join("\n"),
    );
  });

  it("preserves flow style when the source property is emptied", () => {
    const input = ["---", "aliases: [alpha]", "related:", "  - beta", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "aliases: []", "related:", "  - beta", "  - alpha", "---"].join("\n"),
    );
  });

  it("moves a value into an empty flow list target", () => {
    const input = ["---", "aliases: [alpha, beta]", "related: []", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases: [alpha]", "related: [beta]", "---"].join("\n"));
  });

  it("moves a value into an empty block-style target", () => {
    const input = ["---", "aliases: [alpha, beta]", "related:", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases: [alpha]", "related:", "  - beta", "---"].join("\n"));
  });

  it("falls back to same-property reorder when source and target are equal", () => {
    const input = ["---", "aliases: [alpha, beta, gamma]", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "aliases",
      sourceIndex: 0,
      targetSlot: 3,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases: [beta, gamma, alpha]", "---"].join("\n"));
  });

  it("formats both source and target as flow lists when moving across properties", () => {
    const input = [
      "---",
      "aliases:",
      "  - alpha",
      "  - beta value",
      "related:",
      "  - gamma",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 1,
      writebackFormat: "flow",
    });

    expect(output).toBe(
      ["---", "aliases: [alpha]", 'related: [gamma, "beta value"]', "---"].join("\n"),
    );
  });

  it("keeps a block head comment valid when a move empties the source into flow format", () => {
    const input = [
      "---",
      "aliases: # source note",
      "  - alpha",
      "related: [beta]",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "flow",
    });

    expect(output).toBe(
      ["---", "aliases: [] # source note", "related: [beta, alpha]", "---"].join("\n"),
    );
  });

  it("formats both source and target as block lists when moving across properties", () => {
    const input = ["---", "aliases: [alpha, beta]", "related: [gamma]", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 1,
      targetSlot: 0,
      writebackFormat: "block",
    });

    expect(output).toBe(
      [
        "---",
        "aliases:",
        "  - alpha",
        "related:",
        "  - beta",
        "  - gamma",
        "---",
      ].join("\n"),
    );
  });
});

describe("getFrontmatterListPropertyValues", () => {
  it("recognizes empty flow and block lists", () => {
    const input = ["---", "empty_flow: []", "empty_block:", "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "empty_flow")).toEqual([]);
    expect(getFrontmatterListPropertyValues(input, "empty_block")).toEqual([]);
  });

  it("extracts scalar values from flow lists without formatting noise", () => {
    const input = ["---", 'links: ["[[Alpha, Beta]]", "topic #1", plain] # note', "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "links")).toEqual([
      "[[Alpha, Beta]]",
      "topic #1",
      "plain",
    ]);
  });

  it("extracts unquoted hash values when # is not a YAML comment", () => {
    const input = ["---", "links:", "  - topic#1", "  - alpha # note", "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "links")).toEqual(["topic#1", "alpha"]);
  });

  it("extracts scalar values from block lists with comments", () => {
    const input = ["---", "tags:", "  - alpha # A", "  # kept with beta", "  - beta", "---"].join(
      "\n",
    );

    expect(getFrontmatterListPropertyValues(input, "tags")).toEqual(["alpha", "beta"]);
  });

  it("normalizes an implicit empty block item to the metadata-cache null value", () => {
    const input = ["---", "tags:", "  -", "  - other", "---"].join("\n");

    expect(getFrontmatterListPropertyValues(input, "tags")).toEqual(["null", "other"]);
    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBe(["---", "tags:", "  - other", "  -", "---"].join("\n"));
  });
});

describe("diagnoseFrontmatterReorder", () => {
  it("returns no_frontmatter when file has no frontmatter", () => {
    expect(diagnoseFrontmatterReorder("hello", "tags")).toBe("no_frontmatter");
  });

  it("returns property_not_found when frontmatter does not contain the property", () => {
    const input = ["---", "aliases:", "  - a", "---"].join("\n");
    expect(diagnoseFrontmatterReorder(input, "tags")).toBe("property_not_found");
  });

  it("recognizes empty frontmatter closed at EOF", () => {
    expect(diagnoseFrontmatterReorder(["---", "---"].join("\n"), "tags")).toBe(
      "property_not_found",
    );
  });

  it("returns unsupported_property when the property is not a list", () => {
    const input = ["---", "tags: 123", "---"].join("\n");
    expect(diagnoseFrontmatterReorder(input, "tags")).toBe("unsupported_property");
  });

  it("returns ok for supported flow and block lists", () => {
    const flowInput = ["---", "tags: [a, b] # note", "---"].join("\n");
    expect(diagnoseFrontmatterReorder(flowInput, "tags")).toBe("ok");

    const blockInput = ["---", "tags: # note", "  - a", "---"].join("\n");
    expect(diagnoseFrontmatterReorder(blockInput, "tags")).toBe("ok");
  });

  it("diagnoses quoted property keys using their decoded names", () => {
    const input = ["---", '"alpha:beta": [a, b]', "---"].join("\n");

    expect(diagnoseFrontmatterReorder(input, "alpha:beta")).toBe("ok");
  });
});

