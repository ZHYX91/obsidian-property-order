// @vitest-environment happy-dom

import { Notice, Setting, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin from "../../src/app/plugin";
import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { SUPPORTED_LOCALES } from "../../src/shared/locale-catalog";
import { createDefaultSettings } from "../../src/shared/settings";
import type { PropertyOrderSettings } from "../../src/shared/types";

interface DropdownHarness {
  onChange?: (value: string) => Promise<void> | void;
  options: Map<string, string>;
  value?: string;
}

interface ToggleHarness {
  disabled?: boolean;
  onChange?: (value: boolean) => Promise<void> | void;
  value?: boolean;
}

const dropdowns: DropdownHarness[] = [];
const toggles: ToggleHarness[] = [];
const settingTabs: PropertyOrderSettingTab[] = [];

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
    const harness: DropdownHarness = { options: new Map() };
    const dropdown = {
      addOption(value: string, label: string) {
        harness.options.set(value, label);
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
      setDisabled(value: boolean): unknown;
      setValue(value: boolean): unknown;
    }) => void,
  ) {
    const harness: ToggleHarness = {};
    const toggle = {
      setDisabled(value: boolean) {
        harness.disabled = value;
        return toggle;
      },
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
  for (const tab of settingTabs.splice(0)) tab.hide();
  vi.restoreAllMocks();
});

describe("Value suggestion settings persistence", () => {
  it("offers every UI language by its native name and saves a new language choice", async () => {
    const harness = await createHarness({ language: "zh-CN" }, "general");
    const dropdown = dropdowns.find((candidate) => candidate.options.has("auto"));
    expect([...dropdown?.options ?? []]).toEqual([
      ["auto", "跟随 Obsidian"],
      ...SUPPORTED_LOCALES.map(({ id, label }) => [id, label]),
    ]);

    await dropdown?.onChange?.("vi-VN");

    expect(harness.plugin.propertyOrderSettings.language).toBe("vi-VN");
    expect(harness.persisted().language).toBe("vi-VN");
    expect(harness.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent)
      .toBe("Chung");
  });

  it("explains legacy modes in the UI language while preserving literal rule text", async () => {
    const rules = ["TQ_* = usage", "status=   unexpected", "name = constructor"];
    const harness = await createHarness({
      language: "zh-CN",
      valueSuggestionLegacyMigrationPending: true,
      valueSuggestionSortMode: "recent",
      valueSuggestionSortOverrides: rules,
    });
    const content = harness.container.querySelector(".property-order-legacy-value-rules")?.textContent;

    expect(content).toContain("TQ_* = usage (按包含该值的笔记数排序)");
    expect(content).toContain("status=   unexpected");
    expect(content).toContain("name = constructor");
    expect(content).not.toContain("behavior:");
    expect(harness.plugin.propertyOrderSettings.valueSuggestionSortOverrides).toEqual(rules);
    expect(harness.persisted().valueSuggestionLegacyMigrationPending).toBe(true);
  });

  it("scopes Arabic direction to plugin settings and restores LTR after a language change", async () => {
    const harness = await createHarness({ language: "ar" }, "general");
    const hostDirection = harness.container.getAttribute("dir");
    const content = harness.container.querySelector<HTMLElement>(".property-order-settings-content");
    expect(content?.lang).toBe("ar");
    expect(content?.dir).toBe("rtl");

    const active = harness.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    const next = harness.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    expect(next?.id).toBe("property-order-settings-tab-valueDrag");
    expect(document.activeElement).toBe(next);
    next?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    const language = dropdowns.filter((candidate) => candidate.options.has("auto")).at(-1);
    await language?.onChange?.("en");

    const restored = harness.container.querySelector<HTMLElement>(".property-order-settings-content");
    expect(restored?.lang).toBe("en");
    expect(restored?.dir).toBe("ltr");
    expect(harness.persisted().language).toBe("en");
    expect(harness.container.getAttribute("dir")).toBe(hostDirection);
  });

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

  it.each([false, true])("preserves a later draft when a toggle save finishes (failure: %s)", async (fails) => {
    const harness = await createHarness();
    await addNameRule(harness.container, harness.persisted);
    let finishSave: (() => void) | undefined;
    const saveGate = new Promise<void>((resolve) => { finishSave = resolve; });
    const originalSave = vi.mocked(harness.plugin.saveData).getMockImplementation();
    vi.mocked(harness.plugin.saveData).mockImplementationOnce(async (value) => {
      await saveGate;
      if (fails) throw new Error("storage unavailable");
      await originalSave?.(value);
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = toggles[0]?.onChange?.(false);
    const draft = harness.container.querySelector<HTMLInputElement>(".property-order-value-behavior-input");
    if (draft == null) throw new Error("Expected the rule input after toggling.");
    draft.value = "unfinished owner";
    draft.focus();
    draft.setSelectionRange(3, 9);
    finishSave?.();
    await pending;

    expect(harness.container.querySelector(".property-order-value-behavior-input")).toBe(draft);
    expect(draft.value).toBe("unfinished owner");
    expect(document.activeElement).toBe(draft);
    expect([draft.selectionStart, draft.selectionEnd]).toEqual([3, 9]);
    expect(harness.plugin.propertyOrderSettings.enableNativeValueSuggestionOrder).toBe(false);
    const status = harness.container.querySelector<HTMLElement>(".property-order-settings-save-status");
    expect(status?.hidden).toBe(!fails);
    if (fails) {
      expect(status?.getAttribute("role")).toBe("alert");
      expect(status?.querySelector("button")?.textContent).toBe("Retry save");
      const mockNotice = Notice as typeof Notice & { messages: string[] };
      expect(mockNotice.messages.at(-1)).toBe("Property Order: failed to save settings. Try again.");
      status?.querySelector<HTMLButtonElement>("button")?.click();
      await vi.waitFor(() => expect(status?.hidden).toBe(true));
      expect(draft.value).toBe("unfinished owner");
      expect(harness.persisted().enableNativeValueSuggestionOrder).toBe(false);
    }
  });
});

async function createHarness(
  initialSettings: Partial<PropertyOrderSettings> = {},
  activeTab: "general" | "valueSuggestions" = "valueSuggestions",
): Promise<{
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
  Object.assign(persisted, initialSettings);
  vi.spyOn(plugin, "loadData").mockImplementation(async () => cloneSettings(persisted));
  vi.spyOn(plugin, "saveData").mockImplementation(async (value: unknown) => {
    persisted = cloneSettings(value as PropertyOrderSettings);
  });
  await plugin.loadSettings();

  const settingTab = new PropertyOrderSettingTab(app, plugin);
  settingTabs.push(settingTab);
  Reflect.set(settingTab.containerEl, "empty", function (this: HTMLElement) {
    this.replaceChildren();
  });
  document.body.appendChild(settingTab.containerEl);
  Reflect.set(settingTab, "activeTab", activeTab);
  settingTab.display();

  return {
    container: settingTab.containerEl,
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
