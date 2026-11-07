import { describe, expect, it } from "vitest";

import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  normalizeSettings,
  prepareSettingsForStorage,
} from "../../src/shared/settings";

describe("retired value suggestion rules", () => {
  const legacy = {
    schemaVersion: 5,
    enableNativeValueSuggestionOrder: true,
    valueSuggestionSortMode: "recent",
    valueSuggestionSortOverrides: [" status = name ", "project_* = usage"],
    pinnedPropertyValues: [" status = draft "],
    bottomPropertyValues: ["status = archived"],
    hiddenPropertyValuePatterns: ["status = cancel*"],
  };

  it("imports equivalent assignments and archives the exact old rule text", () => {
    const settings = normalizeSettings(legacy);

    expect(settings).toMatchObject({
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      enableNativeValueSuggestionOrder: true,
      valueSuggestionDefaultBehavior: "native",
      valueSuggestionPropertyAssignments: [{ propertyKey: "status", behavior: "name" }],
      valueSuggestionLegacyRules: {
        sortMode: "recent",
        sortOverrides: legacy.valueSuggestionSortOverrides,
        pinnedValues: legacy.pinnedPropertyValues,
        bottomValues: legacy.bottomPropertyValues,
        hiddenPatterns: legacy.hiddenPropertyValuePatterns,
      },
    });
    expect(settings).not.toHaveProperty("valueSuggestionLegacyMigrationPending");
    expect(settings).not.toHaveProperty("valueSuggestionSortMode");
    expect(settings.valueSuggestionCustomOrders).toEqual([]);
  });

  it("keeps current grouped choices when importing a schema-7 archive", () => {
    const settings = normalizeSettings({
      ...legacy,
      schemaVersion: 7,
      valueSuggestionLegacyMigrationPending: true,
      valueSuggestionDefaultBehavior: "note-count",
      valueSuggestionPropertyAssignments: [{ propertyKey: "status", behavior: "none" }],
    });

    expect(settings.valueSuggestionDefaultBehavior).toBe("note-count");
    expect(settings.valueSuggestionPropertyAssignments).toEqual([
      { propertyKey: "status", behavior: "none" },
    ]);
    expect(settings).toHaveProperty("valueSuggestionLegacyRules.sortMode", "recent");
  });

  it("does not activate old exact rules that were shadowed by wildcard or recent rules", () => {
    const settings = normalizeSettings({
      schemaVersion: 5,
      valueSuggestionSortOverrides: [
        "project_* = recent", "project_status = name",
        "status = recent", "STATUS = usage",
        "ignored_* = unsupported", "ignored_status = name",
        "priority = usage", "* = none", "source = name",
      ],
    });
    expect(settings.valueSuggestionPropertyAssignments).toEqual([
      { propertyKey: "ignored_status", behavior: "name" },
      { propertyKey: "priority", behavior: "note-count" },
    ]);
    expect(settings).toHaveProperty("valueSuggestionLegacyRules.sortOverrides", [
      "project_* = recent", "project_status = name",
      "status = recent", "STATUS = usage",
      "ignored_* = unsupported", "ignored_status = name",
      "priority = usage", "* = none", "source = name",
    ]);
  });

  it.each([6, 7])("retires shadowed automatic assignments already saved by schema %i", (schemaVersion) => {
    const oldRules = ["project_* = recent", "project_status = name", "status = recent", "STATUS = usage"];
    const stored = {
      schemaVersion,
      valueSuggestionSortMode: "native",
      valueSuggestionSortOverrides: oldRules,
      valueSuggestionLegacyMigrationPending: true,
      valueSuggestionDefaultBehavior: "native",
      // The old migration generated these while its legacy runtime stayed active.
      valueSuggestionPropertyAssignments: [
        { propertyKey: "project_status", behavior: "name" },
        { propertyKey: "STATUS", behavior: "note-count" },
      ],
    };
    const migrated = normalizeSettings(stored);
    expect(migrated.valueSuggestionPropertyAssignments).toEqual([]);
    expect(migrated.valueSuggestionLegacyRules?.sortOverrides).toEqual(oldRules);
    expect(normalizeSettings(prepareSettingsForStorage(migrated, stored))).toEqual(migrated);

    const adopted = normalizeSettings({ ...stored, valueSuggestionLegacyMigrationPending: false });
    expect(adopted.valueSuggestionPropertyAssignments).toEqual(stored.valueSuggestionPropertyAssignments);
    const configured = normalizeSettings({
      ...stored,
      valueSuggestionDefaultBehavior: "frequency",
      valueSuggestionPropertyAssignments: [
        { propertyKey: "project_status", behavior: "none" },
        { propertyKey: "status", behavior: "custom" },
      ],
      valueSuggestionCustomOrders: [{
        propertyKey: "status", pinnedValues: [" keep "], middleValues: [],
        bottomValues: [], middleSortMode: "native",
      }],
    });
    expect(configured.valueSuggestionDefaultBehavior).toBe("frequency");
    expect(configured.valueSuggestionPropertyAssignments).toEqual([
      { propertyKey: "project_status", behavior: "none" },
      { propertyKey: "status", behavior: "custom" },
    ]);
    expect(configured.valueSuggestionCustomOrders[0]?.pinnedValues).toEqual([" keep "]);
  });

  it("persists the archive once and reloads without resurrecting legacy runtime fields", () => {
    const first = normalizeSettings(legacy);
    const stored = prepareSettingsForStorage(first, legacy);
    const reloaded = normalizeSettings(JSON.parse(JSON.stringify(stored)));

    expect(reloaded).toEqual(first);
    expect(stored).not.toHaveProperty("valueSuggestionSortOverrides");
    expect(stored).not.toHaveProperty("valueSuggestionLegacyMigrationPending");
    expect(prepareSettingsForStorage(reloaded, stored)).toEqual(stored);
  });

  it("does not create an archive for unused defaults or interpret future data as legacy", () => {
    expect(normalizeSettings({ schemaVersion: 7, valueSuggestionSortMode: "native" }))
      .toHaveProperty("valueSuggestionLegacyRules", null);
    const future = { ...legacy, schemaVersion: 999, futureOption: ["preserve"] };
    const settings = normalizeSettings(future);
    expect(settings).toHaveProperty("valueSuggestionLegacyRules", null);
    expect(prepareSettingsForStorage(settings, future)).toEqual(future);
  });
});
