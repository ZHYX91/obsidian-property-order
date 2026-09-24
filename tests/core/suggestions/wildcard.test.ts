import { describe, expect, it } from "vitest";

import { createWildcardMatcher } from "../../../src/core/suggestions/wildcard";

describe("createWildcardMatcher", () => {
  it.each([
    ["status", "status", true],
    ["sta*", "status", true],
    ["*TUS", "status", true],
    ["st*t*s", "status", true],
    ["st*z", "status", false],
    ["*", "", true],
  ])("matches %j against %j", (pattern, value, expected) => {
    expect(createWildcardMatcher(pattern)(value)).toBe(expected);
  });

  it("handles many wildcard segments without regex backtracking", () => {
    const pattern = "*a".repeat(2_000) + "z";
    const value = "a".repeat(2_000);

    expect(createWildcardMatcher(pattern)(value)).toBe(false);
  });
});
