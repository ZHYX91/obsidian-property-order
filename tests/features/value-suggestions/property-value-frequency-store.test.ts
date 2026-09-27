import { describe, expect, it, vi } from "vitest";

import {
  PROPERTY_VALUE_FREQUENCY_STORAGE_KEY,
  PropertyValueFrequencyStore,
} from "../../../src/features/value-suggestions/property-value-frequency-store";

describe("PropertyValueFrequencyStore", () => {
  it("counts confirmed selections independently per property", () => {
    const storage = new Map<string, unknown>();
    const store = new PropertyValueFrequencyStore(createStorageApp(storage));

    expect(store.increment("status", "draft")).toEqual([
      { count: 1, value: "draft" },
    ]);
    expect(store.increment("status", "done")).toEqual([
      { count: 1, value: "draft" },
      { count: 1, value: "done" },
    ]);
    expect(store.increment("STATUS", "draft")).toEqual([
      { count: 1, value: "done" },
      { count: 2, value: "draft" },
    ]);
    expect(store.increment("priority", "high")).toEqual([
      { count: 1, value: "high" },
    ]);

    expect(storage.get(PROPERTY_VALUE_FREQUENCY_STORAGE_KEY)).toMatchObject({
      version: 1,
    });
  });

  it("preserves exact candidate values including edge Unicode", () => {
    const store = new PropertyValueFrequencyStore(createStorageApp(new Map()));
    const nbsp = "\u00a0";

    store.increment("status", `draft${nbsp}`);
    store.increment("status", "draft");

    expect(store.getCounts("status")).toEqual([
      { count: 1, value: `draft${nbsp}` },
      { count: 1, value: "draft" },
    ]);
  });

  it("loads only positive safe persisted counts", () => {
    const storage = new Map<string, unknown>([
      [
        PROPERTY_VALUE_FREQUENCY_STORAGE_KEY,
        {
          version: 1,
          entries: [
            {
              propertyKey: "status",
              values: [
                { value: "draft", count: 3 },
                { value: "bad", count: 0 },
                { value: "unsafe", count: Number.MAX_SAFE_INTEGER + 1 },
                { value: 42, count: 1 },
              ],
            },
          ],
        },
      ],
    ]);
    const store = new PropertyValueFrequencyStore(createStorageApp(storage));

    expect(store.getCounts("STATUS")).toEqual([{ count: 3, value: "draft" }]);
  });

  it("clears device-local counts and fails open on storage errors", () => {
    const loadLocalStorage = vi.fn(() => null);
    const saveLocalStorage = vi.fn(() => {
      throw new Error("storage unavailable");
    });
    const store = new PropertyValueFrequencyStore({
      loadLocalStorage,
      saveLocalStorage,
    } as never);

    store.increment("status", "draft");
    expect(store.getCounts("status")).toEqual([{ count: 1, value: "draft" }]);
    expect(store.clear()).toBe(false);
    expect(store.getCounts("status")).toEqual([]);
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
