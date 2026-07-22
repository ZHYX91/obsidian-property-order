// @vitest-environment happy-dom

import { Platform } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin, {
  VALUE_DRAG_ENABLED_CLASS,
} from "../../src/app/plugin";
import { createDefaultSettings } from "../../src/shared/settings";

function createPlugin(storedSettings: unknown): {
  plugin: PropertyOrderPlugin;
  saveData: ReturnType<typeof vi.fn>;
} {
  const plugin = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
  (plugin as unknown as { app: unknown }).app = {
    workspace: {
      iterateAllLeaves: vi.fn(),
      on: vi.fn(() => ({})),
    },
  };
  vi.spyOn(plugin, "loadData").mockResolvedValue(storedSettings);
  const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();
  return { plugin, saveData };
}

beforeEach(() => {
  document.body.className = "";
  Platform.isMobileApp = false;
});

describe("PropertyOrderPlugin settings persistence", () => {
  it("does not downgrade future settings and preserves unknown fields on explicit save", async () => {
    const storedSettings = {
      ...createDefaultSettings(),
      schemaVersion: 999,
      keySuggestionSortMode: "recent",
      futureOption: { mode: "future" },
    };
    const { plugin, saveData } = createPlugin(storedSettings);

    await plugin.loadSettings();
    expect(saveData).not.toHaveBeenCalled();

    plugin.propertyOrderSettings.showDiagnostics = true;
    await plugin.saveSettings();

    expect(saveData).toHaveBeenCalledWith({
      ...storedSettings,
      showDiagnostics: true,
    });
  });

  it("serializes overlapping saves and writes the latest settings last", async () => {
    const { plugin, saveData } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();
    const resolvers: Array<() => void> = [];
    saveData.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    plugin.propertyOrderSettings.language = "en";
    const firstSave = plugin.saveSettings();
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));

    plugin.propertyOrderSettings.language = "zh-CN";
    const secondSave = plugin.saveSettings();
    expect(saveData).toHaveBeenCalledTimes(1);

    resolvers.shift()?.();
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(2));
    expect(saveData.mock.calls[1]?.[0]).toMatchObject({ language: "zh-CN" });
    resolvers.shift()?.();

    await Promise.all([firstSave, secondSave]);
  });

  it("refreshes the live key menu even when persistence fails", async () => {
    const { plugin, saveData } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();
    const refresh = vi.fn();
    (
      plugin as unknown as {
        keySuggestionOrderController: { refresh(): void };
      }
    ).keySuggestionOrderController = { refresh };
    saveData.mockRejectedValueOnce(new Error("disk unavailable"));

    await expect(plugin.saveSettings(true)).rejects.toThrow("disk unavailable");

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("continues with a queued save after the in-flight batch fails", async () => {
    const { plugin, saveData } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();
    const saves: Array<{
      reject(reason: unknown): void;
      resolve(): void;
    }> = [];
    saveData.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          saves.push({ reject, resolve });
        }),
    );

    plugin.propertyOrderSettings.language = "en";
    const firstSave = plugin.saveSettings();
    const firstResult = expect(firstSave).rejects.toThrow("disk unavailable");
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));

    plugin.propertyOrderSettings.language = "zh-CN";
    const secondSave = plugin.saveSettings();
    saves[0]?.reject(new Error("disk unavailable"));

    await firstResult;
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(2));
    expect(saveData.mock.calls[1]?.[0]).toMatchObject({ language: "zh-CN" });
    saves[1]?.resolve();
    await expect(secondSave).resolves.toBeUndefined();
  });

  it("starts a new batch when a resolved caller immediately requests another save", async () => {
    const { plugin, saveData } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();

    plugin.propertyOrderSettings.language = "en";
    await plugin.saveSettings();
    plugin.propertyOrderSettings.language = "zh-TW";
    await plugin.saveSettings();

    expect(saveData).toHaveBeenCalledTimes(2);
    expect(saveData.mock.calls[1]?.[0]).toMatchObject({ language: "zh-TW" });
  });

  it("scopes touch capture to the enabled setting and removes it on unload", async () => {
    const { plugin } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(true);

    plugin.propertyOrderSettings.enablePropertyValueDrag = false;
    await plugin.saveSettings();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);

    plugin.propertyOrderSettings.enablePropertyValueDrag = true;
    await plugin.saveSettings();
    plugin.onunload();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
  });

  it("does not mark property values as draggable in the mobile app", async () => {
    Platform.isMobileApp = true;
    const { plugin } = createPlugin(createDefaultSettings());

    await plugin.loadSettings();

    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
  });
});
