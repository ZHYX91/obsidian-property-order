// @vitest-environment happy-dom

import type {
  Setting,
  SettingDefinitionItem,
  SettingDefinitionPage,
  SettingDefinitionRender,
} from "obsidian";
import { Notice } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyNameSuggest } from "../../src/app/property-name-suggest";
import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";

const MockNotice = Notice as typeof Notice & { messages: string[] };

interface TestControl {
  readonly disabled?: boolean | (() => boolean);
  readonly key: string;
  readonly options?: Readonly<Record<string, string>>;
  readonly type: string;
}

afterEach(() => {
  MockNotice.messages.length = 0;
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

    await settingTab.setControlValue("keySuggestionSortMode", "recent");
    expect(settings.keySuggestionSortMode).toBe("recent");
    expect(saveSettings).toHaveBeenLastCalledWith(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).not.toHaveBeenCalled();

    await settingTab.setControlValue("enablePropertyValueDrag", false);
    expect(settings.enablePropertyValueDrag).toBe(false);
    expect(settings.enableCrossPropertyDrag).toBe(true);
    expect(saveSettings).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).toHaveBeenCalledTimes(1);

    await settingTab.setControlValue("enableNativeKeySuggestionOrder", false);
    expect(settings.enableNativeKeySuggestionOrder).toBe(false);
    expect(saveSettings).toHaveBeenLastCalledWith(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(refreshDomState).toHaveBeenCalledTimes(2);

    await settingTab.setControlValue("enableCrossPropertyDrag", false);
    expect(settings.enableCrossPropertyDrag).toBe(false);
    await settingTab.setControlValue("enableCrossPropertyDrag", true);
    expect(settings.enableCrossPropertyDrag).toBe(true);

    await expect(settingTab.setControlValue("language", "invalid")).rejects.toThrow(
      "Invalid Property Order language setting.",
    );
    await expect(settingTab.setControlValue("unknown", true)).rejects.toThrow(
      "Unsupported Property Order setting control: unknown",
    );
  });

  it("exposes recent sorting and clears its device-local history", () => {
    const clearRecentPropertyKeys = vi.fn(() => true);
    const settingTab = createSettingTab({ clearRecentPropertyKeys });
    const pages = getPages(settingTab.getSettingDefinitions());
    const keyOrderItems = pages[2]?.items ?? [];
    const sortControl = getControls(pages).find(
      (control) => control.key === "keySuggestionSortMode",
    );

    expect(sortControl?.options).toEqual({
      name: "Name",
      recent: "Recently used",
      usage: "Notes containing the property",
    });

    const clearDefinition = getRenderDefinition(
      keyOrderItems,
      "Recently used history",
    );
    const settingHarness = createSettingHarness();
    clearDefinition.render(settingHarness.setting, {} as never);

    expect(settingHarness.buttonEl.textContent).toBe("Clear history");
    settingHarness.buttonEl.click();
    expect(clearRecentPropertyKeys).toHaveBeenCalledOnce();
    expect(MockNotice.messages).toEqual([
      "Property Order: recent property history cleared.",
    ]);
  });

  it("warns when recent-history clearing cannot be persisted", () => {
    const settingTab = createSettingTab({
      clearRecentPropertyKeys: () => false,
    });
    const clearDefinition = getRenderDefinition(
      getPages(settingTab.getSettingDefinitions())[2]?.items ?? [],
      "Recently used history",
    );
    const settingHarness = createSettingHarness();
    clearDefinition.render(settingHarness.setting, {} as never);

    settingHarness.buttonEl.click();

    expect(MockNotice.messages).toEqual([
      "Property Order: saved recent history could not be cleared. It is cleared for this session but may return after restart.",
    ]);
  });

  it("explains rule matches without traversing the Vault or persisting test input", () => {
    const getMarkdownFiles = vi.fn(() => []);
    const saveSettings = vi.fn<(refreshKeySuggestions?: boolean) => Promise<void>>();
    const settings = createDefaultSettings();
    settings.hiddenPropertyKeyPatterns = ["TQ_*"];
    settings.pinnedPropertyKeys = ["TQ_status"];
    settings.bottomPropertyKeys = ["*_status"];
    const settingTab = createSettingTab({ getMarkdownFiles, saveSettings, settings });
    const definition = getRenderDefinition(
      getPages(settingTab.getSettingDefinitions())[2]?.items ?? [],
      "Test property name rules",
    );
    const settingHarness = createSettingHarness();

    const cleanup = definition.render(settingHarness.setting, {} as never);
    const resultEl = settingHarness.descEl.querySelector<HTMLElement>(
      ".property-order-rule-diagnostic-result",
    );
    expect(resultEl?.getAttribute("aria-live")).toBe("polite");
    expect(resultEl?.textContent).toBe("Enter a property name to test the current rules.");

    settingHarness.changeTextInput("TQ_status");
    expect(resultEl?.textContent).toBe(
      "Result: hidden · Hidden rule: TQ_* · Pinned rule: TQ_status · Bottom rule: *_status · Priority: hidden > pinned > bottom",
    );
    expect(getMarkdownFiles).not.toHaveBeenCalled();
    expect(saveSettings).not.toHaveBeenCalled();

    cleanup?.();
    expect((settingTab as unknown as { ruleDiagnosticRefreshes: Set<unknown> })
      .ruleDiagnosticRefreshes.size).toBe(0);
  });

  it("refreshes a declarative diagnostic after a debounced rule edit", async () => {
    vi.useFakeTimers();
    const settings = createDefaultSettings();
    const settingTab = createSettingTab({ settings });
    const keyOrderItems = getPages(settingTab.getSettingDefinitions())[2]?.items ?? [];
    const diagnosticDefinition = getRenderDefinition(
      keyOrderItems,
      "Test property name rules",
    );
    const pinnedDefinition = getRenderDefinition(
      keyOrderItems,
      "Pinned property names",
    );
    const diagnosticHarness = createSettingHarness();
    const pinnedHarness = createSettingHarness();
    const diagnosticCleanup = diagnosticDefinition.render(
      diagnosticHarness.setting,
      {} as never,
    );
    const pinnedCleanup = pinnedDefinition.render(pinnedHarness.setting, {} as never);
    const resultEl = diagnosticHarness.descEl.querySelector<HTMLElement>(
      ".property-order-rule-diagnostic-result",
    );

    diagnosticHarness.changeTextInput("project");
    expect(resultEl?.textContent).toBe("Result: normal; no rule matched");

    pinnedHarness.changeTextArea("pro*");
    await vi.advanceTimersByTimeAsync(200);

    expect(settings.pinnedPropertyKeys).toEqual(["pro*"]);
    expect(resultEl?.textContent).toBe(
      "Result: pinned · Pinned rule: pro* · Priority: hidden > pinned > bottom",
    );

    pinnedCleanup?.();
    diagnosticCleanup?.();
  });

  it("cleans the shared imperative diagnostic lifecycle on settings hide", () => {
    const settings = createDefaultSettings();
    const settingTab = createSettingTab({ settings });
    const testableSettingTab = settingTab as unknown as {
      configureRuleDiagnosticSetting(setting: Setting): () => void;
      ruleDiagnosticCleanups: Set<unknown>;
      ruleDiagnosticRefreshes: Set<() => void>;
    };
    const settingHarness = createSettingHarness();

    testableSettingTab.configureRuleDiagnosticSetting(settingHarness.setting);
    settingHarness.changeTextInput("project");
    settings.hiddenPropertyKeyPatterns = ["pro*"];
    for (const refresh of testableSettingTab.ruleDiagnosticRefreshes) {
      refresh();
    }

    expect(settingHarness.descEl.textContent).toContain("Result: hidden");
    expect(testableSettingTab.ruleDiagnosticCleanups.size).toBe(1);
    Reflect.set(settingTab.containerEl, "empty", () => settingTab.containerEl.replaceChildren());

    settingTab.hide();

    expect(testableSettingTab.ruleDiagnosticCleanups.size).toBe(0);
    expect(testableSettingTab.ruleDiagnosticRefreshes.size).toBe(0);
  });

  it("refreshes declarative state after settings change externally", () => {
    const settingTab = createSettingTab({ settings: createDefaultSettings() });
    const update = vi.spyOn(settingTab, "update");
    const refreshDomState = vi.spyOn(settingTab, "refreshDomState");

    settingTab.refreshAfterExternalSettingsChange();

    expect(update).toHaveBeenCalledOnce();
    expect(refreshDomState).toHaveBeenCalledOnce();
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

  it("continues declarative cleanup after a rule-editor flush failure", () => {
    const settingTab = createSettingTab({ getMarkdownFiles: vi.fn(() => []) });
    const pages = getPages(settingTab.getSettingDefinitions());
    const pinnedDefinition = getRenderDefinition(
      pages[2]?.items ?? [],
      "Pinned property names",
    );
    const cleanup = pinnedDefinition.render(createSettingHarness().setting, {} as never);
    const trackedLifecycles = (
      settingTab as unknown as {
        keyListSettingCleanups: Map<
          { close(): void; flush(): void },
          () => void
        >;
      }
    ).keyListSettingCleanups;
    const lifecycle = Array.from(trackedLifecycles.keys())[0];

    if (lifecycle == null) {
      throw new Error("Expected a tracked key-list lifecycle.");
    }

    const flushError = new Error("flush failed");
    const flush = vi.fn(() => {
      throw flushError;
    });
    const close = vi.fn();
    lifecycle.flush = flush;
    lifecycle.close = close;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    cleanup?.();
    cleanup?.();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(trackedLifecycles.size).toBe(0);
    expect(consoleError).toHaveBeenCalledWith(
      "Property Order: failed to clean up settings resource",
      flushError,
    );
  });
});

interface SettingHarness {
  buttonEl: HTMLButtonElement;
  changeTextInput(value: string): void;
  changeTextArea(value: string): void;
  descEl: HTMLElement;
  setting: Setting;
  textAreaEl: HTMLTextAreaElement;
  textInputEl: HTMLInputElement;
}

function createSettingHarness(): SettingHarness {
  const settingEl = document.createElement("div");
  const descEl = document.createElement("div");
  settingEl.appendChild(descEl);
  const buttonEl = document.createElement("button");
  const textAreaEl = document.createElement("textarea");
  const textInputEl = document.createElement("input");
  Reflect.set(textAreaEl, "addClass", (className: string) => {
    textAreaEl.classList.add(className);
  });
  Reflect.set(textInputEl, "addClass", (className: string) => {
    textInputEl.classList.add(className);
  });
  let handleTextAreaChange: ((value: string) => void) | null = null;
  let handleTextInputChange: ((value: string) => void) | null = null;
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
    onChange(callback: (value: string) => void) {
      handleTextInputChange = callback;
      return this;
    },
    setPlaceholder(value: string) {
      textInputEl.placeholder = value;
      return this;
    },
    setValue(value: string) {
      textInputEl.value = value;
      return this;
    },
  };
  const button = {
    onClick(callback: (event: MouseEvent) => unknown) {
      buttonEl.addEventListener("click", callback);
      return this;
    },
    setButtonText(value: string) {
      buttonEl.textContent = value;
      return this;
    },
  };
  const setting = {
    descEl,
    settingEl,
    addButton(callback: (component: typeof button) => void) {
      callback(button);
      settingEl.appendChild(buttonEl);
      return this;
    },
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
    buttonEl,
    changeTextInput: (value) => {
      if (handleTextInputChange == null) {
        throw new Error("Text input change handler was not registered.");
      }

      textInputEl.value = value;
      handleTextInputChange(value);
    },
    changeTextArea: (value) => {
      if (handleTextAreaChange == null) {
        throw new Error("Textarea change handler was not registered.");
      }

      textAreaEl.value = value;
      handleTextAreaChange(value);
    },
    descEl,
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
  clearRecentPropertyKeys?: () => boolean;
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
    clearRecentPropertyKeys: options.clearRecentPropertyKeys ?? vi.fn(() => true),
    hasPendingSettingsSave: vi.fn(() => false),
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
