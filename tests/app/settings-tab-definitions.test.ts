// @vitest-environment happy-dom

import type {
  Setting,
  SettingDefinitionItem,
  SettingDefinitionPage,
  SettingDefinitionRender,
} from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyNameSuggest } from "../../src/app/property-name-suggest";
import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";

interface TestControl {
  readonly disabled?: boolean | (() => boolean);
  readonly key: string;
  readonly type: string;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
    const refreshDomState = vi.spyOn(settingTab, "refreshDomState");

    expect(settingTab.getControlValue("language")).toBe("auto");
    expect(settingTab.getControlValue("unknown")).toBeUndefined();

    await settingTab.setControlValue("language", "zh-CN");
    expect(settings.language).toBe("zh-CN");
    expect(saveSettings).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).not.toHaveBeenCalled();

    await settingTab.setControlValue("keySuggestionSortMode", "usage");
    expect(settings.keySuggestionSortMode).toBe("usage");
    expect(saveSettings).toHaveBeenLastCalledWith(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).not.toHaveBeenCalled();

    await settingTab.setControlValue("enablePropertyValueDrag", false);
    expect(settings.enablePropertyValueDrag).toBe(false);
    expect(settings.enableCrossPropertyDrag).toBe(false);
    expect(saveSettings).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).toHaveBeenCalledTimes(1);

    await settingTab.setControlValue("enableNativeKeySuggestionOrder", false);
    expect(settings.enableNativeKeySuggestionOrder).toBe(false);
    expect(saveSettings).toHaveBeenLastCalledWith(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).toHaveBeenCalledTimes(2);

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

  it("renders custom rule editors lazily and flushes their lifecycle on cleanup", async () => {
    vi.useFakeTimers();
    const getMarkdownFiles = vi.fn(() => []);
    const saveSettings = vi.fn<(refreshKeySuggestions?: boolean) => Promise<void>>();
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["project"];
    const settingTab = createSettingTab({ getMarkdownFiles, saveSettings, settings });
    const pages = getPages(settingTab.getSettingDefinitions());
    const pinnedDefinition = getRenderDefinition(
      pages[2]?.items ?? [],
      "Pinned property names",
    );
    const close = vi.spyOn(PropertyNameSuggest.prototype, "close");
    const settingHarness = createSettingHarness();

    expect(getMarkdownFiles).not.toHaveBeenCalled();
    const cleanup = pinnedDefinition.render(settingHarness.setting, {} as never);

    expect(getMarkdownFiles).toHaveBeenCalledTimes(1);
    expect(settingHarness.textAreaEl.value).toBe("project");
    expect(Number(settingHarness.textAreaEl.rows)).toBe(5);
    expect(settingHarness.textAreaEl.classList).toContain("property-order-key-list-input");
    expect(settingHarness.textInputEl.classList).toContain(
      "property-order-property-name-input",
    );

    settingHarness.changeTextArea("project\nstatus");
    expect(settings.pinnedPropertyKeys).toEqual(["project"]);
    expect(saveSettings).not.toHaveBeenCalled();

    expect(cleanup).toBeTypeOf("function");
    cleanup?.();
    await vi.waitFor(() => {
      expect(settings.pinnedPropertyKeys).toEqual(["project", "status"]);
      expect(saveSettings).toHaveBeenCalledWith(true);
    });
    expect(close).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    expect(saveSettings).toHaveBeenCalledTimes(1);
  });
});

interface SettingHarness {
  changeTextArea(value: string): void;
  setting: Setting;
  textAreaEl: HTMLTextAreaElement;
  textInputEl: HTMLInputElement;
}

function createSettingHarness(): SettingHarness {
  const settingEl = document.createElement("div");
  const textAreaEl = document.createElement("textarea");
  const textInputEl = document.createElement("input");
  Reflect.set(textAreaEl, "addClass", (className: string) => {
    textAreaEl.classList.add(className);
  });
  Reflect.set(textInputEl, "addClass", (className: string) => {
    textInputEl.classList.add(className);
  });
  let handleTextAreaChange: ((value: string) => void) | null = null;
  const textArea = {
    inputEl: textAreaEl,
    onChange(callback: (value: string) => void) {
      handleTextAreaChange = callback;
      return this;
    },
    setValue(value: string) {
      textAreaEl.value = value;
      return this;
    },
  };
  const text = {
    inputEl: textInputEl,
    setPlaceholder(value: string) {
      textInputEl.placeholder = value;
      return this;
    },
    setValue(value: string) {
      textInputEl.value = value;
      return this;
    },
  };
  const setting = {
    settingEl,
    addText(callback: (component: typeof text) => void) {
      callback(text);
      return this;
    },
    addTextArea(callback: (component: typeof textArea) => void) {
      callback(textArea);
      return this;
    },
    setClass(className: string) {
      settingEl.classList.add(className);
      return this;
    },
  } as unknown as Setting;

  return {
    changeTextArea: (value) => {
      if (handleTextAreaChange == null) {
        throw new Error("Textarea change handler was not registered.");
      }

      textAreaEl.value = value;
      handleTextAreaChange(value);
    },
    setting,
    textAreaEl,
    textInputEl,
  };
}

function getRenderDefinition(
  definitions: SettingDefinitionItem[],
  name: string,
): SettingDefinitionRender {
  const definition = definitions.find(
    (item): item is SettingDefinitionRender =>
      "render" in item && typeof item.render === "function" && item.name === name,
  );

  if (definition == null) {
    throw new Error(`Missing render definition: ${name}`);
  }

  return definition;
}

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
