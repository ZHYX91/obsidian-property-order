// @vitest-environment happy-dom

import { Platform, type App, type Plugin, type TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ValueSuggestionOrderController } from "../../../src/features/value-suggestions/value-suggestion-controller";
import { createDefaultSettings } from "../../../src/shared/settings";

function createApp(): App {
  return {
    loadLocalStorage: vi.fn(() => null),
    saveLocalStorage: vi.fn(),
    metadataCache: {
      getFileCache: vi.fn(() => null),
      offref: vi.fn(),
      on: vi.fn(() => ({})),
    },
    vault: {
      getMarkdownFiles: vi.fn(() => []),
    },
    workspace: {
      iterateAllLeaves: vi.fn(),
      offref: vi.fn(),
      on: vi.fn(() => ({})),
    },
  } as unknown as App;
}

describe("ValueSuggestionOrderController metadata events", () => {
  afterEach(() => {
    Platform.isIosApp = false;
    Platform.isMacOS = false;
    Platform.isMobileApp = false;
    vi.restoreAllMocks();
  });

  it("handles metadata changed, deleted, and resolved callbacks", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const app = createApp();
    const metadataCallbacks = new Map<
      string,
      (...args: unknown[]) => unknown
    >();
    const metadataOn = vi.fn(
      (name: string, callback: (...args: unknown[]) => unknown) => {
        metadataCallbacks.set(name, callback);
        return {} as never;
      },
    );
    Reflect.set(app.metadataCache, "on", metadataOn);

    const plugin = {
      app,
      registerEvent: vi.fn(),
    } as unknown as Plugin;
    const controller = new ValueSuggestionOrderController(plugin, () => settings);
    const file = { path: "note.md" } as TFile;

    controller.initialize();

    expect(() => {
      metadataCallbacks.get("changed")?.(
        file,
        "",
        { frontmatter: { status: "done" } },
      );
      metadataCallbacks.get("deleted")?.(file);
      metadataCallbacks.get("resolved")?.();
    }).not.toThrow();

    expect(metadataOn).toHaveBeenCalledTimes(3);
    controller.dispose();
  });
});
