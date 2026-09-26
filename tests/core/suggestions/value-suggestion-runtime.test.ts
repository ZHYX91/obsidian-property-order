import { describe, expect, it } from "vitest";

import { planGroupedPropertyValueSuggestions } from "../../../src/core/suggestions/value-suggestion-runtime";
import { createDefaultSettings } from "../../../src/shared/settings";

describe("planGroupedPropertyValueSuggestions", () => {
  it("uses the default behavior for unassigned properties", () => {
    const settings = createDefaultSettings();
    settings.valueSuggestionDefaultBehavior = "name";

    expect(
      planGroupedPropertyValueSuggestions(
        settings,
        "status",
        ["beta", "alpha"],
        [],
        [],
      ).candidates.map((candidate) => candidate.value),
    ).toEqual(["alpha", "beta"]);
  });

  it("lets one property override the default with selection frequency", () => {
    const settings = createDefaultSettings();
    settings.valueSuggestionDefaultBehavior = "native";
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "frequency", propertyKey: "status" },
    ];

    expect(
      planGroupedPropertyValueSuggestions(
        settings,
        "STATUS",
        ["draft", "done"],
        [
          { value: "done", count: 4 },
          { value: "draft", count: 1 },
        ],
        [],
      ),
    ).toMatchObject({
      behavior: "frequency",
      candidates: [
        { value: "done" },
        { value: "draft" },
      ],
    });
  });

  it("suppresses candidates for none behavior", () => {
    const settings = createDefaultSettings();
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "none", propertyKey: "secret" },
    ];

    expect(
      planGroupedPropertyValueSuggestions(
        settings,
        "secret",
        ["a", "b"],
        [],
        [],
      ),
    ).toEqual({ behavior: "none", candidates: [] });
  });

  it("combines native and preset candidates for custom behavior", () => {
    const settings = createDefaultSettings();
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "custom", propertyKey: "status" },
    ];
    settings.valueSuggestionCustomOrders = [
      {
        bottomValues: ["archived", "never-bottom"],
        middleSortMode: "name",
        middleValues: ["manual"],
        pinnedValues: ["never-top"],
        propertyKey: "status",
      },
    ];

    expect(
      planGroupedPropertyValueSuggestions(
        settings,
        "status",
        ["done", "draft", "archived"],
        [],
        [],
      ).candidates,
    ).toEqual([
      { isPreset: true, placement: "pinned", value: "never-top" },
      { isPreset: false, placement: "middle", value: "done" },
      { isPreset: false, placement: "middle", value: "draft" },
      { isPreset: true, placement: "middle", value: "manual" },
      { isPreset: true, placement: "bottom", value: "archived" },
      { isPreset: true, placement: "bottom", value: "never-bottom" },
    ]);
  });
});
