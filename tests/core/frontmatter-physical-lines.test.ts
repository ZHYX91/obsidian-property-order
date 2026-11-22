import { describe, expect, it } from "vitest";
import { getFrontmatterListPropertyValues, getFrontmatterTextListProperty,
  planFrontmatterListPropertyMove, planFrontmatterListPropertyReorder } from "../../src/core/frontmatter";

function reorder(content: string, propertyKey: string) {
  return planFrontmatterListPropertyReorder(content, { propertyKey, sourceIndex: 0, targetSlot: 2, writebackFormat: "preserve" });
}

describe("physical frontmatter line boundaries", () => {
  it.each(["---", "..."])("stops at the first %s regardless of the body's newlines", (close) => {
    const input = `\uFEFF---\r\nreal: [a, b]\r\n${close}\nParagraph\r\nbodyKey: [x, y]\r\n---\rOutro`;
    expect(getFrontmatterListPropertyValues(input, "bodyKey")).toBeNull();
    expect(reorder(input, "bodyKey")).toBeNull();
    expect(reorder(input, "real")?.content).toBe(input.replace("[a, b]", "[b, a]"));
  });

  it("preserves each physical line ending in a reordered mixed-line-ending sequence", () => {
    const input = "---\r\nlist:\n  - a\r  - b\r\nother: literal\r---\nbody\r\n";
    expect(reorder(input, "list")?.content).toBe(input.replace("- a\r  - b", "- b\r  - a"));
    expect(getFrontmatterListPropertyValues(input, "list")).toEqual(["a", "b"]);
  });

  it("moves the attached item comment and preserves both property boundaries across mixed line endings", () => {
    const input = "\uFEFF---\r\nleft:\n  - a # first\r  - b\r\nright:\r  - c\n---\r\nBody\n";
    const plan = planFrontmatterListPropertyMove(input, { sourcePropertyKey: "left", sourceIndex: 0,
      targetPropertyKey: "right", targetSlot: 1, writebackFormat: "preserve" });
    expect(plan?.content).toBe("\uFEFF---\r\nleft:\n  - b\r\nright:\r  - c\n  - a # first\n---\r\nBody\n");
    expect(getFrontmatterTextListProperty(plan!.content, "right")).toEqual({
      values: ["c", "a"], scalars: [{ kind: "string", value: "c" }, { kind: "string", value: "a" }],
    });
  });

  it("rejects duplicate keys separated by different newline conventions", () => {
    const input = "---\r\na: [a, b]\na: [x, y]\r...\r\n";
    expect(reorder(input, "a")).toBeNull();
  });
});
