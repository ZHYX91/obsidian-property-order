// @vitest-environment happy-dom

import { Setting, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin from "../../src/app/plugin";
import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";
import type { PropertyOrderSettings } from "../../src/shared/types";

interface DropdownHarness {
  onChange?: (value: string) => Promise<void> | void;
  options: Set<string>;
  value?: string;
}

interface ToggleHarness {
  onChange?: (value: boolean) => Promise<void> | void;
  value?: boolean;
}

const dropdowns: DropdownHarness[] = [];
const toggles: ToggleHarness[] = [];

beforeEach(() => {
  document.body.replaceChildren();
  dropdowns.length = 0;
  toggles.length = 0;

  Reflect.set(Setting.prototype, "setName", function (this: Setting) {
    return this;
  });
  Reflect.set(Setting.prototype, "setDesc", function (this: Setting) {
    return this;
  });
  Reflect.set(Setting.prototype, "setClass", function (this: Setting) {
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
    const harness: DropdownHarness = { options: new Set() };
    const dropdown = {
      addOption(value: string) {
        harness.options.add(value);
        return dropdown;
      },
      onChange(callback: (value: string) => Promise<void> | void) {
        harness.onChange = callback;
        return dropdown;
      },
      setValue(value: string) {
        harness.value = value;
        return dropdown;
      },
    };
    configure(dropdown);
    dropdowns.push(harness);
    return this;
  });
  Reflect.set(Setting.prototype, "addToggle", function (
    this: Setting,
    configure: (toggle: {
      onChange(callback: (value: boolean) => Promise<void> | void): unknown;
      setValue(value: boolean): unknown;
    }) => void,
  ) {
    const harness: ToggleHarness = {};
    const toggle = {
      onChange(callback: (value: boolean) => Promise<void> | void) {
        harness.onChange = callback;
        return toggle;
      },
      setValue(value: boolean) {
        harness.value = value;
        return toggle;
      },
    };
    configure(toggle);
    toggles.push(harness);
    return this;
  });
  Reflect.set(Setting.prototype, "addButton", function (
    this: Setting,
    configure: (button: {
      onClick(callback: () => void): unknown;
      setButtonText(value: string): unknown;
    }) => void,
  ) {
    const button = {
      onClick(_callback: () => void) {
        return button;
      },
      setButtonText(_value: string) {
        return button;
      },
    };
    configure(button);
    return this;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Value suggestion settings persistence", () => {
  it("persists consecutive default behavior changes on one rendered page", async () => {
    const harness = await createHarness();
    const dropdown = getDefaultBehaviorDropdown();

    await dropdown.onChange?.("name");
    await dropdown.onChange?.("none");

    expect(harness.plugin.propertyOrderSettings.valueSuggestionDefaultBehavior).toBe("none");
    expect(harness.persisted().valueSuggestionDefaultBehavior).toBe("none");
  });

  it("persists a default behavior change after a rule-card save replaces runtime settings", async () => {
    const harness = await createHarness();
    const dropdown = getDefaultBehaviorDropdown();
    const beforeCardSave = harness.plugin.propertyOrderSettings;

    await addNameRule(harness.container, harness.persisted);
    expect(harness.plugin.propertyOrderSettings).not.toBe(beforeCardSave);

    await dropdown.onChange?.("frequency");

    expect(harness.plugin.propertyOrderSettings.valueSuggestionDefaultBehavior).toBe("frequency");
    expect(harness.persisted().valueSuggestionDefaultBehavior).toBe("frequency");
  });

  it("persists disabling value suggestions after a rule-card save", async () => {
    const harness = await createHarness();
    const toggle = toggles[0];

    await addNameRule(harness.container, harness.persisted);
    await toggle?.onChange?.(false);

    expect(harness.plugin.propertyOrderSettings.enableNativeValueSuggestionOrder).toBe(false);
    expect(harness.persisted().enableNativeValueSuggestionOrder).toBe(false);
  });
});

async function createHarness(): Promise<{
  container: HTMLElement;
  persisted(): PropertyOrderSettings;
  plugin: PropertyOrderPlugin;
}> {
  const app = {
    metadataCache: {
      getFileCache: vi.fn(),
    },
    vault: {
      getMarkdownFiles: vi.fn(() => []),
    },
    workspace: {
      iterateAllLeaves: vi.fn(),
    },
  } as unknown as App;
  const plugin = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
  plugin.app = app;

  let persisted = createDefaultSettings();
  persisted.enableNativeValueSuggestionOrder = true;
  vi.spyOn(plugin, "loadData").mockImplementation(async () => cloneSettings(persisted));
  vi.spyOn(plugin, "saveData").mockImplementation(async (value: unknown) => {
    persisted = cloneSettings(value as PropertyOrderSettings);
  });
  await plugin.loadSettings();

  const settingTab = new PropertyOrderSettingTab(app, plugin);
  const container = document.body.createDiv();
  (
    settingTab as unknown as {
      displayValueSuggestionSettings(containerEl: HTMLElement): void;
    }
  ).displayValueSuggestionSettings(container);

  return {
    container,
    persisted: () => persisted,
    plugin,
  };
}

function getDefaultBehaviorDropdown(): DropdownHarness {
  const dropdown = dropdowns.find(
    (candidate) =>
      candidate.options.has("native") &&
      candidate.options.has("frequency") &&
      candidate.options.has("note-count") &&
      candidate.options.has("none"),
  );
  if (dropdown == null || dropdown.onChange == null) {
    throw new Error("Expected the value-suggestion default behavior dropdown.");
  }
  return dropdown;
}

async function addNameRule(
  container: HTMLElement,
  getPersisted: () => PropertyOrderSettings,
): Promise<void> {
  const addRow = container.querySelector<HTMLElement>(".property-order-value-behavior-add");
  const choice = addRow?.querySelector<HTMLSelectElement>("select");
  const addCard = addRow?.querySelector<HTMLButtonElement>("button");
  if (choice == null || addCard == null) {
    throw new Error("Expected the add-rule-card controls.");
  }

  choice.value = "name";
  addCard.click();
  const card = container.querySelector<HTMLElement>('[data-behavior="name"]');
  const input = card?.querySelector<HTMLInputElement>(".property-order-value-behavior-input");
  const add = card?.querySelector<HTMLButtonElement>(".property-order-value-behavior-add button");
  if (input == null || add == null) {
    throw new Error("Expected the name rule card add controls.");
  }

  input.value = "status";
  add.click();
  await vi.waitFor(() => {
    expect(getPersisted().valueSuggestionPropertyAssignments).toContainEqual({
      behavior: "name",
      propertyKey: "status",
    });
  });
}

function cloneSettings(settings: PropertyOrderSettings): PropertyOrderSettings {
  return JSON.parse(JSON.stringify(settings)) as PropertyOrderSettings;
}
