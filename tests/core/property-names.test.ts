import { describe, expect, it } from "vitest";

import {
  comparePropertyNames,
  getPropertyNameSuggestions,
} from "../../src/core/suggestions/property-names";

describe("comparePropertyNames", () => {
  it("groups numbers, Latin names, Han names, and other characters", () => {
    const names = [
      "_private",
      "张三",
      "beta",
      "10items",
      "王五",
      "Alpha",
      "2items",
      "李四",
    ];

    expect(names.sort(comparePropertyNames)).toEqual([
      "2items",
      "10items",
      "Alpha",
      "beta",
      "李四",
      "王五",
      "张三",
      "_private",
    ]);
  });

  it("uses a deterministic variant and code-point tie-break", () => {
    const names = ["alpha", "Alpha", "álpha"];
    const firstPass = [...names].sort(comparePropertyNames);
    const secondPass = [...names].reverse().sort(comparePropertyNames);

    expect(secondPass).toEqual(firstPass);
    expect(new Set(firstPass)).toEqual(new Set(names));
  });
});

describe("getPropertyNameSuggestions", () => {
  it("trims, deduplicates, excludes configured names, filters, and sorts", () => {
    expect(
      getPropertyNameSuggestions(
        [" beta ", "Alpha", "alpha", "Alpha", "张三", ""],
        ["alpha"],
        "a",
      ),
    ).toEqual(["Alpha", "beta"]);
  });

  it("keeps property-name identity case-sensitive", () => {
    expect(getPropertyNameSuggestions(["tags", "Tags"], ["tags"], "tag")).toEqual([
      "Tags",
    ]);
  });
});
