import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FIXTURE_ROOT = path.resolve("acceptance/fixtures");

function readFixture(relativePath: string): string {
  return readFileSync(path.join(FIXTURE_ROOT, relativePath), "utf8");
}

describe("key suggestion host acceptance fixture", () => {
  it("covers every supported explicit type plus one unregistered property", () => {
    const stored = JSON.parse(readFixture(".obsidian/types.json")) as {
      types: Record<string, string>;
    };

    expect(stored.types).toMatchObject({
      key_text: "text",
      key_list: "multitext",
      key_number: "number",
      key_checkbox: "checkbox",
      key_date: "date",
      key_datetime: "datetime",
      tags: "tags",
      key_bottom: "text",
      key_hidden: "text",
    });
    expect(stored.types).not.toHaveProperty("key_automatic");

    const vocabulary = readFixture("Key Type Vocabulary.md");
    for (const property of [
      "key_text",
      "key_list",
      "key_number",
      "key_checkbox",
      "key_date",
      "key_datetime",
      "tags",
      "key_automatic",
      "key_bottom",
      "key_hidden",
    ]) {
      expect(vocabulary).toMatch(new RegExp(`^${property}:`, "mu"));
    }
  });

  it("keeps the active key-suggestion note free of vocabulary candidates", () => {
    const active = readFixture("Key Suggestions.md");

    expect(active).toContain("key_acceptance_anchor: ready");
    for (const property of [
      "key_text:",
      "key_list:",
      "key_number:",
      "key_checkbox:",
      "key_date:",
      "key_datetime:",
      "key_automatic:",
      "key_bottom:",
      "key_hidden:",
    ]) {
      expect(active).not.toContain(property);
    }
  });

  it("declares type grouping, keyboard, touch, and native restoration acceptance", () => {
    const scenarios = JSON.parse(
      readFileSync(path.resolve("acceptance/product-scenarios.json"), "utf8"),
    ) as {
      scenarios: Array<{
        expected: string[];
        id: string;
        steps: string[];
        surfaces: string[];
      }>;
    };
    const scenario = scenarios.scenarios.find(
      ({ id }) => id === "key-suggestions-type-grouping-and-host-restore",
    );

    expect(scenario).toBeDefined();
    expect(scenario?.surfaces).toEqual(["desktop", "android-emulator"]);
    expect(scenario?.steps.join("\n")).toContain("Automatic / unspecified");
    expect(scenario?.steps.join("\n")).toContain("Arrow keys");
    expect(scenario?.steps.join("\n")).toContain("Disable key suggestion enhancement");
    expect(scenario?.expected.join("\n")).toContain("without synthetic candidate rows");
    expect(scenario?.expected.join("\n")).toContain("minimum supported desktop host");
    expect(scenario?.expected.join("\n")).toContain("Android emulator");
  });
});
