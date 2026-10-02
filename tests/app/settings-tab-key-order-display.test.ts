// @vitest-environment happy-dom

import { Setting, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("PropertyOrderSettingTab imperative key-suggestion controls", () => {
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
    const app = {
      metadataCache: { getFileCache: vi.fn() },
      vault: { getMarkdownFiles: vi.fn(() => []) },
    } as unknown as App;
    const plugin = {
      clearRecentPropertyKeys: vi.fn(() => true),
      clearRecentPropertyValues: vi.fn(() => true),
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
    const row = document.createElement("div");
    row.className = "setting-item";
    panel.appendChild(row);
    rows.set(setting, row);
    Reflect.set(setting, "settingEl", row);
    const descEl = document.createElement("div");
    row.appendChild(descEl);
    Reflect.set(setting, "descEl", descEl);
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
