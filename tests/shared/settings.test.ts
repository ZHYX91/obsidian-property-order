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
        keySuggestionSortMode: "smart",
        pinnedPropertyKeys: [" tags ", "", 42, "aliases"],
        bottomPropertyKeys: "tags",
        hiddenPropertyKeyPatterns: ["TQ_*"],
        enableNativeValueSuggestionOrder: true,
        valueSuggestionSortMode: "smart",
        valueSuggestionSortOverrides: [" status = recent ", 42],
        pinnedPropertyValues: [" status = draft ", ""],
        bottomPropertyValues: "status = done",
        hiddenPropertyValuePatterns: ["status = archived"],
        showDiagnostics: true,
      }),
    ).toEqual({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      language: "auto",
      enablePropertyValueDrag: true,
      listWritebackFormat: "preserve",
      enableCrossPropertyDrag: true,
      enableNativeKeySuggestionOrder: false,
      keySuggestionSortMode: "name",
      pinnedPropertyKeys: ["tags", "aliases"],
      bottomPropertyKeys: [],
      hiddenPropertyKeyPatterns: ["TQ_*"],
      enableNativeValueSuggestionOrder: true,
      valueSuggestionSortMode: "native",
      valueSuggestionSortOverrides: ["status = recent"],
      pinnedPropertyValues: ["status = draft"],
      bottomPropertyValues: [],
      hiddenPropertyValuePatterns: ["status = archived"],
      showDiagnostics: true,
    });
  });

  it("creates fresh default list arrays", () => {
    const first = createDefaultSettings();
    const second = createDefaultSettings();

    first.pinnedPropertyKeys.push("tags");
    first.pinnedPropertyValues.push("status = draft");

    expect(second.pinnedPropertyKeys).toEqual([]);
    expect(second.pinnedPropertyValues).toEqual([]);
  });

  it("enables cross-property drag by default and keeps value suggestions opt-in", () => {
    expect(createDefaultSettings().enableCrossPropertyDrag).toBe(true);
    expect(normalizeSettings({}).enableCrossPropertyDrag).toBe(true);
    expect(createDefaultSettings().enableNativeValueSuggestionOrder).toBe(false);
    expect(createDefaultSettings().valueSuggestionSortMode).toBe("native");
  });

  it("preserves an explicit cross-property drag opt-out", () => {
    expect(
      normalizeSettings({
        enablePropertyValueDrag: true,
        enableCrossPropertyDrag: false,
      }).enableCrossPropertyDrag,
    ).toBe(false);
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
      enableNativeValueSuggestionOrder: false,
      valueSuggestionSortMode: "native",
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

  it("migrates schema 3 while preserving the recent sort mode", () => {
    expect(
      normalizeSettings({
        schemaVersion: 3,
        keySuggestionSortMode: "recent",
      }),
    ).toMatchObject({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      keySuggestionSortMode: "recent",
    });
  });

  it("migrates schema 4 with disabled native value suggestion ordering", () => {
    expect(normalizeSettings({ schemaVersion: 4 })).toMatchObject({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      enableNativeValueSuggestionOrder: false,
      valueSuggestionSortMode: "native",
      valueSuggestionSortOverrides: [],
    });
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
      keySuggestionSortMode: "future-sort",
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
      keySuggestionSortMode: "future-sort",
      valueSuggestionSortMode: "future-value-sort",
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

  it("merges external current-schema changes without overwriting local edits", () => {
    const baseline = createDefaultSettings();
    const settings = createDefaultSettings();
    settings.language = "en";
    const externallyChanged = {
      ...createDefaultSettings(),
      enablePropertyValueDrag: false,
      keySuggestionSortMode: "usage" as const,
      valueSuggestionSortMode: "recent" as const,
      showDiagnostics: true,
    };

    expect(prepareSettingsForStorage(settings, externallyChanged, baseline)).toEqual({
      ...externallyChanged,
      language: "en",
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
    const input = {
      pinnedPropertyKeys: ["tags"],
      pinnedPropertyValues: ["status = draft"],
    };
    const first = normalizeSettings(input);
    const second = normalizeSettings(input);

    first.pinnedPropertyKeys.push("aliases");
    first.pinnedPropertyValues.push("priority = high");
    input.pinnedPropertyKeys.push("source-only");
    input.pinnedPropertyValues.push("source = only");

    expect(second.pinnedPropertyKeys).toEqual(["tags"]);
    expect(second.pinnedPropertyValues).toEqual(["status = draft"]);
  });

  it("preserves the cross-property preference while value drag is disabled", () => {
    expect(
      normalizeSettings({
        enablePropertyValueDrag: false,
        enableCrossPropertyDrag: true,
      }).enableCrossPropertyDrag,
    ).toBe(true);
  });

  it("preserves Traditional Chinese language setting", () => {
    expect(normalizeSettings({ language: "zh-TW" }).language).toBe("zh-TW");
  });
});
