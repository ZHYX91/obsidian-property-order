// @vitest-environment happy-dom

import { Notice, Platform } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin, {
  VALUE_DRAG_ENABLED_CLASS,
} from "../../src/app/plugin";
import { KeySuggestionOrderController } from "../../src/features/key-order/key-suggestion-controller";
import { createDefaultSettings } from "../../src/shared/settings";

const MockNotice = Notice as typeof Notice & { messages: string[] };

function createPlugin(storedSettings: unknown): {
  loadData: ReturnType<typeof vi.fn>;
  plugin: PropertyOrderPlugin;
  saveData: ReturnType<typeof vi.fn>;
} {
  const plugin = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
  (plugin as unknown as { app: unknown }).app = {
    workspace: {
      iterateAllLeaves: vi.fn(),
      offref: vi.fn(),
      on: vi.fn(() => ({})),
    },
    metadataCache: {
      on: vi.fn(() => ({})),
    },
  };
  const loadData = vi.spyOn(plugin, "loadData").mockResolvedValue(storedSettings);
  const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();
  return { loadData, plugin, saveData };
}

beforeEach(() => {
  document.body.className = "";
  MockNotice.messages.length = 0;
  Platform.isMobileApp = false;
});

describe("PropertyOrderPlugin settings persistence", () => {
  it("delegates recent-history clearing and reports whether it persisted", () => {
    const { plugin } = createPlugin(createDefaultSettings());
    const clearRecentPropertyKeys = vi.fn(() => false);
    (
      plugin as unknown as {
        keySuggestionOrderController: { clearRecentPropertyKeys(): boolean };
      }
    ).keySuggestionOrderController = { clearRecentPropertyKeys };

    expect(plugin.clearRecentPropertyKeys()).toBe(false);
    expect(clearRecentPropertyKeys).toHaveBeenCalledOnce();
  });

  it("does not register controllers after unloading during async settings load", async () => {
    const { plugin } = createPlugin(createDefaultSettings());
    let resolveLoad!: (value: unknown) => void;
    vi.spyOn(plugin, "loadData").mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const workspaceOn = (
      plugin.app.workspace as unknown as { on: ReturnType<typeof vi.fn> }
    ).on;

    expect(plugin.onload()).toBeUndefined();
    await vi.waitFor(() => expect(resolveLoad).toBeTypeOf("function"));
    plugin.onunload();
    resolveLoad(createDefaultSettings());
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(workspaceOn).not.toHaveBeenCalled();
    expect(document.body.className).toBe("");
    expect(
      (plugin as unknown as { trackedDocuments: Set<Document> }).trackedDocuments.size,
    ).toBe(0);
  });

  it("continues initialization when migrated settings cannot be persisted", async () => {
    const { plugin, saveData } = createPlugin({ schemaVersion: 0 });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveData
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce(undefined);
    const workspaceOn = (
      plugin.app.workspace as unknown as { on: ReturnType<typeof vi.fn> }
    ).on;

    plugin.onload();

    await vi.waitFor(() => expect(workspaceOn).toHaveBeenCalled());
    expect(plugin.hasPendingSettingsSave()).toBe(true);
    expect(MockNotice.messages).toEqual([
      "Property Order: failed to save settings. Try again.",
    ]);

    await expect(plugin.saveSettings()).resolves.toBeUndefined();
    expect(plugin.hasPendingSettingsSave()).toBe(false);
    expect(saveData).toHaveBeenCalledTimes(2);
    error.mockRestore();
    plugin.onunload();
  });

  it("does not resume initialization after unloading during migration persistence", async () => {
    const { plugin, saveData } = createPlugin({ schemaVersion: 0 });
    let resolveSave!: () => void;
    saveData.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const workspaceOn = (
      plugin.app.workspace as unknown as { on: ReturnType<typeof vi.fn> }
    ).on;

    plugin.onload();
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(true);

    plugin.onunload();
    resolveSave();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(workspaceOn).not.toHaveBeenCalled();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(plugin.hasPendingSettingsSave()).toBe(false);
    expect(MockNotice.messages).toEqual([]);
    expect(
      (plugin as unknown as { trackedDocuments: Set<Document> }).trackedDocuments.size,
    ).toBe(0);
  });

  it("releases cleanup callbacks in reverse order and isolates failures", () => {
    const { plugin } = createPlugin(createDefaultSettings());
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const order: string[] = [];
    document.body.classList.add(VALUE_DRAG_ENABLED_CLASS);
    const internals = plugin as unknown as {
      cleanupCallbacks: Array<() => void>;
      trackedDocuments: Set<Document>;
    };
    internals.trackedDocuments.add(document);
    internals.cleanupCallbacks.push(
      () => order.push("first"),
      () => {
        order.push("second");
        throw new Error("cleanup failed");
      },
      () => order.push("third"),
    );

    plugin.onunload();

    expect(order).toEqual(["third", "second", "first"]);
    expect(error).toHaveBeenCalledOnce();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(internals.trackedDocuments.size).toBe(0);
    error.mockRestore();
  });

  it("rolls back document owners when a later controller fails to initialize", async () => {
    const { plugin } = createPlugin(createDefaultSettings());
    const addSettingTab = vi.spyOn(plugin, "addSettingTab");
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const initializeKeySuggestions = vi
      .spyOn(KeySuggestionOrderController.prototype, "initialize")
      .mockImplementation(() => {
        throw new Error("suggestion initialization failed");
      });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    plugin.onload();

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "Property Order: failed to initialize",
        expect.objectContaining({ message: "suggestion initialization failed" }),
      ),
    );
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "pointerdown"),
    ).toHaveLength(1);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === "pointerdown"),
    ).toHaveLength(1);
    expect(addSettingTab).not.toHaveBeenCalled();
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(
      (plugin as unknown as { cleanupCallbacks: Array<() => void> }).cleanupCallbacks,
    ).toEqual([]);

    initializeKeySuggestions.mockRestore();
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
    error.mockRestore();
  });

  it("rejects a stale save requested after unload", async () => {
    const { plugin } = createPlugin(createDefaultSettings());
    await plugin.loadSettings();
    plugin.onunload();

    await expect(plugin.saveSettings()).rejects.toThrow(
      "Property Order settings cannot be saved after plugin unload.",
    );

    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(
      (plugin as unknown as { trackedDocuments: Set<Document> }).trackedDocuments.size,
    ).toBe(0);
  });

  it("does not downgrade future settings and preserves unknown fields on explicit save", async () => {
    const storedSettings = {
      ...createDefaultSettings(),
      schemaVersion: 999,
      keySuggestionSortMode: "future-sort",
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

  it("merges external settings before saving and refreshes affected runtime state", async () => {
    const initialSettings = createDefaultSettings();
    const { plugin, saveData } = createPlugin(initialSettings);
    const loadData = vi.spyOn(plugin, "loadData");
    const externalSettings = {
      ...initialSettings,
      enablePropertyValueDrag: false,
      keySuggestionSortMode: "usage" as const,
    };
    loadData.mockResolvedValueOnce(initialSettings).mockResolvedValueOnce(externalSettings);

    await plugin.loadSettings();
    const refresh = vi.fn();
    (
      plugin as unknown as {
        keySuggestionOrderController: { refresh(): void };
      }
    ).keySuggestionOrderController = { refresh };
    plugin.propertyOrderSettings.language = "zh-CN";

    await plugin.saveSettings();

    expect(saveData).toHaveBeenLastCalledWith({
      ...externalSettings,
      language: "zh-CN",
    });
    expect(plugin.propertyOrderSettings).toMatchObject({
      enablePropertyValueDrag: false,
      keySuggestionSortMode: "usage",
      language: "zh-CN",
    });
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reloads external settings, preserves local edits, and refreshes live surfaces", async () => {
    const initialSettings = createDefaultSettings();
    const { loadData, plugin } = createPlugin(initialSettings);
    await plugin.loadSettings();
    const refreshSuggestions = vi.fn();
    const refreshSettings = vi.fn();
    (
      plugin as unknown as {
        keySuggestionOrderController: { refresh(): void };
        settingTab: { refreshAfterExternalSettingsChange(): void };
      }
    ).keySuggestionOrderController = { refresh: refreshSuggestions };
    (
      plugin as unknown as {
        settingTab: { refreshAfterExternalSettingsChange(): void };
      }
    ).settingTab = { refreshAfterExternalSettingsChange: refreshSettings };
    plugin.propertyOrderSettings.language = "zh-CN";
    loadData.mockResolvedValueOnce({
      ...initialSettings,
      enablePropertyValueDrag: false,
      keySuggestionSortMode: "usage",
    });

    await plugin.onExternalSettingsChange();

    expect(plugin.propertyOrderSettings).toMatchObject({
      enablePropertyValueDrag: false,
      keySuggestionSortMode: "usage",
      language: "zh-CN",
    });
    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(false);
    expect(refreshSuggestions).toHaveBeenCalledOnce();
    expect(refreshSettings).toHaveBeenCalledOnce();
  });

  it("serializes a new instance load behind an older instance's in-flight save", async () => {
    const initialSettings = createDefaultSettings();
    const { plugin: oldPlugin, saveData: oldSaveData } = createPlugin(initialSettings);
    await oldPlugin.loadSettings();
    let resolveOldSave!: () => void;
    oldSaveData.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveOldSave = resolve;
        }),
    );
    oldPlugin.propertyOrderSettings.language = "en";
    const oldSave = oldPlugin.saveSettings();
    await vi.waitFor(() => expect(oldSaveData).toHaveBeenCalledOnce());
    oldPlugin.onunload();

    const { loadData: newLoadData, plugin: newPlugin } = createPlugin({
      ...initialSettings,
      language: "en",
    });
    const newLoad = newPlugin.loadSettings();
    await Promise.resolve();
    expect(newLoadData).not.toHaveBeenCalled();

    resolveOldSave();
    await expect(oldSave).resolves.toBeUndefined();
    await expect(newLoad).resolves.toBe(true);
    expect(newLoadData).toHaveBeenCalledOnce();
    expect(newPlugin.propertyOrderSettings.language).toBe("en");
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

  it("marks property values as available for menu-armed drag in the mobile app", async () => {
    Platform.isMobileApp = true;
    const { plugin } = createPlugin(createDefaultSettings());

    await plugin.loadSettings();

    expect(document.body.classList.contains(VALUE_DRAG_ENABLED_CLASS)).toBe(true);
  });
});
