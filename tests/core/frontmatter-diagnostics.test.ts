import { describe, expect, it } from "vitest";

import {
  diagnoseFrontmatterReorder,
} from "../../src/core/frontmatter";

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

