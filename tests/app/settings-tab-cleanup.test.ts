// @vitest-environment happy-dom

import { Notice, PluginSettingTab } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSettingsDisposer,
  PropertyOrderSettingTab,
} from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";

interface TestLifecycle {
  close(): void;
  flush(): void;
}

interface TestableSettingTab {
  containerEl: HTMLElement;
  keyListSettingCleanups: Map<TestLifecycle, () => void>;
  mountSaveStatus(parentEl: HTMLElement): HTMLElement;
  persistSettings(refreshKeySuggestions?: boolean): Promise<boolean>;
  tabLayoutCleanup: (() => void) | null;
  trackKeyListSetting(lifecycle: TestLifecycle): () => void;
}

const MockNotice = Notice as typeof Notice & { messages: string[] };

beforeEach(() => {
  MockNotice.messages.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PropertyOrderSettingTab cleanup", () => {
  it("runs composed cleanup once in reverse order and isolates failures", () => {
    const calls: string[] = [];
    const failure = new Error("middle cleanup failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cleanup = createSettingsDisposer(
      () => calls.push("first"),
      () => {
        calls.push("second");
        throw failure;
      },
      () => calls.push("third"),
    );

    cleanup();
    cleanup();

    expect(calls).toEqual(["third", "second", "first"]);
    expect(consoleError).toHaveBeenCalledWith(
      "Property Order: failed to clean up settings resource",
      failure,
    );
  });

  it("lets the host hide first, then releases all local resources before emptying", () => {
    const calls: string[] = [];
    const settingTab = createSettingTab();
    const testableSettingTab = settingTab as unknown as TestableSettingTab;
    const firstCleanup = testableSettingTab.trackKeyListSetting({
      close: () => {
        calls.push("close-first");
        throw new Error("close failed");
      },
      flush: () => calls.push("flush-first"),
    });
    const secondCleanup = testableSettingTab.trackKeyListSetting({
      close: () => calls.push("close-second"),
      flush: () => {
        calls.push("flush-second");
        throw new Error("flush failed");
      },
    });
    testableSettingTab.tabLayoutCleanup = () => {
      calls.push("tab");
      throw new Error("tab failed");
    };
    Reflect.set(testableSettingTab.containerEl, "empty", () => {
      calls.push("empty");
      testableSettingTab.containerEl.replaceChildren();
    });
    vi.spyOn(PluginSettingTab.prototype, "hide").mockImplementation(() => {
      calls.push("super");
      throw new Error("host hide failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    settingTab.hide();
    firstCleanup();
    secondCleanup();

    expect(calls).toEqual([
      "super",
      "flush-second",
      "close-second",
      "flush-first",
      "close-first",
      "tab",
      "empty",
    ]);
    expect(testableSettingTab.keyListSettingCleanups.size).toBe(0);
  });

  it("does not refresh a declarative surface after its save resolves post-hide", async () => {
    const save = createDeferred<void>();
    const settingTab = createSettingTab(() => save.promise);
    const update = vi.spyOn(settingTab, "update");
    installEmpty(settingTab.containerEl);

    const pendingChange = settingTab.setControlValue("language", "zh-CN");
    settingTab.hide();
    save.resolve();
    await pendingChange;

    expect(update).not.toHaveBeenCalled();
    expect(settingTab.containerEl.childElementCount).toBe(0);
  });

  it("does not remount failure UI or show a Notice after save rejects post-hide", async () => {
    const save = createDeferred<void>();
    const settingTab = createSettingTab(() => save.promise);
    const testableSettingTab = settingTab as unknown as TestableSettingTab;
    installEmpty(testableSettingTab.containerEl);
    testableSettingTab.mountSaveStatus(testableSettingTab.containerEl);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const pendingSave = testableSettingTab.persistSettings(true);
    settingTab.hide();
    save.reject(new Error("disk unavailable"));

    await expect(pendingSave).resolves.toBe(false);
    expect(testableSettingTab.containerEl.childElementCount).toBe(0);
    expect(MockNotice.messages).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Property Order: failed to save settings",
      expect.any(Error),
    );
  });
});

function createSettingTab(
  saveSettings: (refreshKeySuggestions?: boolean) => Promise<void> = () =>
    Promise.resolve(),
): PropertyOrderSettingTab {
  const app = {
    metadataCache: { getFileCache: vi.fn() },
    vault: { getMarkdownFiles: vi.fn(() => []) },
  };
  const plugin = {
    hasPendingSettingsSave: vi.fn(() => false),
    propertyOrderSettings: createDefaultSettings(),
    saveSettings,
  };

  return new PropertyOrderSettingTab(app as never, plugin as never);
}

function installEmpty(containerEl: HTMLElement): void {
  Reflect.set(containerEl, "empty", () => containerEl.replaceChildren());
}

function createDeferred<T>(): {
  promise: Promise<T>;
  reject(reason: unknown): void;
  resolve(value: T): void;
} {
  let rejectPromise: (reason: unknown) => void = () => undefined;
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}
