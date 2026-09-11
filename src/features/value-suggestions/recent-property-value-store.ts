import type { App } from "obsidian";

export const RECENT_PROPERTY_VALUE_STORAGE_KEY =
  "property-order:recent-property-values";
export const RECENT_PROPERTY_VALUE_STORE_VERSION = 1;
export const RECENT_PROPERTY_VALUE_MAX_PROPERTIES = 100;
export const RECENT_PROPERTY_VALUE_MAX_ENTRIES = 100;

interface StoredRecentPropertyValues {
  entries: Array<{
    propertyKey: string;
    values: string[];
  }>;
  version: typeof RECENT_PROPERTY_VALUE_STORE_VERSION;
}

type LocalStorageApp = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

export class RecentPropertyValueStore {
  private entries: Map<string, { propertyKey: string; values: string[] }>;
  private readonly app: LocalStorageApp;
  private readonly storageKey: string;

  constructor(
    app: LocalStorageApp,
    storageKey = RECENT_PROPERTY_VALUE_STORAGE_KEY,
  ) {
    this.app = app;
    this.storageKey = storageKey;
    this.entries = this.loadEntries();
  }

  getValues(rawPropertyKey: string): string[] {
    const propertyKey = normalizePropertyKey(rawPropertyKey);
    return propertyKey == null
      ? []
      : [...(this.entries.get(propertyKey)?.values ?? [])];
  }

  touch(rawPropertyKey: string, rawValue: string): string[] {
    const propertyKey = normalizePropertyKey(rawPropertyKey);
    const value = normalizeValue(rawValue);

    if (propertyKey == null || value == null) {
      return [];
    }

    const existing = this.entries.get(propertyKey);

    if (existing?.values[0] === value) {
      return [...existing.values];
    }

    const nextValues = [
      value,
      ...(existing?.values ?? []).filter((item) => item !== value),
    ].slice(0, RECENT_PROPERTY_VALUE_MAX_ENTRIES);
    this.entries.delete(propertyKey);
    this.entries.set(propertyKey, {
      propertyKey: existing?.propertyKey ?? rawPropertyKey.trim(),
      values: nextValues,
    });

    while (this.entries.size > RECENT_PROPERTY_VALUE_MAX_PROPERTIES) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey == null) {
        break;
      }

      this.entries.delete(oldestKey);
    }

    this.persist();
    return [...nextValues];
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

  private loadEntries(): Map<string, { propertyKey: string; values: string[] }> {
    let storedValue: unknown;

    try {
      storedValue = this.app.loadLocalStorage(this.storageKey);
    } catch {
      return new Map();
    }

    if (!isStoredRecentPropertyValues(storedValue)) {
      return new Map();
    }

    const entries = new Map<string, { propertyKey: string; values: string[] }>();

    for (const entry of storedValue.entries.slice(-RECENT_PROPERTY_VALUE_MAX_PROPERTIES)) {
      if (typeof entry !== "object" || entry == null || Array.isArray(entry)) {
        continue;
      }

      const candidate = entry as { propertyKey?: unknown; values?: unknown };

      if (typeof candidate.propertyKey !== "string" || !Array.isArray(candidate.values)) {
        continue;
      }

      const propertyKey = normalizePropertyKey(candidate.propertyKey);

      if (propertyKey == null) {
        continue;
      }

      const values = normalizeValues(candidate.values);
      entries.set(propertyKey, {
        propertyKey: candidate.propertyKey.trim(),
        values,
      });
    }

    return entries;
  }

  private persist(): void {
    const storedValue: StoredRecentPropertyValues = {
      entries: Array.from(this.entries.values(), (entry) => ({
        propertyKey: entry.propertyKey,
        values: [...entry.values],
      })),
      version: RECENT_PROPERTY_VALUE_STORE_VERSION,
    };

    try {
      this.app.saveLocalStorage(this.storageKey, storedValue);
    } catch {
      // Keep the updated in-memory MRU even when device-local persistence is
      // temporarily unavailable.
    }
  }
}

function isStoredRecentPropertyValues(
  value: unknown,
): value is StoredRecentPropertyValues {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<StoredRecentPropertyValues>;
  return (
    candidate.version === RECENT_PROPERTY_VALUE_STORE_VERSION &&
    Array.isArray(candidate.entries)
  );
}

function normalizeValues(values: readonly unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const value = normalizeValue(rawValue);

    if (value == null || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);

    if (result.length === RECENT_PROPERTY_VALUE_MAX_ENTRIES) {
      break;
    }
  }

  return result;
}

function normalizePropertyKey(value: string): string | null {
  const propertyKey = value.trim().toLocaleLowerCase();
  return propertyKey.length === 0 ? null : propertyKey;
}

function normalizeValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? null : normalizedValue;
}
