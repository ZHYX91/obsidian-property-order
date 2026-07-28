import { describe, expect, it } from "vitest";

import {
  getFrontmatterListPropertyValues,
  moveFrontmatterListPropertyValue,
} from "../../src/core/frontmatter";

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

  it("coerces a host-declared scalar target into a list while preserving its value first", () => {
    const input = [
      "---",
      "aliases: [alpha, beta]",
      "related: existing # keep",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      coerceTargetScalarToList: true,
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "aliases: [beta]", "related: [existing, alpha] # keep", "---"].join("\n"),
    );
  });

  it("treats an explicit null scalar as an empty host-declared list", () => {
    const input = ["---", "aliases: [alpha, beta]", "related: null", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      coerceTargetScalarToList: true,
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 0,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", "aliases: [beta]", "related: [alpha]", "---"].join("\n"));
  });

  it("quotes a scalar that is unsafe when converted into flow-list syntax", () => {
    const input = ["---", "aliases: [alpha]", "related: Alpha, Beta", "---"].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      coerceTargetScalarToList: true,
      sourcePropertyKey: "aliases",
      targetPropertyKey: "related",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      ["---", "aliases: []", 'related: ["Alpha, Beta", alpha]', "---"].join("\n"),
    );
  });

  it("does not coerce a scalar target without host list-type permission", () => {
    const input = ["---", "aliases: [alpha]", "related: existing", "---"].join("\n");

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

  it("fails closed for an object target even with host list-type permission", () => {
    const input = [
      "---",
      "aliases: [alpha]",
      "related: {name: nested}",
      "---",
    ].join("\n");

    expect(
      moveFrontmatterListPropertyValue(input, {
        coerceTargetScalarToList: true,
        sourcePropertyKey: "aliases",
        targetPropertyKey: "related",
        sourceIndex: 0,
        targetSlot: 1,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
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
