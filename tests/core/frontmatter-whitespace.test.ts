import { describe, expect, it } from "vitest";

import {
  getFrontmatterListPropertyValues,
  moveFrontmatterListPropertyValue,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

describe("YAML value whitespace fidelity", () => {
  it("preserves non-breaking space at a plain flow-scalar boundary during reorder", () => {
    const nbsp = "\u00a0";
    const input = ["---", `tags: [alpha${nbsp}, beta]`, "---"].join("\n");

    const output = reorderFrontmatterListProperty(input, {
      propertyKey: "tags",
      sourceIndex: 0,
      targetSlot: 2,
      writebackFormat: "preserve",
    });

    expect(output).toBe(["---", `tags: [beta, alpha${nbsp}]`, "---"].join("\n"));
    expect(getFrontmatterListPropertyValues(output ?? "", "tags")).toEqual([
      "beta",
      `alpha${nbsp}`,
    ]);
  });

  it("preserves non-breaking space before an inline comment", () => {
    const nbsp = "\u00a0";
    const input = [
      "---",
      "tags:",
      `  - alpha${nbsp} # keep`,
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
      ["---", "tags:", "  - beta", `  - alpha${nbsp} # keep`, "---"].join("\n"),
    );
    expect(getFrontmatterListPropertyValues(output ?? "", "tags")).toEqual([
      "beta",
      `alpha${nbsp}`,
    ]);
  });

  it("preserves non-breaking space when moving a flow item into a block list", () => {
    const nbsp = "\u00a0";
    const input = [
      "---",
      `source: [alpha${nbsp}, retained]`,
      "target:",
      "  - beta",
      "---",
    ].join("\n");

    const output = moveFrontmatterListPropertyValue(input, {
      sourcePropertyKey: "source",
      targetPropertyKey: "target",
      sourceIndex: 0,
      targetSlot: 1,
      writebackFormat: "preserve",
    });

    expect(output).toBe(
      [
        "---",
        "source: [retained]",
        "target:",
        "  - beta",
        `  - alpha${nbsp}`,
        "---",
      ].join("\n"),
    );
    expect(getFrontmatterListPropertyValues(output ?? "", "target")).toEqual([
      "beta",
      `alpha${nbsp}`,
    ]);
  });
});
