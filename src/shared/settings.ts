import { isSupportedPluginLocale } from "./locale-catalog";
import { createWildcardMatcher } from "../core/suggestions/wildcard";

import type {
  KeySuggestionSortMode,
  LegacyValueSuggestionRules,
  ListWritebackFormat,
  PluginLanguage,
  PropertyOrderSettings,
  PropertyValueBehaviorAssignment,
  PropertyValueCustomOrder,
  ValueSuggestionBehavior,
  ValueSuggestionDefaultBehavior,
  ValueSuggestionKeyDisplayOrder,
  ValueSuggestionMiddleSortMode,
} from "./types";

export const CURRENT_SETTINGS_SCHEMA_VERSION = 8;

export const DEFAULT_SETTINGS: PropertyOrderSettings = {
  schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  language: "auto",
  enablePropertyValueDrag: true,
  listWritebackFormat: "preserve",
  enableCrossPropertyDrag: true,
  enableNativeKeySuggestionOrder: true,
  keySuggestionSortMode: "name",
  groupKeySuggestionsByType: false,
  pinnedPropertyKeys: [],
  bottomPropertyKeys: [],
  hiddenPropertyKeyPatterns: [],
  enableNativeValueSuggestionOrder: false,
  valueSuggestionDefaultBehavior: "native",
  valueSuggestionPropertyAssignments: [],
  valueSuggestionCustomOrders: [],
  valueSuggestionKeyDisplayOrder: "name",
  valueSuggestionLegacyRules: null,
  showDiagnostics: false,
};

export function createDefaultSettings(): PropertyOrderSettings {
  return {
    ...DEFAULT_SETTINGS,
    pinnedPropertyKeys: [],
    bottomPropertyKeys: [],
    hiddenPropertyKeyPatterns: [],
    valueSuggestionPropertyAssignments: [],
    valueSuggestionCustomOrders: [],
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
      typeof migratedValue.enableCrossPropertyDrag === "boolean"
        ? migratedValue.enableCrossPropertyDrag
        : defaults.enableCrossPropertyDrag,
    enableNativeKeySuggestionOrder:
      typeof migratedValue.enableNativeKeySuggestionOrder === "boolean"
        ? migratedValue.enableNativeKeySuggestionOrder
        : defaults.enableNativeKeySuggestionOrder,
    keySuggestionSortMode: isKeySuggestionSortMode(migratedValue.keySuggestionSortMode)
      ? migratedValue.keySuggestionSortMode
      : defaults.keySuggestionSortMode,
    groupKeySuggestionsByType:
      typeof migratedValue.groupKeySuggestionsByType === "boolean"
        ? migratedValue.groupKeySuggestionsByType
        : defaults.groupKeySuggestionsByType,
    pinnedPropertyKeys: normalizeStringList(migratedValue.pinnedPropertyKeys),
    bottomPropertyKeys: normalizeStringList(migratedValue.bottomPropertyKeys),
    hiddenPropertyKeyPatterns: normalizeStringList(migratedValue.hiddenPropertyKeyPatterns),
    enableNativeValueSuggestionOrder:
      typeof migratedValue.enableNativeValueSuggestionOrder === "boolean"
        ? migratedValue.enableNativeValueSuggestionOrder
        : defaults.enableNativeValueSuggestionOrder,
    valueSuggestionDefaultBehavior: isValueSuggestionDefaultBehavior(
      migratedValue.valueSuggestionDefaultBehavior,
    )
      ? migratedValue.valueSuggestionDefaultBehavior
      : defaults.valueSuggestionDefaultBehavior,
    valueSuggestionPropertyAssignments: normalizeValueSuggestionAssignments(
      migratedValue.valueSuggestionPropertyAssignments,
    ),
    valueSuggestionCustomOrders: normalizeValueSuggestionCustomOrders(
      migratedValue.valueSuggestionCustomOrders,
    ),
    valueSuggestionKeyDisplayOrder: isValueSuggestionKeyDisplayOrder(
      migratedValue.valueSuggestionKeyDisplayOrder,
    )
      ? migratedValue.valueSuggestionKeyDisplayOrder
      : defaults.valueSuggestionKeyDisplayOrder,
    valueSuggestionLegacyRules: normalizeLegacyValueSuggestionRules(
      migratedValue.valueSuggestionLegacyRules,
    ),
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
  const settingsSnapshot = cloneSettings(settings);

  const storedSettings = normalizeSettings(storedValue);
  const preparedValue =
    hasFutureSettingsSchema(storedValue) && isRecord(storedValue)
      ? { ...storedValue }
      : { ...cloneSettings(storedSettings) };

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
  return value === "name" || value === "recent" || value === "usage";
}

export function isValueSuggestionBehavior(value: unknown): value is ValueSuggestionBehavior {
  return (
    value === "native" ||
    value === "name" ||
    value === "frequency" ||
    value === "note-count" ||
    value === "none" ||
    value === "custom"
  );
}

export function isValueSuggestionDefaultBehavior(
  value: unknown,
): value is ValueSuggestionDefaultBehavior {
  return isValueSuggestionBehavior(value) && value !== "custom";
}

export function isValueSuggestionMiddleSortMode(
  value: unknown,
): value is ValueSuggestionMiddleSortMode {
  return (
    value === "native" ||
    value === "name" ||
    value === "frequency" ||
    value === "note-count"
  );
}

export function isValueSuggestionKeyDisplayOrder(
  value: unknown,
): value is ValueSuggestionKeyDisplayOrder {
  return value === "name" || value === "recent";
}

export function isPluginLanguage(value: unknown): value is PluginLanguage {
  return value === "auto" || isSupportedPluginLocale(value);
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

function normalizeValueSuggestionAssignments(
  value: unknown,
): PropertyValueBehaviorAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: PropertyValueBehaviorAssignment[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const rawAssignment of value) {
    if (!isRecord(rawAssignment) || !isValueSuggestionBehavior(rawAssignment.behavior)) {
      continue;
    }

    const propertyKey = normalizePropertyKey(rawAssignment.propertyKey);
    if (propertyKey == null) {
      continue;
    }

    const identity = propertyKey.toLocaleLowerCase();
    const previousIndex = indexByIdentity.get(identity);
    if (previousIndex != null) {
      result.splice(previousIndex, 1);
      for (const [key, index] of indexByIdentity) {
        if (index > previousIndex) {
          indexByIdentity.set(key, index - 1);
        }
      }
    }

    indexByIdentity.set(identity, result.length);
    result.push({ behavior: rawAssignment.behavior, propertyKey });
  }

  return result;
}

function normalizeValueSuggestionCustomOrders(value: unknown): PropertyValueCustomOrder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: PropertyValueCustomOrder[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const rawOrder of value) {
    if (!isRecord(rawOrder)) {
      continue;
    }

    const propertyKey = normalizePropertyKey(rawOrder.propertyKey);
    const middleSortMode = isValueSuggestionMiddleSortMode(rawOrder.middleSortMode)
      ? rawOrder.middleSortMode
      : "native";
    if (propertyKey == null) {
      continue;
    }

    const normalizedOrder: PropertyValueCustomOrder = {
      bottomValues: normalizeExactStringList(rawOrder.bottomValues),
      middleSortMode,
      middleValues: normalizeExactStringList(rawOrder.middleValues),
      pinnedValues: normalizeExactStringList(rawOrder.pinnedValues),
      propertyKey,
    };
    const identity = propertyKey.toLocaleLowerCase();
    const previousIndex = indexByIdentity.get(identity);
    if (previousIndex != null) {
      result.splice(previousIndex, 1);
      for (const [key, index] of indexByIdentity) {
        if (index > previousIndex) {
          indexByIdentity.set(key, index - 1);
        }
      }
    }

    indexByIdentity.set(identity, result.length);
    result.push(normalizedOrder);
  }

  return result;
}

function normalizePropertyKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const propertyKey = value.trim();
  return propertyKey.length === 0 ? null : propertyKey;
}

function normalizeExactStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function cloneSettings(settings: PropertyOrderSettings): PropertyOrderSettings {
  return {
    ...settings,
    pinnedPropertyKeys: [...settings.pinnedPropertyKeys],
    bottomPropertyKeys: [...settings.bottomPropertyKeys],
    hiddenPropertyKeyPatterns: [...settings.hiddenPropertyKeyPatterns],
    valueSuggestionLegacyRules: normalizeLegacyValueSuggestionRules(settings.valueSuggestionLegacyRules),
    valueSuggestionPropertyAssignments: settings.valueSuggestionPropertyAssignments.map(
      (assignment) => ({ ...assignment }),
    ),
    valueSuggestionCustomOrders: settings.valueSuggestionCustomOrders.map((order) => ({
      ...order,
      bottomValues: [...order.bottomValues],
      middleValues: [...order.middleValues],
      pinnedValues: [...order.pinnedValues],
    })),
  };
}

function getPersistedSettingKeys(): Array<Exclude<keyof PropertyOrderSettings, "schemaVersion">> {
  return [
    "language",
    "enablePropertyValueDrag",
    "listWritebackFormat",
    "enableCrossPropertyDrag",
    "enableNativeKeySuggestionOrder",
    "keySuggestionSortMode",
    "groupKeySuggestionsByType",
    "pinnedPropertyKeys",
    "bottomPropertyKeys",
    "hiddenPropertyKeyPatterns",
    "enableNativeValueSuggestionOrder",
    "valueSuggestionDefaultBehavior",
    "valueSuggestionPropertyAssignments",
    "valueSuggestionCustomOrders",
    "valueSuggestionKeyDisplayOrder",
    "valueSuggestionLegacyRules",
    "showDiagnostics",
  ];
}

function areSettingValuesEqual(
  left: PropertyOrderSettings[keyof PropertyOrderSettings],
  right: PropertyOrderSettings[keyof PropertyOrderSettings],
): boolean {
  if (
    (Array.isArray(left) && Array.isArray(right)) ||
    (isRecord(left) && isRecord(right))
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return left === right;
}

function cloneSettingValue<T extends PropertyOrderSettings[keyof PropertyOrderSettings]>(
  value: T,
): T {
  return (
    Array.isArray(value) || isRecord(value)
      ? JSON.parse(JSON.stringify(value))
      : value
  ) as T;
}

function getSettingsSchemaVersion(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CURRENT_SETTINGS_SCHEMA_VERSION
    ? value
    : 0;
}

function migrateLegacyValueSuggestionModel(
  value: Record<string, unknown>,
): {
  settings: Pick<PropertyOrderSettings,
    | "valueSuggestionDefaultBehavior"
    | "valueSuggestionPropertyAssignments"
    | "valueSuggestionCustomOrders"
    | "valueSuggestionKeyDisplayOrder">;
  shadowedAssignments: PropertyValueBehaviorAssignment[];
} {
  const legacyDefault = value.valueSuggestionSortMode;
  const valueSuggestionDefaultBehavior: ValueSuggestionDefaultBehavior =
    legacyDefault === "name"
      ? "name"
      : legacyDefault === "usage"
        ? "note-count"
        : legacyDefault === "none"
          ? "none"
          : "native";
  const assignments: PropertyValueBehaviorAssignment[] = [];
  const seenKeys = new Set<string>();
  const previouslyImportedKeys = new Set<string>();
  const shadowedAssignments: PropertyValueBehaviorAssignment[] = [];
  const earlierWildcardRules: Array<(key: string) => boolean> = [];

  for (const rawRule of normalizeStringList(value.valueSuggestionSortOverrides)) {
    const separatorIndex = rawRule.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const propertyKey = rawRule.slice(0, separatorIndex).trim();
    const legacyBehavior = rawRule.slice(separatorIndex + 1).trim();
    if (propertyKey.length === 0 ||
        !["native", "name", "recent", "usage", "none"].includes(legacyBehavior)) {
      continue;
    }

    if (propertyKey.includes("*")) {
      earlierWildcardRules.push(createWildcardMatcher(propertyKey));
      continue;
    }

    const identity = propertyKey.toLocaleLowerCase();
    const shadowed = seenKeys.has(identity) || earlierWildcardRules.some((matches) => matches(propertyKey));
    seenKeys.add(identity);

    const behavior: ValueSuggestionBehavior | null =
      legacyBehavior === "native"
        ? "native"
        : legacyBehavior === "name"
          ? "name"
          : legacyBehavior === "usage"
            ? "note-count"
            : legacyBehavior === "none"
              ? "none"
              : null;
    if (behavior == null) {
      continue;
    }

    // Schema 6/7 could store the first convertible exact rule even when an
    // earlier wildcard/recent rule kept it inactive. Remember only those old
    // generated entries so pending upgrades do not revive them or erase a
    // different, explicitly configured modern choice.
    if (!previouslyImportedKeys.has(identity)) {
      previouslyImportedKeys.add(identity);
      if (shadowed) shadowedAssignments.push({ behavior, propertyKey });
    }
    if (!shadowed) assignments.push({ behavior, propertyKey });
  }

  return {
    settings: {
      valueSuggestionDefaultBehavior,
      valueSuggestionPropertyAssignments: assignments,
      valueSuggestionCustomOrders: [],
      valueSuggestionKeyDisplayOrder: "name",
    },
    shadowedAssignments,
  };
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

  if (version === 3) {
    return {
      ...value,
      schemaVersion: 4,
    };
  }

  if (version === 4) {
    return {
      ...value,
      schemaVersion: 5,
    };
  }

  if (version === 5) {
    return {
      ...value,
      ...migrateLegacyValueSuggestionModel(value).settings,
      schemaVersion: 6,
    };
  }

  if (version === 6) {
    return {
      ...value,
      groupKeySuggestionsByType:
        typeof value.groupKeySuggestionsByType === "boolean"
          ? value.groupKeySuggestionsByType
          : false,
      schemaVersion: 7,
    };
  }

  if (version === 7) {
    const shadowed = value.valueSuggestionLegacyMigrationPending === true
      ? migrateLegacyValueSuggestionModel(value).shadowedAssignments : [];
    const assignments = normalizeValueSuggestionAssignments(value.valueSuggestionPropertyAssignments)
      .filter((assignment) => !shadowed.some((old) =>
        old.propertyKey.toLocaleLowerCase() === assignment.propertyKey.toLocaleLowerCase() &&
        old.behavior === assignment.behavior));
    return {
      ...value,
      valueSuggestionPropertyAssignments: assignments,
      valueSuggestionLegacyRules: normalizeLegacyValueSuggestionRules({
        sortMode: value.valueSuggestionSortMode,
        sortOverrides: value.valueSuggestionSortOverrides,
        pinnedValues: value.pinnedPropertyValues,
        bottomValues: value.bottomPropertyValues,
        hiddenPatterns: value.hiddenPropertyValuePatterns,
      }),
      schemaVersion: 8,
    };
  }

  return { ...value, schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION };
}

function normalizeLegacyValueSuggestionRules(value: unknown): LegacyValueSuggestionRules | null {
  if (!isRecord(value)) return null;
  const strings = (input: unknown): string[] => Array.isArray(input)
    ? input.filter((entry): entry is string => typeof entry === "string")
    : [];
  const rules: LegacyValueSuggestionRules = {
    sortMode: typeof value.sortMode === "string" ? value.sortMode : "native",
    sortOverrides: strings(value.sortOverrides),
    pinnedValues: strings(value.pinnedValues),
    bottomValues: strings(value.bottomValues),
    hiddenPatterns: strings(value.hiddenPatterns),
  };
  return rules.sortMode === "native" && rules.sortOverrides.length === 0 &&
    rules.pinnedValues.length === 0 && rules.bottomValues.length === 0 &&
    rules.hiddenPatterns.length === 0 ? null : rules;
}
