import { describe, expect, it } from "vitest";

import {
  getFrontmatterListPropertyValues,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

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
