import type { App } from "obsidian";

export const RECENT_PROPERTY_KEY_STORAGE_KEY =
  "property-order:recent-property-keys";
export const RECENT_PROPERTY_KEY_STORE_VERSION = 1;
export const RECENT_PROPERTY_KEY_MAX_ENTRIES = 100;

interface StoredRecentPropertyKeys {
  keys: string[];
  version: typeof RECENT_PROPERTY_KEY_STORE_VERSION;
}

interface StoredRecentPropertyKeyCandidate {
  keys: unknown[];
  version: typeof RECENT_PROPERTY_KEY_STORE_VERSION;
}

type LocalStorageApp = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

export class RecentPropertyKeyStore {
  private keys: string[];
  private readonly app: LocalStorageApp;
  private readonly storageKey: string;

  constructor(
    app: LocalStorageApp,
    storageKey = RECENT_PROPERTY_KEY_STORAGE_KEY,
  ) {
    this.app = app;
    this.storageKey = storageKey;
    this.keys = this.loadKeys();
  }

  getKeys(): string[] {
    return [...this.keys];
  }

  touch(rawKey: string): string[] {
    const key = normalizeKey(rawKey);

    if (key == null || this.keys[0] === key) {
      return this.getKeys();
    }

    this.keys = [
      key,
      ...this.keys.filter((existingKey) => existingKey !== key),
    ].slice(0, RECENT_PROPERTY_KEY_MAX_ENTRIES);
    this.persist();
    return this.getKeys();
  }

  clear(): boolean {
    this.keys = [];

    try {
      this.app.saveLocalStorage(this.storageKey, null);
      return true;
    } catch {
      return false;
    }
  }

  private loadKeys(): string[] {
    let storedValue: unknown;

    try {
      storedValue = this.app.loadLocalStorage(this.storageKey);
    } catch {
      return [];
    }

    if (!isStoredRecentPropertyKeys(storedValue)) {
      return [];
    }

    return normalizeKeys(storedValue.keys);
  }

  private persist(): void {
    const storedValue: StoredRecentPropertyKeys = {
      keys: [...this.keys],
      version: RECENT_PROPERTY_KEY_STORE_VERSION,
    };

    try {
      this.app.saveLocalStorage(this.storageKey, storedValue);
    } catch {
      // Keep the updated in-memory MRU even when device-local persistence is
      // temporarily unavailable.
    }
  }
}

function isStoredRecentPropertyKeys(
  value: unknown,
): value is StoredRecentPropertyKeyCandidate {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<StoredRecentPropertyKeyCandidate>;
  return (
    candidate.version === RECENT_PROPERTY_KEY_STORE_VERSION &&
    Array.isArray(candidate.keys)
  );
}

function normalizeKeys(values: readonly unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const key = normalizeKey(rawValue);

    if (key == null || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(key);

    if (result.length === RECENT_PROPERTY_KEY_MAX_ENTRIES) {
      break;
    }
  }

  return result;
}

function normalizeKey(value: string): string | null {
  const key = value.trim();
  return key.length === 0 ? null : key;
}
