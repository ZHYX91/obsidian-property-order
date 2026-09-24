import { describe, expect, it } from "vitest";

import {
  explainPropertyValueBehavior,
  orderPropertyValues,
  resolvePropertyValueRules,
} from "../../../src/core/suggestions/order-values";

describe("resolvePropertyValueRules", () => {
  it("applies per-property wildcard rules and the first sort override", () => {
    expect(
      resolvePropertyValueRules("status", {
        bottomRules: ["* = archived"],
        defaultSortMode: "native",
        hiddenRules: ["status = cancelled", "priority = low"],
        pinnedRules: ["stat* = draft", "status = in-*"],
        sortOverrides: ["stat* = recent", "status = usage"],
      }),
    ).toEqual({
      bottomValues: ["archived"],
      hiddenPatterns: ["cancelled"],
      pinnedValues: ["draft", "in-*"],
      sortMode: "recent",
    });
  });

  it("allows a property rule to disable candidate suggestions", () => {
    expect(
      resolvePropertyValueRules("secret_id", {
        bottomRules: [],
        defaultSortMode: "native",
        hiddenRules: [],
        pinnedRules: [],
        sortOverrides: ["secret_* = none"],
      }),
    ).toMatchObject({ sortMode: "none" });

    expect(
      explainPropertyValueBehavior("secret_id", ["secret_* = none"], "name"),
    ).toEqual({
      behavior: "none",
      matchedRule: "secret_* = none",
      propertyKey: "secret_id",
    });
  });

  it("ignores malformed and unrelated rules", () => {
    expect(
      resolvePropertyValueRules("priority", {
        bottomRules: ["status = done", "missing separator"],
        defaultSortMode: "name",
        hiddenRules: [],
        pinnedRules: ["priority = high"],
        sortOverrides: ["status = recent", "priority = future"],
      }),
    ).toEqual({
      bottomValues: [],
      hiddenPatterns: [],
      pinnedValues: ["high"],
      sortMode: "name",
    });
  });
});

describe("orderPropertyValues", () => {
  it("returns no candidates when suggestions are disabled for the property", () => {
    expect(
      orderPropertyValues(["alpha", "beta"], {
        bottomValues: ["beta"],
        hiddenPatterns: [],
        pinnedValues: ["alpha"],
        recentValues: [],
        sortMode: "none",
        usage: [],
      }),
    ).toEqual([]);
  });


  it("preserves native middle order while applying hidden, pinned, and bottom rules", () => {
    expect(
      orderPropertyValues(["doing", "done", "draft", "archived", "cancelled"], {
        bottomValues: ["archived"],
        hiddenPatterns: ["cancel*"],
        pinnedValues: ["draft", "do*"],
        recentValues: [],
        sortMode: "native",
        usage: [],
      }).map((item) => item.value),
    ).toEqual(["draft", "doing", "done", "archived"]);
  });

  it("sorts the unreserved middle by mixed-language name order", () => {
    expect(
      orderPropertyValues(["中", "b", "10", "a"], {
        bottomValues: [],
        hiddenPatterns: [],
        pinnedValues: [],
        recentValues: [],
        sortMode: "name",
        usage: [],
      }).map((item) => item.value),
    ).toEqual(["10", "a", "b", "中"]);
  });

  it("puts confirmed recent values first and falls back to name order", () => {
    expect(
      orderPropertyValues(["gamma", "alpha", "beta"], {
        bottomValues: [],
        hiddenPatterns: [],
        pinnedValues: [],
        recentValues: ["beta"],
        sortMode: "recent",
        usage: [],
      }).map((item) => item.value),
    ).toEqual(["beta", "alpha", "gamma"]);
  });

  it("sorts by note count and breaks ties by name", () => {
    expect(
      orderPropertyValues(["gamma", "alpha", "beta"], {
        bottomValues: [],
        hiddenPatterns: [],
        pinnedValues: [],
        recentValues: [],
        sortMode: "usage",
        usage: [
          { value: "alpha", count: 2 },
          { value: "beta", count: 4 },
          { value: "gamma", count: 2 },
        ],
      }).map((item) => item.value),
    ).toEqual(["beta", "alpha", "gamma"]);
  });

  it("deduplicates exact values before ordering", () => {
    expect(
      orderPropertyValues(["alpha", "alpha", "beta"], {
        bottomValues: [],
        hiddenPatterns: [],
        pinnedValues: [],
        recentValues: [],
        sortMode: "native",
        usage: [],
      }).map((item) => item.value),
    ).toEqual(["alpha", "beta"]);
  });
});
