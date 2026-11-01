// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin from "../../src/app/plugin";
import { createDefaultSettings } from "../../src/shared/settings";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
  document.body.className = "";
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("settings storage across plugin module replacement", () => {
  it("finishes an old in-flight write before a fresh module reads and saves", async () => {
    const app = { workspace: { iterateAllLeaves: vi.fn() } };
    let stored: unknown = createDefaultSettings();
    const old = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
    Object.assign(old, { app });
    vi.spyOn(old, "loadData").mockImplementation(async () => stored);
    const started = deferred();
    const release = deferred();
    vi.spyOn(old, "saveData").mockImplementation(async (value: unknown) => {
      started.resolve();
      await release.promise;
      stored = value;
    });
    cleanups.push(() => old.onunload());
    await old.loadSettings();
    old.propertyOrderSettings.language = "zh-CN";
    const oldSave = old.saveSettings();
    await started.promise;
    old.onunload();

    vi.resetModules();
    const { default: FreshPlugin } = await import("../../src/app/plugin");
    const fresh = new (FreshPlugin as unknown as new () => PropertyOrderPlugin)();
    Object.assign(fresh, { app });
    const read = vi.spyOn(fresh, "loadData").mockImplementation(async () => stored);
    vi.spyOn(fresh, "saveData").mockImplementation(async (value: unknown) => { stored = value; });
    cleanups.push(() => fresh.onunload());
    const loading = fresh.loadSettings();
    await Promise.resolve();
    expect(read).not.toHaveBeenCalled();
    release.resolve();
    await Promise.all([oldSave, loading]);
    expect(fresh.propertyOrderSettings.language).toBe("zh-CN");
    fresh.propertyOrderSettings.pinnedPropertyKeys = ["new-instance"];
    await fresh.saveSettings();
    expect(stored).toMatchObject({ language: "zh-CN", pinnedPropertyKeys: ["new-instance"] });
  });

  it("does not block another Vault behind a pending storage operation", async () => {
    const release = deferred();
    const first = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
    const second = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
    for (const plugin of [first, second]) {
      Object.assign(plugin, { app: { workspace: { iterateAllLeaves: vi.fn() } } });
      cleanups.push(() => plugin.onunload());
    }
    vi.spyOn(first, "loadData").mockImplementation(async () => {
      await release.promise;
      return createDefaultSettings();
    });
    const read = vi.spyOn(second, "loadData").mockResolvedValue(createDefaultSettings());
    const firstLoad = first.loadSettings();
    const secondLoad = second.loadSettings();
    await Promise.resolve();
    expect(read).toHaveBeenCalledOnce();
    release.resolve();
    await Promise.all([firstLoad, secondLoad]);
  });
});
