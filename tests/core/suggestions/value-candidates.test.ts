import { describe, expect, it } from "vitest";

import { planCustomPropertyValueCandidates } from "../../../src/core/suggestions/value-candidates";

describe("planCustomPropertyValueCandidates", () => {
  it("creates configured pinned and bottom candidates absent from native vocabulary", () => {
    expect(
      planCustomPropertyValueCandidates({
        bottomValues: ["archived", "never-seen-bottom"],
        frequency: [],
        middleSortMode: "native",
        middleValues: [],
        nativeValues: ["draft", "done", "archived"],
        noteCounts: [],
        pinnedValues: ["never-seen-top", "done"],
      }),
    ).toEqual([
      { isPreset: true, placement: "pinned", value: "never-seen-top" },
      { isPreset: true, placement: "pinned", value: "done" },
      { isPreset: false, placement: "middle", value: "draft" },
      { isPreset: true, placement: "bottom", value: "archived" },
      { isPreset: true, placement: "bottom", value: "never-seen-bottom" },
    ]);
  });

  it("keeps preset middle vocabulary after it is no longer native", () => {
    expect(
      planCustomPropertyValueCandidates({
        bottomValues: [],
        frequency: [],
        middleSortMode: "native",
        middleValues: ["manual", "draft"],
        nativeValues: ["draft", "done"],
        noteCounts: [],
        pinnedValues: [],
      }),
    ).toEqual([
      { isPreset: true, placement: "middle", value: "draft" },
      { isPreset: false, placement: "middle", value: "done" },
      { isPreset: true, placement: "middle", value: "manual" },
    ]);
  });

  it("uses pinned placement when a configured value appears in multiple sections", () => {
    expect(
      planCustomPropertyValueCandidates({
        bottomValues: ["same"],
        frequency: [],
        middleSortMode: "native",
        middleValues: ["same"],
        nativeValues: ["same"],
        noteCounts: [],
        pinnedValues: ["same"],
      }),
    ).toEqual([
      { isPreset: true, placement: "pinned", value: "same" },
    ]);
  });

  it("sorts the middle by frequency or note count with name tie-breaking", () => {
    const base = {
      bottomValues: [] as string[],
      middleValues: [] as string[],
      nativeValues: ["gamma", "alpha", "beta"],
      pinnedValues: [] as string[],
    };

    expect(
      planCustomPropertyValueCandidates({
        ...base,
        frequency: [
          { value: "beta", count: 3 },
          { value: "alpha", count: 1 },
        ],
        middleSortMode: "frequency",
        noteCounts: [],
      }).map((item) => item.value),
    ).toEqual(["beta", "alpha", "gamma"]);

    expect(
      planCustomPropertyValueCandidates({
        ...base,
        frequency: [],
        middleSortMode: "note-count",
        noteCounts: [
          { value: "gamma", count: 2 },
          { value: "alpha", count: 2 },
          { value: "beta", count: 1 },
        ],
      }).map((item) => item.value),
    ).toEqual(["alpha", "gamma", "beta"]);
  });

  it("preserves exact preset identity including meaningful edge Unicode", () => {
    const nbsp = "\u00a0";

    expect(
      planCustomPropertyValueCandidates({
        bottomValues: [`alpha${nbsp}`],
        frequency: [],
        middleSortMode: "name",
        middleValues: ["alpha"],
        nativeValues: ["alpha", `alpha${nbsp}`],
        noteCounts: [],
        pinnedValues: [],
      }),
    ).toEqual([
      { isPreset: true, placement: "middle", value: "alpha" },
      { isPreset: true, placement: "bottom", value: `alpha${nbsp}` },
    ]);
  });
});
