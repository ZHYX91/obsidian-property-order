import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
  RECENT_PROPERTY_KEY_MAX_ENTRIES,
  RECENT_PROPERTY_KEY_STORAGE_KEY,
  RECENT_PROPERTY_KEY_STORE_VERSION,
  RecentPropertyKeyStore,
} from "../../../src/features/key-order/recent-property-key-store";

interface StorageHarness {
  app: Pick<App, "loadLocalStorage" | "saveLocalStorage">;
  loadLocalStorage: ReturnType<typeof vi.fn>;
  saveLocalStorage: ReturnType<typeof vi.fn>;
}

function createStorageHarness(storedValue: unknown): StorageHarness {
  const loadLocalStorage = vi.fn(() => storedValue);
  const saveLocalStorage = vi.fn();

  return {
    app: {
      loadLocalStorage,
      saveLocalStorage,
    } as unknown as Pick<App, "loadLocalStorage" | "saveLocalStorage">,
    loadLocalStorage,
    saveLocalStorage,
  };
}

describe("RecentPropertyKeyStore", () => {
  it("loads versioned device-local history and returns defensive copies", () => {
    const harness = createStorageHarness({
      version: RECENT_PROPERTY_KEY_STORE_VERSION,
      keys: [" project ", "status", "project", "Status", "two words"],
    });
    const store = new RecentPropertyKeyStore(harness.app);

    const keys = store.getKeys();
    expect(keys).toEqual(["project", "status", "Status", "two words"]);
    keys.push("external mutation");

    expect(store.getKeys()).toEqual(["project", "status", "Status", "two words"]);
    expect(harness.loadLocalStorage).toHaveBeenCalledWith(
      RECENT_PROPERTY_KEY_STORAGE_KEY,
    );
    expect(harness.saveLocalStorage).not.toHaveBeenCalled();
  });

  it("touches exact keys in MRU order and persists versioned snapshots", () => {
    const harness = createStorageHarness({
      version: RECENT_PROPERTY_KEY_STORE_VERSION,
      keys: ["alpha", "beta"],
    });
    const store = new RecentPropertyKeyStore(harness.app);

    expect(store.touch(" beta ")).toEqual(["beta", "alpha"]);
    expect(harness.saveLocalStorage).toHaveBeenLastCalledWith(
      RECENT_PROPERTY_KEY_STORAGE_KEY,
      {
        version: RECENT_PROPERTY_KEY_STORE_VERSION,
        keys: ["beta", "alpha"],
      },
    );

    expect(store.touch("beta")).toEqual(["beta", "alpha"]);
    expect(harness.saveLocalStorage).toHaveBeenCalledTimes(1);

    expect(store.touch("ALPHA")).toEqual(["ALPHA", "beta", "alpha"]);
    expect(store.touch("two  words")).toEqual([
      "two  words",
      "ALPHA",
      "beta",
      "alpha",
    ]);
    expect(store.touch("   ")).toEqual([
      "two  words",
      "ALPHA",
      "beta",
      "alpha",
    ]);
    expect(harness.saveLocalStorage).toHaveBeenCalledTimes(3);
  });

  it("normalizes, deduplicates, and truncates loaded history", () => {
    const sourceKeys = [
      " key-0 ",
      "key-0",
      "",
      42,
      ...Array.from(
        { length: RECENT_PROPERTY_KEY_MAX_ENTRIES + 5 },
        (_, index) => `key-${index + 1}`,
      ),
    ];
    const harness = createStorageHarness({
      version: RECENT_PROPERTY_KEY_STORE_VERSION,
      keys: sourceKeys,
    });
    const store = new RecentPropertyKeyStore(harness.app);

    expect(store.getKeys()).toHaveLength(RECENT_PROPERTY_KEY_MAX_ENTRIES);
    expect(store.getKeys()[0]).toBe("key-0");
    expect(store.getKeys().at(-1)).toBe("key-99");
  });

  it("keeps at most one hundred keys when touching new entries", () => {
    const harness = createStorageHarness(null);
    const store = new RecentPropertyKeyStore(harness.app);

    for (let index = 0; index <= RECENT_PROPERTY_KEY_MAX_ENTRIES; index += 1) {
      store.touch(`key-${index}`);
    }

    expect(store.getKeys()).toHaveLength(RECENT_PROPERTY_KEY_MAX_ENTRIES);
    expect(store.getKeys()[0]).toBe(`key-${RECENT_PROPERTY_KEY_MAX_ENTRIES}`);
    expect(store.getKeys().at(-1)).toBe("key-1");
    expect(harness.saveLocalStorage).toHaveBeenLastCalledWith(
      RECENT_PROPERTY_KEY_STORAGE_KEY,
      {
        version: RECENT_PROPERTY_KEY_STORE_VERSION,
        keys: store.getKeys(),
      },
    );
  });

  it.each([
    null,
    "not-an-object",
    [],
    {},
    { version: 0, keys: ["alpha"] },
    { version: RECENT_PROPERTY_KEY_STORE_VERSION, keys: "alpha" },
  ])("safely falls back for malformed stored data: %j", (storedValue) => {
    const harness = createStorageHarness(storedValue);
    const store = new RecentPropertyKeyStore(harness.app);

    expect(store.getKeys()).toEqual([]);
  });

  it("safely falls back when device-local storage cannot be read", () => {
    const harness = createStorageHarness(null);
    harness.loadLocalStorage.mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(new RecentPropertyKeyStore(harness.app).getKeys()).toEqual([]);
  });

  it("clears both in-memory and persisted history", () => {
    const harness = createStorageHarness({
      version: RECENT_PROPERTY_KEY_STORE_VERSION,
      keys: ["alpha", "beta"],
    });
    const store = new RecentPropertyKeyStore(harness.app, "custom-history-key");

    expect(store.clear()).toBe(true);

    expect(store.getKeys()).toEqual([]);
    expect(harness.saveLocalStorage).toHaveBeenCalledWith(
      "custom-history-key",
      null,
    );
  });

  it("keeps in-memory history usable when device-local writes fail", () => {
    const harness = createStorageHarness(null);
    harness.saveLocalStorage.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const store = new RecentPropertyKeyStore(harness.app);

    expect(() => store.touch("status")).not.toThrow();
    expect(store.getKeys()).toEqual(["status"]);
    expect(store.clear()).toBe(false);
    expect(store.getKeys()).toEqual([]);
  });
});
