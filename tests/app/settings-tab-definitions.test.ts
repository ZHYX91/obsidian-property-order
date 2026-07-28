// @vitest-environment happy-dom

import type { SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";

interface TestControl {
  readonly disabled?: boolean | (() => boolean);
  readonly key: string;
  readonly type: string;
}

describe("PropertyOrderSettingTab declarative definitions", () => {
  it("indexes three native pages without traversing the Vault", () => {
    const getMarkdownFiles = vi.fn(() => []);
    const settingTab = createSettingTab({ getMarkdownFiles });

    const pages = getPages(settingTab.getSettingDefinitions());

    expect(pages.map((page) => page.name)).toEqual([
      "General",
      "Value drag",
      "Property name suggestions",
    ]);
    expect(getControlKeys(pages)).toEqual([
      "language",
      "showDiagnostics",
      "enablePropertyValueDrag",
      "listWritebackFormat",
      "enableCrossPropertyDrag",
      "enableNativeKeySuggestionOrder",
      "keySuggestionSortMode",
    ]);
    expect(getMarkdownFiles).not.toHaveBeenCalled();

    const keyOrderItems = pages[2]?.items ?? [];
    const customRuleNames = keyOrderItems
      .filter((item) => "render" in item && typeof item.render === "function")
      .map((item) => item.name)
      .filter((name) =>
        [
          "Pinned property names",
          "Bottom property names",
          "Hidden property name patterns",
        ].includes(name),
      );
    expect(customRuleNames).toEqual([
      "Pinned property names",
      "Bottom property names",
      "Hidden property name patterns",
    ]);
  });

  it("binds custom storage, preserves invariants, and requests required refreshes", async () => {
    const saveSettings = vi.fn<(refreshKeySuggestions?: boolean) => Promise<void>>();
    const settings = createDefaultSettings();
    const settingTab = createSettingTab({ saveSettings, settings });
    const update = vi.spyOn(settingTab, "update");

    expect(settingTab.getControlValue("language")).toBe("auto");
    expect(settingTab.getControlValue("unknown")).toBeUndefined();

    await settingTab.setControlValue("language", "zh-CN");
    expect(settings.language).toBe("zh-CN");
    expect(saveSettings).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);

    await settingTab.setControlValue("keySuggestionSortMode", "usage");
    expect(settings.keySuggestionSortMode).toBe("usage");
    expect(saveSettings).toHaveBeenLastCalledWith(true);
    expect(update).toHaveBeenCalledTimes(1);

    await settingTab.setControlValue("enablePropertyValueDrag", false);
    expect(settings.enablePropertyValueDrag).toBe(false);
    expect(settings.enableCrossPropertyDrag).toBe(false);
    expect(saveSettings).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(2);

    await settingTab.setControlValue("enableCrossPropertyDrag", true);
    expect(settings.enableCrossPropertyDrag).toBe(false);

    await expect(settingTab.setControlValue("language", "invalid")).rejects.toThrow(
      "Invalid Property Order language setting.",
    );
    await expect(settingTab.setControlValue("unknown", true)).rejects.toThrow(
      "Unsupported Property Order setting control: unknown",
    );
  });

  it("disables cross-property drag while the parent feature is disabled", () => {
    const settings = createDefaultSettings();
    const settingTab = createSettingTab({ settings });
    const pages = getPages(settingTab.getSettingDefinitions());
    const crossPropertyControl = getControls(pages).find(
      (control) => control.key === "enableCrossPropertyDrag",
    );

    expect(crossPropertyControl).toBeDefined();
    expect(resolveBoolean(crossPropertyControl?.disabled)).toBe(false);

    settings.enablePropertyValueDrag = false;
    expect(resolveBoolean(crossPropertyControl?.disabled)).toBe(true);
  });
});

function createSettingTab(options: {
  getMarkdownFiles?: () => unknown[];
  saveSettings?: (refreshKeySuggestions?: boolean) => Promise<void>;
  settings?: ReturnType<typeof createDefaultSettings>;
}): PropertyOrderSettingTab {
  const app = {
    metadataCache: {
      getFileCache: vi.fn(),
    },
    vault: {
      getMarkdownFiles: options.getMarkdownFiles ?? vi.fn(() => []),
    },
  };
  const plugin = {
    propertyOrderSettings: options.settings ?? createDefaultSettings(),
    saveSettings: options.saveSettings ?? vi.fn(() => Promise.resolve()),
  };

  return new PropertyOrderSettingTab(app as never, plugin as never);
}

function getPages(definitions: SettingDefinitionItem[]): SettingDefinitionPage[] {
  return definitions.filter(
    (definition): definition is SettingDefinitionPage =>
      "type" in definition && definition.type === "page",
  );
}

function getControlKeys(pages: SettingDefinitionPage[]): string[] {
  return getControls(pages).map((control) => control.key);
}

function getControls(pages: SettingDefinitionPage[]): TestControl[] {
  return pages.flatMap((page) =>
    (page.items ?? []).flatMap((item) => {
      if (!("control" in item) || item.control == null) {
        return [];
      }

      return [item.control as TestControl];
    }),
  );
}

function resolveBoolean(value: boolean | (() => boolean) | undefined): boolean | undefined {
  return typeof value === "function" ? value() : value;
}
