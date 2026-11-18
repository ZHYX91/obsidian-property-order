import { describe, expect, it } from "vitest";

import {
  applyPropertyOrderControlValue,
} from "../../src/app/settings-control-contract";
import { createDefaultSettings } from "../../src/shared/settings";

describe("settings control contract", () => {
  it("defines one mutation and refresh policy for both settings renderers", () => {
    const settings = createDefaultSettings();

    expect(applyPropertyOrderControlValue(settings, "language", "zh-CN")).toEqual({
      refreshKeySuggestions: true,
      rerender: true,
    });
    expect(applyPropertyOrderControlValue(settings, "enablePropertyValueDrag", false)).toEqual({
      refreshKeySuggestions: false,
      rerender: true,
    });
    expect(settings.enableCrossPropertyDrag).toBe(true);
    expect(
      applyPropertyOrderControlValue(settings, "enableNativeKeySuggestionOrder", false),
    ).toEqual({
      refreshKeySuggestions: true,
      rerender: true,
    });
    expect(
      applyPropertyOrderControlValue(settings, "groupKeySuggestionsByType", true),
    ).toEqual({
      refreshKeySuggestions: true,
      rerender: false,
    });
    expect(settings.groupKeySuggestionsByType).toBe(true);
    expect(applyPropertyOrderControlValue(settings, "keySuggestionSortMode", "usage")).toEqual({
      refreshKeySuggestions: true,
      rerender: false,
    });
  });

  it("preserves dependent preferences and rejects invalid values centrally", () => {
    const settings = createDefaultSettings();
    settings.enablePropertyValueDrag = false;

    applyPropertyOrderControlValue(settings, "enableCrossPropertyDrag", true);
    expect(settings.enableCrossPropertyDrag).toBe(true);

    expect(() => applyPropertyOrderControlValue(settings, "language", "invalid")).toThrow(
      "Invalid Property Order language setting.",
    );
    expect(() =>
      applyPropertyOrderControlValue(settings, "listWritebackFormat", "invalid"),
    ).toThrow("Invalid Property Order writeback format setting.");
    expect(() =>
      applyPropertyOrderControlValue(settings, "keySuggestionSortMode", "invalid"),
    ).toThrow("Invalid Property Order key suggestion sort setting.");
    expect(() => applyPropertyOrderControlValue(settings, "showDiagnostics", "yes")).toThrow(
      "Invalid boolean value for Property Order setting: showDiagnostics",
    );
  });
});
