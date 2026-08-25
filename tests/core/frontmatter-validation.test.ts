import { describe, expect, it } from "vitest";

import {
  diagnoseFrontmatterReorder,
  getFrontmatterListPropertyValues,
  reorderFrontmatterListProperty,
} from "../../src/core/frontmatter";

describe("reorderFrontmatterListProperty syntax boundaries", () => {
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

  it.each(["---", "..."])(
    "does not close frontmatter on indented ordinary marker content: %s",
    (marker) => {
      const input = [
        "---",
        "marker:",
        `  ${marker}`,
        "tags: [alpha, beta]",
        "---",
      ].join("\n");

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
          "marker:",
          `  ${marker}`,
          "tags: [beta, alpha]",
          "---",
        ].join("\n"),
      );
    },
  );

  it.each(["---", "..."])(
    "does not miss a duplicate key after indented ordinary marker content: %s",
    (marker) => {
      const input = [
        "---",
        "tags: [alpha, beta]",
        "marker:",
        `  ${marker}`,
        "tags: [gamma]",
        "---",
      ].join("\n");

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
    },
  );

  it.each([" ---", "\t---"])("does not accept an indented opening delimiter: %j", (opening) => {
    const input = [opening, "tags: [alpha, beta]", "---"].join("\n");

    expect(
      reorderFrontmatterListProperty(input, {
        propertyKey: "tags",
        sourceIndex: 0,
        targetSlot: 2,
        writebackFormat: "preserve",
      }),
    ).toBeNull();
    expect(diagnoseFrontmatterReorder(input, "tags")).toBe("no_frontmatter");
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
});
