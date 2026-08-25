import { describe, expect, it } from "vitest";

import {
  applyPropertyOrderControlValue,
  isPropertyOrderControlKey,
  PROPERTY_ORDER_CONTROL_KEYS,
} from "../../src/app/settings-control-contract";
import { createDefaultSettings } from "../../src/shared/settings";

describe("settings control contract", () => {
  it("defines one mutation and refresh policy for both settings renderers", () => {
    const settings = createDefaultSettings();

    expect(PROPERTY_ORDER_CONTROL_KEYS).toEqual([
      "enableCrossPropertyDrag",
      "enableNativeKeySuggestionOrder",
      "enablePropertyValueDrag",
      "keySuggestionSortMode",
      "language",
      "listWritebackFormat",
      "showDiagnostics",
    ]);
    expect(PROPERTY_ORDER_CONTROL_KEYS.every(isPropertyOrderControlKey)).toBe(true);
    expect(isPropertyOrderControlKey("unknown")).toBe(false);

    expect(applyPropertyOrderControlValue(settings, "language", "zh-CN")).toEqual({
      refreshKeySuggestions: false,
      refreshMode: "structure",
    });
    expect(applyPropertyOrderControlValue(settings, "enablePropertyValueDrag", false)).toEqual({
      refreshKeySuggestions: false,
      refreshMode: "state",
    });
    expect(settings.enableCrossPropertyDrag).toBe(true);
    expect(
      applyPropertyOrderControlValue(settings, "enableNativeKeySuggestionOrder", false),
    ).toEqual({
      refreshKeySuggestions: true,
      refreshMode: "state",
    });
    expect(applyPropertyOrderControlValue(settings, "keySuggestionSortMode", "usage")).toEqual({
      refreshKeySuggestions: true,
      refreshMode: "none",
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
