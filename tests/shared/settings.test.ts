import { describe, expect, it } from "vitest";

import {
  createDefaultSettings,
  CURRENT_SETTINGS_SCHEMA_VERSION,
  hasFutureSettingsSchema,
  normalizeSettings,
  prepareSettingsForStorage,
} from "../../src/shared/settings";

describe("normalizeSettings", () => {
  it("falls back to defaults for invalid setting values", () => {
    expect(
      normalizeSettings({
        language: "fr",
        enablePropertyValueDrag: "sure",
        listWritebackFormat: "inline",
        enableCrossPropertyDrag: "yes",
        enableNativeKeySuggestionOrder: false,
        keySuggestionSortMode: "recent",
        pinnedPropertyKeys: [" tags ", "", 42, "aliases"],
        bottomPropertyKeys: "tags",
        hiddenPropertyKeyPatterns: ["TQ_*"],
        showDiagnostics: true,
      }),
    ).toEqual({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      language: "auto",
      enablePropertyValueDrag: true,
      listWritebackFormat: "preserve",
      enableCrossPropertyDrag: false,
      enableNativeKeySuggestionOrder: false,
      keySuggestionSortMode: "name",
      pinnedPropertyKeys: ["tags", "aliases"],
      bottomPropertyKeys: [],
      hiddenPropertyKeyPatterns: ["TQ_*"],
      showDiagnostics: true,
    });
  });

  it("creates fresh default list arrays", () => {
    const first = createDefaultSettings();
    const second = createDefaultSettings();

    first.pinnedPropertyKeys.push("tags");

    expect(second.pinnedPropertyKeys).toEqual([]);
  });

  it("migrates unversioned and legacy keys in schema order", () => {
    const migrated = normalizeSettings({
      schemaVersion: 0,
      writebackFormat: "block",
      enableKeySuggestionOrder: false,
      keySortMode: "usage",
      pinnedPropertyKeys: [" tags ", "tags", "aliases"],
    });

    expect(migrated).toMatchObject({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      listWritebackFormat: "block",
      enableNativeKeySuggestionOrder: false,
      keySuggestionSortMode: "usage",
      pinnedPropertyKeys: ["tags", "aliases"],
    });
  });

  it("rejects the removed alphabetical sort mode without an alias", () => {
    expect(
      normalizeSettings({
        schemaVersion: 2,
        keySuggestionSortMode: "alphabetical",
      }).keySuggestionSortMode,
    ).toBe("name");
  });

  it("reads known fields from a future schema without treating it as legacy", () => {
    expect(normalizeSettings({ schemaVersion: 999, language: "zh-CN" })).toMatchObject({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      language: "zh-CN",
    });
  });

  it("preserves a future schema and unknown fields when saving known settings", () => {
    const stored = {
      schemaVersion: 999,
      language: "zh-CN",
      keySuggestionSortMode: "recent",
      futureOption: { mode: "future" },
    };
    const baseline = normalizeSettings(stored);
    const settings = normalizeSettings(stored);
    settings.showDiagnostics = true;

    expect(hasFutureSettingsSchema(stored)).toBe(true);
    expect(prepareSettingsForStorage(settings, stored, baseline)).toEqual({
      ...stored,
      showDiagnostics: true,
    });

    settings.language = "en";
    expect(prepareSettingsForStorage(settings, stored, baseline)).toEqual({
      ...stored,
      language: "en",
      showDiagnostics: true,
    });
  });

  it("does not overwrite future values for known keys unless the user changes that setting", () => {
    const stored = {
      schemaVersion: 999,
      keySuggestionSortMode: "recent",
      futureOption: { mode: "future" },
    };
    const baseline = normalizeSettings(stored);
    const settings = normalizeSettings(stored);

    settings.pinnedPropertyKeys = ["tags"];

    expect(prepareSettingsForStorage(settings, stored, baseline)).toEqual({
      ...stored,
      pinnedPropertyKeys: ["tags"],
    });
  });

  it("does not classify malformed or current schemas as future", () => {
    expect(hasFutureSettingsSchema({ schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION })).toBe(
      false,
    );
    expect(hasFutureSettingsSchema({ schemaVersion: "999" })).toBe(false);
    expect(hasFutureSettingsSchema(null)).toBe(false);
  });

  it("isolates list arrays across normalized setting objects and their input", () => {
    const input = { pinnedPropertyKeys: ["tags"] };
    const first = normalizeSettings(input);
    const second = normalizeSettings(input);

    first.pinnedPropertyKeys.push("aliases");
    input.pinnedPropertyKeys.push("source-only");

    expect(second.pinnedPropertyKeys).toEqual(["tags"]);
  });

  it("disables cross-property drag when value drag is disabled", () => {
    expect(
      normalizeSettings({
        enablePropertyValueDrag: false,
        enableCrossPropertyDrag: true,
      }).enableCrossPropertyDrag,
    ).toBe(false);
  });

  it("preserves Traditional Chinese language setting", () => {
    expect(normalizeSettings({ language: "zh-TW" }).language).toBe("zh-TW");
  });
});
