import { describe, expect, it, vi } from "vitest";

import {
  RECENT_PROPERTY_VALUE_STORAGE_KEY,
  RecentPropertyValueStore,
} from "../../../src/features/value-suggestions/recent-property-value-store";

describe("RecentPropertyValueStore", () => {
  it("keeps independent MRU lists per property", () => {
    const storage = new Map<string, unknown>();
    const app = createStorageApp(storage);
    const store = new RecentPropertyValueStore(app);

    expect(store.touch("status", "draft")).toEqual(["draft"]);
    expect(store.touch("status", "done")).toEqual(["done", "draft"]);
    expect(store.touch("priority", "high")).toEqual(["high"]);
    expect(store.touch("STATUS", "draft")).toEqual(["draft", "done"]);

    expect(store.getValues("status")).toEqual(["draft", "done"]);
    expect(store.getValues("priority")).toEqual(["high"]);
    expect(storage.get(RECENT_PROPERTY_VALUE_STORAGE_KEY)).toMatchObject({ version: 1 });
  });

  it("loads valid persisted entries and ignores malformed values", () => {
    const storage = new Map<string, unknown>([
      [
        RECENT_PROPERTY_VALUE_STORAGE_KEY,
        {
          version: 1,
          entries: [
            { propertyKey: "status", values: ["done", "", 42, "done", "draft"] },
            { propertyKey: "", values: ["ignored"] },
          ],
        },
      ],
    ]);
    const store = new RecentPropertyValueStore(createStorageApp(storage));

    expect(store.getValues("status")).toEqual(["done", "draft"]);
  });

  it("clears both in-memory and device-local history", () => {
    const storage = new Map<string, unknown>();
    const app = createStorageApp(storage);
    const store = new RecentPropertyValueStore(app);
    store.touch("status", "draft");

    expect(store.clear()).toBe(true);
    expect(store.getValues("status")).toEqual([]);
    expect(storage.get(RECENT_PROPERTY_VALUE_STORAGE_KEY)).toBeNull();
  });

  it("keeps session history when persistence is unavailable", () => {
    const loadLocalStorage = vi.fn(() => null);
    const saveLocalStorage = vi.fn(() => {
      throw new Error("storage unavailable");
    });
    const store = new RecentPropertyValueStore({ loadLocalStorage, saveLocalStorage } as never);

    expect(store.touch("status", "draft")).toEqual(["draft"]);
    expect(store.getValues("status")).toEqual(["draft"]);
    expect(store.clear()).toBe(false);
    expect(store.getValues("status")).toEqual([]);
  });
});

function createStorageApp(storage: Map<string, unknown>): {
  loadLocalStorage(key: string): unknown;
  saveLocalStorage(key: string, value: unknown): void;
} {
  return {
    loadLocalStorage: (key) => storage.get(key) ?? null,
    saveLocalStorage: (key, value) => {
      storage.set(key, value);
    },
  };
}
