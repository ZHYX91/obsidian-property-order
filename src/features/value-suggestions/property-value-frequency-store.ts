import type { App } from "obsidian";

import type { PropertyValueUsage } from "../../shared/types";

export const PROPERTY_VALUE_FREQUENCY_STORAGE_KEY =
  "property-order:property-value-frequency";
export const PROPERTY_VALUE_FREQUENCY_STORE_VERSION = 1;
export const PROPERTY_VALUE_FREQUENCY_MAX_PROPERTIES = 100;
export const PROPERTY_VALUE_FREQUENCY_MAX_ENTRIES = 100;

interface StoredPropertyValueFrequency {
  entries: Array<{
    propertyKey: string;
    values: Array<{ count: number; value: string }>;
  }>;
  version: typeof PROPERTY_VALUE_FREQUENCY_STORE_VERSION;
}

type LocalStorageApp = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

interface FrequencyEntry {
  propertyKey: string;
  values: Map<string, number>;
}

export class PropertyValueFrequencyStore {
  private readonly app: LocalStorageApp;
  private entries: Map<string, FrequencyEntry>;
  private readonly storageKey: string;

  constructor(
    app: LocalStorageApp,
    storageKey = PROPERTY_VALUE_FREQUENCY_STORAGE_KEY,
  ) {
    this.app = app;
    this.storageKey = storageKey;
    this.entries = this.loadEntries();
  }

  getCounts(rawPropertyKey: string): PropertyValueUsage[] {
    const propertyKey = normalizePropertyKey(rawPropertyKey);
    const entry = propertyKey == null ? null : this.entries.get(propertyKey);
    if (entry == null) {
      return [];
    }

    return Array.from(entry.values, ([value, count]) => ({ count, value }));
  }

  increment(rawPropertyKey: string, value: string): PropertyValueUsage[] {
    const propertyKey = normalizePropertyKey(rawPropertyKey);

    if (propertyKey == null || value.length === 0) {
      return [];
    }

    const existing = this.entries.get(propertyKey);
    const values = existing?.values ?? new Map<string, number>();
    const nextCount = Math.min(Number.MAX_SAFE_INTEGER, (values.get(value) ?? 0) + 1);

    values.delete(value);
    values.set(value, nextCount);

    while (values.size > PROPERTY_VALUE_FREQUENCY_MAX_ENTRIES) {
      const oldestValue = values.keys().next().value;
      if (oldestValue == null) {
        break;
      }
      values.delete(oldestValue);
    }

    this.entries.delete(propertyKey);
    this.entries.set(propertyKey, {
      propertyKey: existing?.propertyKey ?? rawPropertyKey.trim(),
      values,
    });

    while (this.entries.size > PROPERTY_VALUE_FREQUENCY_MAX_PROPERTIES) {
      const oldestProperty = this.entries.keys().next().value;
      if (oldestProperty == null) {
        break;
      }
      this.entries.delete(oldestProperty);
    }

    this.persist();
    return this.getCounts(rawPropertyKey);
  }

  clear(): boolean {
    this.entries.clear();

    try {
      this.app.saveLocalStorage(this.storageKey, null);
      return true;
    } catch {
      return false;
    }
  }

  private loadEntries(): Map<string, FrequencyEntry> {
    let storedValue: unknown;

    try {
      storedValue = this.app.loadLocalStorage(this.storageKey);
    } catch {
      return new Map();
    }

    if (!isStoredPropertyValueFrequency(storedValue)) {
      return new Map();
    }

    const entries = new Map<string, FrequencyEntry>();

    for (const rawEntry of storedValue.entries.slice(-PROPERTY_VALUE_FREQUENCY_MAX_PROPERTIES)) {
      if (typeof rawEntry !== "object" || rawEntry == null || Array.isArray(rawEntry)) {
        continue;
      }

      const candidate = rawEntry as { propertyKey?: unknown; values?: unknown };
      if (typeof candidate.propertyKey !== "string" || !Array.isArray(candidate.values)) {
        continue;
      }

      const propertyKey = normalizePropertyKey(candidate.propertyKey);
      if (propertyKey == null) {
        continue;
      }

      const values = new Map<string, number>();
      for (const rawValue of candidate.values.slice(-PROPERTY_VALUE_FREQUENCY_MAX_ENTRIES)) {
        if (typeof rawValue !== "object" || rawValue == null || Array.isArray(rawValue)) {
          continue;
        }

        const valueCandidate = rawValue as { count?: unknown; value?: unknown };
        if (
          typeof valueCandidate.value !== "string" ||
          valueCandidate.value.length === 0 ||
          typeof valueCandidate.count !== "number" ||
          !Number.isSafeInteger(valueCandidate.count) ||
          valueCandidate.count <= 0
        ) {
          continue;
        }

        values.delete(valueCandidate.value);
        values.set(valueCandidate.value, valueCandidate.count);
      }

      entries.set(propertyKey, {
        propertyKey: candidate.propertyKey.trim(),
        values,
      });
    }

    return entries;
  }

  private persist(): void {
    const storedValue: StoredPropertyValueFrequency = {
      entries: Array.from(this.entries.values(), (entry) => ({
        propertyKey: entry.propertyKey,
        values: Array.from(entry.values, ([value, count]) => ({ count, value })),
      })),
      version: PROPERTY_VALUE_FREQUENCY_STORE_VERSION,
    };

    try {
      this.app.saveLocalStorage(this.storageKey, storedValue);
    } catch {
      // Keep the current session's counts even when device-local persistence
      // is temporarily unavailable.
    }
  }
}

function isStoredPropertyValueFrequency(
  value: unknown,
): value is StoredPropertyValueFrequency {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<StoredPropertyValueFrequency>;
  return (
    candidate.version === PROPERTY_VALUE_FREQUENCY_STORE_VERSION &&
    Array.isArray(candidate.entries)
  );
}

function normalizePropertyKey(value: string): string | null {
  const propertyKey = value.trim().toLocaleLowerCase();
  return propertyKey.length === 0 ? null : propertyKey;
}
