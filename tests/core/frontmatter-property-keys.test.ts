import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyValues,
  moveFrontmatterListPropertyValue,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

const unicodeKeys = [
  "tags\u00a0",
  "\u00a0tags",
  "tags\u3000",
  "\u3000tags",
  "a:\u00a0b",
  "a:\u3000b",
];

function readYaml(content: string) {
  const closingIndex = content.indexOf("\n---\n", 4);
  expect(closingIndex).toBeGreaterThan(4);
  const document = parseDocument(content.slice(4, closingIndex));
  expect(document.errors).toEqual([]);
  return document.toJS() as Record<string, unknown>;
}

describe.each(["plain", "quoted"])("%s YAML property key identity", (style) => {
  it.each(["tags", ...unicodeKeys])("reorders the exact key %j", (key) => {
    const keyText = style === "quoted" ? JSON.stringify(key) : key;
    const input = `---\n${keyText}: [alpha, beta]\nunrelated: retained\n---\nBody\n`;
    expect(readYaml(input)).toEqual({ [key]: ["alpha", "beta"], unrelated: "retained" });
    expect(getFrontmatterListPropertyValues(input, key)).toEqual(["alpha", "beta"]);
    expect(diagnoseFrontmatterReorder(input, key)).toBe("ok");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: key,
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
      normalizeAsTextList: true,
    });

    expect(output).toBe(`---\n${keyText}: [beta, alpha]\nunrelated: retained\n---\nBody\n`);
    expect(readYaml(output ?? "")).toEqual({
      [key]: ["beta", "alpha"],
      unrelated: "retained",
    });
  });
});

describe("YAML property key separation", () => {
  it.each(["tags  ", "tags\t"])("preserves ASCII separator spacing in %j", (keyText) => {
    const input = `---\n${keyText}: [alpha, beta]\n---\nBody\n`;
    expect(readYaml(input)).toEqual({ tags: ["alpha", "beta"] });
    expect(reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
      normalizeAsTextList: true,
    })).toBe(`---\n${keyText}: [beta, alpha]\n---\nBody\n`);
  });

  it.each(unicodeKeys)("rejects a quoted duplicate of the exact key %j", (key) => {
    const input = `---\n${key}: [alpha, beta]\n${JSON.stringify(key)}: [gamma]\n---\nBody\n`;
    expect(getFrontmatterListPropertyValues(input, key)).toBeNull();
    expect(diagnoseFrontmatterReorder(input, key)).toBe("unsupported_property");
    expect(reorderFrontmatterListProperty(input, {
      propertyKey: key,
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
      normalizeAsTextList: true,
    })).toBeNull();
  });

  it.each([
    ["tags\u00a0", "\u3000tags"],
    ["\u3000tags", "tags\u00a0"],
  ])("moves from %j to %j without touching the ordinary tags key", (sourceKey, targetKey) => {
    const input = [
      "---",
      "tags: [untouched]",
      `${sourceKey}: [alpha, beta]`,
      `${targetKey}:`,
      "  - gamma",
      "---",
      "Body",
      "",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: sourceKey,
      targetPropertyKey: targetKey,
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
      normalizeAsTextList: true,
    });

    expect(output).toBe([
      "---",
      "tags: [untouched]",
      `${sourceKey}: [beta]`,
      `${targetKey}:`,
      "  - gamma",
      "  - alpha",
      "---",
      "Body",
      "",
    ].join("\n"));
    expect(readYaml(output ?? "")).toEqual({
      tags: ["untouched"],
      [sourceKey]: ["beta"],
      [targetKey]: ["gamma", "alpha"],
    });
  });
});
