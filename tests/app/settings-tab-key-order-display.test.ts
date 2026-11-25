// @vitest-environment happy-dom

import { Setting, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin from "../../src/app/plugin";
import { PropertyNameSuggest } from "../../src/app/property-name-suggest";
import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";
import type { PropertyOrderSettings } from "../../src/shared/types";

const patchedSettingMethods = [
  "setName",
  "setDesc",
  "setClass",
  "addToggle",
  "addDropdown",
  "addButton",
  "addTextArea",
  "addText",
] as const;

beforeEach(() => {
  document.body.replaceChildren();
  installSettingHarness();
});

afterEach(() => {
  for (const method of patchedSettingMethods) {
    Reflect.deleteProperty(Setting.prototype, method);
  }
  vi.restoreAllMocks();
});

describe("Property Order settings tabs", () => {
  it("opens every settings tab directly on a labeled control", () => {
    const tab = mountSettingsTab(createDefaultSettings(), vi.fn(async () => undefined));
    tab.display();
    try {
      const controls = [
        ["general", "Interface language", "select"],
        ["valueDrag", "Enable property value drag", "input"],
        ["keyOrder", "Customize property name suggestions", "input"],
        ["valueSuggestions", "Customize property value suggestions", "input"],
      ] as const;
      for (const [id, name, control] of controls) {
        tab.containerEl.querySelector<HTMLButtonElement>(`[role="tab"][data-tab-id="${id}"]`)!.click();
        const first = tab.containerEl.querySelector<HTMLElement>(
          '[role="tabpanel"] :is(.setting-item, h1, h2, h3, h4, h5, h6, [role="heading"])',
        );
        expect(first?.dataset.settingName).toBe(name);
        expect(first?.querySelector(control)).toBeTruthy();
      }
    } finally {
      tab.hide();
    }
  });

  it("keeps help open while switching tabs and ignores events from a closed session", () => {
    const tab = mountSettingsTab(createDefaultSettings(), vi.fn(async () => undefined));
    expect(tab.getSettingDefinitions()).toEqual([]);
    tab.display();
    const tabs = () => [...tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")];
    expect(tabs().map((button) => button.textContent)).toEqual([
      "General", "Value order", "Key suggestions", "Value suggestions",
    ]);
    const examples = () => tab.containerEl.querySelector<HTMLDetailsElement>("details")!;
    tabs()[1]!.click();
    const help = examples();
    const formatRow = help.closest(".setting-item")!;
    expect(formatRow.querySelector("select")?.value).toBe("preserve");
    expect(formatRow.textContent).toContain("may remove item comments and blank lines");
    expect(help.querySelector("select, button, input")).toBeNull();
    expect(help.querySelector("summary")?.textContent).toBe("Format examples");
    expect(help.open).toBe(false);
    help.open = true;
    expect([...help.querySelectorAll("pre")].map((sample) => sample.dir)).toEqual(["ltr", "ltr", "ltr", "ltr"]);
    tabs()[0]!.click();
    tabs()[1]!.click();
    const previous = examples();
    expect(previous.open).toBe(true);
    tab.hide();
    previous.dispatchEvent(new Event("toggle"));
    tab.display();
    expect(examples().open).toBe(false);
    tab.hide();
  });

  it("keeps migration guidance visible and remembers the archive only within this session", () => {
    const settings = createDefaultSettings();
    settings.valueSuggestionLegacyRules = {
      sortMode: "native", sortOverrides: [], pinnedValues: ["status = open"], bottomValues: [], hiddenPatterns: [],
    };
    const tab = mountSettingsTab(settings, vi.fn(async () => undefined));
    tab.display();
    const choose = (index: number) => tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")[index]!.click();
    const archive = () => tab.containerEl.querySelector<HTMLDetailsElement>(".property-order-value-suggestion-migration details")!;
    choose(3);
    expect(archive().open).toBe(false);
    expect(archive().previousElementSibling?.textContent).toBeTruthy();
    archive().open = true;
    choose(1);
    expect(tab.containerEl.querySelector<HTMLDetailsElement>("details")?.open).toBe(false);
    choose(3);
    expect(archive().open).toBe(true);
    tab.hide();
    tab.display();
    expect(archive().open).toBe(false);
    tab.hide();
  });

  it("shows only the chosen sorting explanation and updates it before saving", () => {
    const tab = mountSettingsTab(createDefaultSettings(), vi.fn(async () => undefined));
    tab.display();
    const cases = [[2, "usage", "notes containing the property"], [3, "none", "still allows typing"]] as const;
    for (const [page, mode, expected] of cases) {
      tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")[page]!.click();
      const select = tab.containerEl.querySelector<HTMLSelectElement>(".setting-item select")!;
      const row = select.closest<HTMLElement>(".setting-item")!;
      expect(row.dataset.settingDescription).not.toContain(expected);
      select.value = mode;
      select.dispatchEvent(new Event("change"));
      expect(row.dataset.settingDescription).toContain(expected);
    }
    tab.hide();
  });

  it("previews a key rule without saving it and releases the preview on close", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["status"];
    const save = vi.fn(async () => undefined);
    const tab = mountSettingsTab(settings, save);
    tab.display();
    tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")[2]!.click();
    const input = tab.containerEl.querySelector<HTMLInputElement>('input[placeholder="Property name..."]')!;
    input.value = "status";
    input.dispatchEvent(new Event("input"));
    expect(tab.containerEl.textContent).toContain("Result: pinned");
    expect(save).not.toHaveBeenCalled();
    tab.hide();
    tab.display();
    expect(tab.containerEl.textContent).toContain("Enter a property name to test the current rules.");
    tab.hide();
  });

  it("audit regression: a second edit keeps key rules discovered by the previous save", async () => {
    const app = {
      metadataCache: { getFileCache: vi.fn() },
      vault: { getMarkdownFiles: vi.fn(() => []) },
      workspace: { iterateAllLeaves: vi.fn() },
    } as unknown as App;
    const plugin = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
    plugin.app = app;
    let storedSettings = createDefaultSettings();
    storedSettings.pinnedPropertyKeys = ["status"];
    vi.spyOn(plugin, "loadData").mockImplementation(async () => cloneSettings(storedSettings));
    vi.spyOn(plugin, "saveData").mockImplementation(async (data) => {
      storedSettings = cloneSettings(data as PropertyOrderSettings);
    });
    await plugin.loadSettings();

    const tab = new PropertyOrderSettingTab(app, plugin);
    Reflect.set(plugin, "settingTab", tab);
    Reflect.set(tab.containerEl, "empty", function (this: HTMLElement) {
      this.replaceChildren();
    });
    document.body.appendChild(tab.containerEl);
    try {
      tab.display();
      tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")[2]!.click();

      const getSearch = () => tab.containerEl.querySelector<HTMLInputElement>(
        ".property-order-key-list-setting .property-order-property-name-input",
      )!;
      const search = getSearch();
      search.value = "pending lookup";
      search.focus();
      search.setSelectionRange(2, 7, "backward");
      storedSettings.showDiagnostics = true;
      await plugin.onExternalSettingsChange();
      expect(getSearch()).toBe(search);
      expect(document.activeElement).toBe(search);

      // Sync changes disk before Obsidian sends the external-settings event.
      storedSettings.pinnedPropertyKeys.push("owner");
      getGroupingToggle(tab.containerEl).click();
      await vi.waitFor(() => {
        expect(plugin.propertyOrderSettings.pinnedPropertyKeys).toEqual(["status", "owner"]);
      });

      const restored = getSearch();
      expect(restored.value).toBe("pending lookup");
      expect(document.activeElement).toBe(restored);
      expect([restored.selectionStart, restored.selectionEnd, restored.selectionDirection])
        .toEqual([2, 7, "backward"]);
      const pinned = tab.containerEl.querySelector<HTMLTextAreaElement>(
        ".property-order-key-list-setting textarea",
      )!;
      pinned.value += "\npriority";
      pinned.dispatchEvent(new Event("input"));
      await vi.waitFor(() => expect(storedSettings.pinnedPropertyKeys).toContain("priority"));
      expect(storedSettings.pinnedPropertyKeys).toEqual(["status", "owner", "priority"]);
    } finally {
      tab.hide();
    }
  });

  it("keeps the caret and the debounced sibling rule while applying an external rule", () => {
    const settings = createDefaultSettings();
    const tab = mountSettingsTab(settings, vi.fn(async () => undefined));
    tab.display();
    tab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]")[2]!.click();
    const getBottom = () => tab.containerEl.querySelectorAll("textarea")[1]!;
    const bottom = getBottom();
    bottom.value = " later \n";
    bottom.dispatchEvent(new Event("input"));
    bottom.focus();
    bottom.setSelectionRange(1, 4, "forward");

    settings.hiddenPropertyKeyPatterns = ["remote-*"];
    tab.refreshAfterExternalSettingsChange(["hiddenPropertyKeyPatterns"]);
    expect(tab.containerEl.querySelectorAll("textarea")[2]!.value).toBe("remote-*");
    expect(settings.bottomPropertyKeys).toEqual(["later"]);
    expect(getBottom().value).toBe(" later \n");
    expect(document.activeElement).toBe(getBottom());
    expect([getBottom().selectionStart, getBottom().selectionEnd]).toEqual([1, 4]);
    tab.hide();
  });

  it.each([true, false])("applies a queued key suggestion only while its input is mounted (%s)", async (replace) => {
    const input = document.body.createEl("input");
    const onSelect = vi.fn(async () => undefined);
    const suggest = new PropertyNameSuggest({} as App, input, {
      availableNames: ["owner"], getExcludedNames: () => [], onSelect,
    });
    suggest.selectSuggestion("owner");
    if (replace) input.remove();
    await Promise.resolve();

    if (replace) expect(onSelect).not.toHaveBeenCalled();
    else expect(onSelect).toHaveBeenCalledExactlyOnceWith("owner");
    input.remove();
  });

  it("renders, persists, refreshes, and rerenders the property-type grouping toggle", async () => {
    const settings = createDefaultSettings();
    let persisted = cloneSettings(settings);
    const refreshKeySuggestions = vi.fn();
    const saveSettings = vi.fn(async (refreshKeys = false) => {
      persisted = cloneSettings(settings);
      if (refreshKeys) {
        refreshKeySuggestions();
      }
    });
    const settingTab = mountSettingsTab(settings, saveSettings);

    settingTab.display();
    const keySuggestionsTab = Array.from(
      settingTab.containerEl.querySelectorAll<HTMLButtonElement>("[role=tab]"),
    ).find((button) => button.textContent === "Key suggestions");
    expect(keySuggestionsTab).toBeDefined();
    keySuggestionsTab?.click();

    const firstToggle = getGroupingToggle(settingTab.containerEl);
    expect(firstToggle.checked).toBe(false);

    firstToggle.click();
    await vi.waitFor(() => {
      expect(settings.groupKeySuggestionsByType).toBe(true);
      expect(persisted.groupKeySuggestionsByType).toBe(true);
      expect(saveSettings).toHaveBeenLastCalledWith(true, false);
      expect(refreshKeySuggestions).toHaveBeenCalledTimes(1);
    });

    settingTab.display();
    const rerenderedToggle = getGroupingToggle(settingTab.containerEl);
    expect(rerenderedToggle).not.toBe(firstToggle);
    expect(rerenderedToggle.checked).toBe(true);
  });
});

function mountSettingsTab(settings: PropertyOrderSettings, saveSettings: (refreshKeys?: boolean) => Promise<void>) {
  const app = {
    metadataCache: { getFileCache: vi.fn() },
    vault: { getMarkdownFiles: vi.fn(() => []) },
  } as unknown as App;
  const plugin = {
    clearRecentPropertyKeys: vi.fn(() => true),
    clearPropertyValueFrequency: vi.fn(() => true),
    getPropertyValueFrequency: vi.fn(() => []),
    hasPendingSettingsSave: vi.fn(() => false),
    propertyOrderSettings: settings,
    saveSettings,
  };
  const settingTab = new PropertyOrderSettingTab(app, plugin as never);
  Reflect.set(settingTab.containerEl, "empty", function (this: HTMLElement) {
    this.replaceChildren();
  });
  document.body.appendChild(settingTab.containerEl);
  return settingTab;
}

function getGroupingToggle(container: HTMLElement): HTMLInputElement {
  const row = container.querySelector<HTMLElement>(
    '[data-setting-name="Group suggestions by property type"]',
  );
  const toggle = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (toggle == null) {
    throw new Error("Expected the imperative property-type grouping toggle.");
  }
  return toggle;
}

function installSettingHarness(): void {
  const rows = new WeakMap<object, HTMLElement>();

  const ensureRow = (setting: object): HTMLElement => {
    const existing = rows.get(setting);
    if (existing != null) {
      return existing;
    }

    const panel = document.querySelector<HTMLElement>(".property-order-settings-panel");
    if (panel == null) {
      throw new Error("Expected an active imperative settings panel.");
    }
    const row = Reflect.get(setting, "settingEl") as HTMLElement;
    rows.set(setting, row);
    return row;
  };

  Reflect.set(Setting.prototype, "setName", function (this: Setting, name: string) {
    ensureRow(this).dataset.settingName = name;
    return this;
  });
  Reflect.set(Setting.prototype, "setDesc", function (this: Setting, description: string) {
    const row = ensureRow(this);
    const descEl = Reflect.get(this, "descEl") as HTMLElement;
    descEl.textContent = description;
    row.dataset.settingDescription = description;
    return this;
  });
  Reflect.set(Setting.prototype, "setClass", function (this: Setting, className: string) {
    ensureRow(this).classList.add(className);
    return this;
  });
  Reflect.set(Setting.prototype, "addToggle", function (
    this: Setting,
    configure: (toggle: {
      onChange(callback: (value: boolean) => Promise<void> | void): unknown;
      setDisabled(value: boolean): unknown;
      setValue(value: boolean): unknown;
    }) => void,
  ) {
    const input = document.createElement("input");
    input.type = "checkbox";
    ensureRow(this).appendChild(input);
    let onChange: ((value: boolean) => Promise<void> | void) | null = null;
    const toggle = {
      onChange(callback: (value: boolean) => Promise<void> | void) {
        onChange = callback;
        return toggle;
      },
      setDisabled(value: boolean) {
        input.disabled = value;
        return toggle;
      },
      setValue(value: boolean) {
        input.checked = value;
        return toggle;
      },
    };
    input.addEventListener("change", () => {
      void onChange?.(input.checked);
    });
    configure(toggle);
    return this;
  });
  Reflect.set(Setting.prototype, "addDropdown", function (
    this: Setting,
    configure: (dropdown: {
      addOption(value: string, label: string): unknown;
      onChange(callback: (value: string) => Promise<void> | void): unknown;
      setValue(value: string): unknown;
    }) => void,
  ) {
    const select = document.createElement("select");
    ensureRow(this).appendChild(select);
    let onChange: ((value: string) => Promise<void> | void) | null = null;
    const dropdown = {
      addOption(value: string, label: string) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
        return dropdown;
      },
      onChange(callback: (value: string) => Promise<void> | void) {
        onChange = callback;
        return dropdown;
      },
      setValue(value: string) {
        select.value = value;
        return dropdown;
      },
    };
    select.addEventListener("change", () => {
      void onChange?.(select.value);
    });
    configure(dropdown);
    return this;
  });
  Reflect.set(Setting.prototype, "addButton", function (
    this: Setting,
    configure: (button: {
      onClick(callback: () => void): unknown;
      setButtonText(value: string): unknown;
    }) => void,
  ) {
    const element = document.createElement("button");
    ensureRow(this).appendChild(element);
    let onClick: (() => void) | null = null;
    const button = {
      onClick(callback: () => void) {
        onClick = callback;
        return button;
      },
      setButtonText(value: string) {
        element.textContent = value;
        return button;
      },
    };
    element.addEventListener("click", () => onClick?.());
    configure(button);
    return this;
  });
  Reflect.set(Setting.prototype, "addTextArea", function (
    this: Setting,
    configure: (textArea: {
      inputEl: HTMLTextAreaElement;
      onChange(callback: (value: string) => void): unknown;
      setValue(value: string): unknown;
    }) => void,
  ) {
    const inputEl = document.createElement("textarea");
    Reflect.set(inputEl, "addClass", (className: string) => inputEl.classList.add(className));
    ensureRow(this).appendChild(inputEl);
    let onChange: ((value: string) => void) | null = null;
    const textArea = {
      inputEl,
      onChange(callback: (value: string) => void) {
        onChange = callback;
        return textArea;
      },
      setValue(value: string) {
        inputEl.value = value;
        return textArea;
      },
    };
    inputEl.addEventListener("input", () => onChange?.(inputEl.value));
    configure(textArea);
    return this;
  });
  Reflect.set(Setting.prototype, "addText", function (
    this: Setting,
    configure: (text: {
      inputEl: HTMLInputElement;
      onChange(callback: (value: string) => void): unknown;
      setPlaceholder(value: string): unknown;
      setValue(value: string): unknown;
    }) => void,
  ) {
    const inputEl = document.createElement("input");
    Reflect.set(inputEl, "addClass", (className: string) => inputEl.classList.add(className));
    ensureRow(this).appendChild(inputEl);
    let onChange: ((value: string) => void) | null = null;
    const text = {
      inputEl,
      onChange(callback: (value: string) => void) {
        onChange = callback;
        return text;
      },
      setPlaceholder(value: string) {
        inputEl.placeholder = value;
        return text;
      },
      setValue(value: string) {
        inputEl.value = value;
        return text;
      },
    };
    inputEl.addEventListener("input", () => onChange?.(inputEl.value));
    configure(text);
    return this;
  });
}

function cloneSettings(settings: PropertyOrderSettings): PropertyOrderSettings {
  return JSON.parse(JSON.stringify(settings)) as PropertyOrderSettings;
}
