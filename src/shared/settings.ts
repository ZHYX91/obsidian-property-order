import type {
  KeySuggestionSortMode,
  ListWritebackFormat,
  PluginLanguage,
  PropertyOrderSettings,
} from "./types";

export const CURRENT_SETTINGS_SCHEMA_VERSION = 3;

export const DEFAULT_SETTINGS: PropertyOrderSettings = {
  schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  language: "auto",
  enablePropertyValueDrag: true,
  listWritebackFormat: "preserve",
  enableCrossPropertyDrag: false,
  enableNativeKeySuggestionOrder: true,
  keySuggestionSortMode: "name",
  pinnedPropertyKeys: [],
  bottomPropertyKeys: [],
  hiddenPropertyKeyPatterns: [],
  showDiagnostics: false,
};

export function createDefaultSettings(): PropertyOrderSettings {
  return {
    ...DEFAULT_SETTINGS,
    pinnedPropertyKeys: [],
    bottomPropertyKeys: [],
    hiddenPropertyKeyPatterns: [],
  };
}

export function normalizeSettings(value: unknown): PropertyOrderSettings {
  const defaults = createDefaultSettings();

  if (!isRecord(value)) {
    return defaults;
  }

  const migratedValue = migrateSettings(value);

  const enablePropertyValueDrag =
    typeof migratedValue.enablePropertyValueDrag === "boolean"
      ? migratedValue.enablePropertyValueDrag
      : defaults.enablePropertyValueDrag;

  return {
    ...defaults,
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    language: isPluginLanguage(migratedValue.language)
      ? migratedValue.language
      : defaults.language,
    enablePropertyValueDrag,
    listWritebackFormat: isListWritebackFormat(migratedValue.listWritebackFormat)
      ? migratedValue.listWritebackFormat
      : defaults.listWritebackFormat,
    enableCrossPropertyDrag:
      enablePropertyValueDrag && typeof migratedValue.enableCrossPropertyDrag === "boolean"
        ? migratedValue.enableCrossPropertyDrag
        : defaults.enableCrossPropertyDrag,
    enableNativeKeySuggestionOrder:
      typeof migratedValue.enableNativeKeySuggestionOrder === "boolean"
        ? migratedValue.enableNativeKeySuggestionOrder
        : defaults.enableNativeKeySuggestionOrder,
    keySuggestionSortMode: isKeySuggestionSortMode(migratedValue.keySuggestionSortMode)
      ? migratedValue.keySuggestionSortMode
      : defaults.keySuggestionSortMode,
    pinnedPropertyKeys: normalizeStringList(migratedValue.pinnedPropertyKeys),
    bottomPropertyKeys: normalizeStringList(migratedValue.bottomPropertyKeys),
    hiddenPropertyKeyPatterns: normalizeStringList(migratedValue.hiddenPropertyKeyPatterns),
    showDiagnostics:
      typeof migratedValue.showDiagnostics === "boolean"
        ? migratedValue.showDiagnostics
        : defaults.showDiagnostics,
  };
}

export function hasFutureSettingsSchema(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const schemaVersion = value.schemaVersion;
  return (
    typeof schemaVersion === "number" &&
    Number.isInteger(schemaVersion) &&
    schemaVersion > CURRENT_SETTINGS_SCHEMA_VERSION
  );
}

export function prepareSettingsForStorage(
  settings: PropertyOrderSettings,
  storedValue: unknown,
  persistedSettingsBaseline: PropertyOrderSettings = settings,
): Record<string, unknown> {
  const settingsSnapshot = {
    ...settings,
    pinnedPropertyKeys: [...settings.pinnedPropertyKeys],
    bottomPropertyKeys: [...settings.bottomPropertyKeys],
    hiddenPropertyKeyPatterns: [...settings.hiddenPropertyKeyPatterns],
  };

  if (!hasFutureSettingsSchema(storedValue) || !isRecord(storedValue)) {
    return settingsSnapshot;
  }

  const preparedValue = { ...storedValue };

  for (const key of getPersistedSettingKeys()) {
    if (!areSettingValuesEqual(settingsSnapshot[key], persistedSettingsBaseline[key])) {
      preparedValue[key] = cloneSettingValue(settingsSnapshot[key]);
    }
  }

  return preparedValue;
}

export function migrateSettings(value: Record<string, unknown>): Record<string, unknown> {
  if (hasFutureSettingsSchema(value)) {
    return { ...value };
  }

  let migratedValue = { ...value };
  let version = getSettingsSchemaVersion(migratedValue.schemaVersion);

  while (version < CURRENT_SETTINGS_SCHEMA_VERSION) {
    migratedValue = migrateSettingsVersion(migratedValue, version);
    version += 1;
  }

  return migratedValue;
}

export function isListWritebackFormat(value: unknown): value is ListWritebackFormat {
  return value === "preserve" || value === "flow" || value === "block";
}

export function isKeySuggestionSortMode(value: unknown): value is KeySuggestionSortMode {
  return value === "name" || value === "usage";
}

export function isPluginLanguage(value: unknown): value is PluginLanguage {
  return value === "auto" || value === "en" || value === "zh-CN" || value === "zh-TW";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getPersistedSettingKeys(): Array<Exclude<keyof PropertyOrderSettings, "schemaVersion">> {
  return [
    "language",
    "enablePropertyValueDrag",
    "listWritebackFormat",
    "enableCrossPropertyDrag",
    "enableNativeKeySuggestionOrder",
    "keySuggestionSortMode",
    "pinnedPropertyKeys",
    "bottomPropertyKeys",
    "hiddenPropertyKeyPatterns",
    "showDiagnostics",
  ];
}

function areSettingValuesEqual(
  left: PropertyOrderSettings[keyof PropertyOrderSettings],
  right: PropertyOrderSettings[keyof PropertyOrderSettings],
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return left === right;
}

function cloneSettingValue<T extends PropertyOrderSettings[keyof PropertyOrderSettings]>(
  value: T,
): T {
  return (Array.isArray(value) ? [...value] : value) as T;
}

function getSettingsSchemaVersion(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CURRENT_SETTINGS_SCHEMA_VERSION
    ? value
    : 0;
}

function migrateSettingsVersion(
  value: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  if (version === 0) {
    return {
      ...value,
      listWritebackFormat: value.listWritebackFormat ?? value.writebackFormat,
      enableNativeKeySuggestionOrder:
        value.enableNativeKeySuggestionOrder ?? value.enableKeySuggestionOrder,
      keySuggestionSortMode: value.keySuggestionSortMode ?? value.keySortMode,
      schemaVersion: 1,
    };
  }

  if (version === 1) {
    return {
      ...value,
      schemaVersion: 2,
    };
  }

  if (version === 2) {
    return {
      ...value,
      schemaVersion: 3,
    };
  }

  return { ...value, schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION };
}
