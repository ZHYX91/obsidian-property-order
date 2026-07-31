import {
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  type App,
  type SettingDefinitionItem,
} from "obsidian";

import { getPropertyNameSuggestions } from "../core/suggestions/property-names";
import { t, type TranslationKey } from "../shared/i18n";
import { getCachedPropertyKeyUsage } from "../obsidian/metadata";
import type {
  KeySuggestionSortMode,
  PropertyOrderSettings,
} from "../shared/types";
import { PropertyNameSuggest } from "./property-name-suggest";
import {
  applyPropertyOrderControlValue,
  isPropertyOrderControlKey,
  isPropertyOrderControlValue,
  type PropertyOrderControlKey,
  type SettingsControlMutation,
} from "./settings-control-contract";
import {
  createSettingsTabLayout,
  focusSettingsTab,
  type SettingsTabId,
} from "./settings-tabs";

interface PropertyOrderSettingsHost extends Plugin {
  clearRecentPropertyKeys(): boolean;
  hasPendingSettingsSave(): boolean;
  saveSettings(refreshKeySuggestions?: boolean): Promise<void>;
  propertyOrderSettings: PropertyOrderSettings;
}

interface KeyListSettingLifecycle {
  close(): void;
  flush(): void;
}

type SettingsCleanup = () => void;

export class PropertyOrderSettingTab extends PluginSettingTab {
  private activeTab: SettingsTabId = "general";
  private hasUnsavedSettings = false;
  private readonly keyListSettingCleanups = new Map<
    KeyListSettingLifecycle,
    SettingsCleanup
  >();
  private pendingUnsavedKeySuggestionRefresh = false;
  private readonly plugin: PropertyOrderSettingsHost;
  private saveStatusEl: HTMLElement | null = null;
  private settingsSurfaceGeneration = 0;
  private settingsSurfaceVisible = true;
  private tabLayoutCleanup: (() => void) | null = null;

  constructor(app: App, plugin: PropertyOrderSettingsHost) {
    super(app, plugin);
    this.plugin = plugin;
    this.hasUnsavedSettings = plugin.hasPendingSettingsSave();
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "page",
        name: this.t("settings.tab.general"),
        items: [this.createSaveStatusDefinition(), ...this.getGeneralSettingDefinitions()],
      },
      {
        type: "page",
        name: this.t("settings.tab.valueDrag"),
        items: [this.createSaveStatusDefinition(), ...this.getValueDragSettingDefinitions()],
      },
      {
        type: "page",
        name: this.t("settings.tab.keyOrder"),
        items: [this.createSaveStatusDefinition(), ...this.getKeyOrderSettingDefinitions()],
      },
    ];
  }

  override getControlValue(key: string): unknown {
    if (!isPropertyOrderControlKey(key)) {
      return undefined;
    }

    return this.plugin.propertyOrderSettings[key];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isPropertyOrderControlKey(key)) {
      throw new Error(`Unsupported Property Order setting control: ${key}`);
    }

    const mutation = applyPropertyOrderControlValue(
      this.plugin.propertyOrderSettings,
      key,
      value,
    );
    const surfaceGeneration = this.settingsSurfaceGeneration;
    await this.persistSettings(mutation.refreshKeySuggestions, surfaceGeneration);

    if (this.isSettingsSurfaceCurrent(surfaceGeneration)) {
      this.applyDeclarativeRefresh(mutation);
    }
  }

  override display(): void {
    this.hasUnsavedSettings = this.plugin.hasPendingSettingsSave();
    this.render(null);
  }

  override hide(): void {
    this.settingsSurfaceVisible = false;
    this.settingsSurfaceGeneration += 1;

    try {
      super.hide();
    } catch (error) {
      reportSettingsCleanupError(error);
    }

    this.resetRenderedSettings();
  }

  private getGeneralSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: this.t("settings.language.name"),
        desc: this.t("settings.language.desc"),
        control: {
          type: "dropdown",
          key: "language",
          defaultValue: "auto",
          options: {
            auto: this.t("settings.language.auto"),
            "zh-CN": this.t("settings.language.zhCn"),
            "zh-TW": this.t("settings.language.zhTw"),
            en: this.t("settings.language.en"),
          },
        },
      },
      {
        name: this.t("settings.diagnostics.name"),
        desc: this.t("settings.diagnostics.desc"),
        control: {
          type: "toggle",
          key: "showDiagnostics",
          defaultValue: false,
        },
      },
    ];
  }

  private getValueDragSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: this.t("settings.valueDrag.mobileHint"),
        searchable: false,
        visible: Platform.isMobileApp,
        render: (setting) => {
          setting.setClass("property-order-settings-hint");
        },
      },
      {
        name: this.t("settings.valueDrag.enable.name"),
        desc: this.t("settings.valueDrag.enable.desc"),
        control: {
          type: "toggle",
          key: "enablePropertyValueDrag",
          defaultValue: true,
        },
      },
      {
        name: this.t("settings.valueDrag.disabledHint"),
        searchable: false,
        visible: () => !this.plugin.propertyOrderSettings.enablePropertyValueDrag,
        render: (setting) => {
          setting.setClass("property-order-settings-hint");
        },
      },
      {
        name: this.t("settings.writebackFormat.name"),
        desc: this.t("settings.writebackFormat.desc"),
        control: {
          type: "dropdown",
          key: "listWritebackFormat",
          defaultValue: "preserve",
          options: {
            preserve: this.t("settings.writebackFormat.preserve"),
            flow: this.t("settings.writebackFormat.flow"),
            block: this.t("settings.writebackFormat.block"),
          },
        },
      },
      {
        name: this.t("settings.crossPropertyDrag.name"),
        desc: this.t("settings.crossPropertyDrag.desc"),
        control: {
          type: "toggle",
          key: "enableCrossPropertyDrag",
          defaultValue: true,
          disabled: () => !this.plugin.propertyOrderSettings.enablePropertyValueDrag,
        },
      },
    ];
  }

  private getKeyOrderSettingDefinitions(): SettingDefinitionItem[] {
    let availableNames: string[] | null = null;
    const getAvailableNames = (): string[] => {
      availableNames ??= getAvailablePropertyNames(this.app);
      return availableNames;
    };

    return [
      {
        name: this.t("settings.keyOrder.enable.name"),
        desc: this.t("settings.keyOrder.enable.desc"),
        control: {
          type: "toggle",
          key: "enableNativeKeySuggestionOrder",
          defaultValue: true,
        },
      },
      {
        name: this.t("settings.keyOrder.disabledHint"),
        searchable: false,
        visible: () => !this.plugin.propertyOrderSettings.enableNativeKeySuggestionOrder,
        render: (setting) => {
          setting.setClass("property-order-settings-hint");
        },
      },
      {
        name: this.t("settings.keyOrder.sortMode.name"),
        desc: this.t("settings.keyOrder.sortMode.desc"),
        control: {
          type: "dropdown",
          key: "keySuggestionSortMode",
          defaultValue: "name",
          options: this.getKeySuggestionSortOptions(),
        },
      },
      {
        name: this.t("settings.keyOrder.recentHistory.name"),
        desc: this.t("settings.keyOrder.recentHistory.desc"),
        render: (setting) => {
          this.addClearRecentPropertyKeysButton(setting);
        },
      },
      this.createKeyListDefinition(
        "pinnedPropertyKeys",
        this.t("settings.keyOrder.pinned.name"),
        this.t("settings.keyOrder.pinned.desc"),
        getAvailableNames,
      ),
      this.createKeyListDefinition(
        "bottomPropertyKeys",
        this.t("settings.keyOrder.bottom.name"),
        this.t("settings.keyOrder.bottom.desc"),
        getAvailableNames,
      ),
      this.createKeyListDefinition(
        "hiddenPropertyKeyPatterns",
        this.t("settings.keyOrder.hidden.name"),
        this.t("settings.keyOrder.hidden.desc"),
        getAvailableNames,
      ),
    ];
  }

  private createKeyListDefinition(
    key: "bottomPropertyKeys" | "hiddenPropertyKeyPatterns" | "pinnedPropertyKeys",
    name: string,
    description: string,
    getAvailableNames: () => string[],
  ): SettingDefinitionItem {
    return {
      name,
      desc: description,
      render: (setting) => {
        const surfaceGeneration = this.settingsSurfaceGeneration;
        const lifecycle = configureKeyListSetting(
          setting,
          this.plugin.propertyOrderSettings[key],
          async (values) => {
            this.plugin.propertyOrderSettings[key] = values;
            await this.persistSettings(true, surfaceGeneration);
          },
          this.app,
          getAvailableNames(),
          this.t("settings.keyOrder.addExisting.placeholder"),
        );
        return this.trackKeyListSetting(lifecycle);
      },
    };
  }

  private getKeySuggestionSortOptions(): Record<KeySuggestionSortMode, string> {
    return {
      name: this.t("settings.keyOrder.sortMode.nameOption"),
      recent: this.t("settings.keyOrder.sortMode.recent"),
      usage: this.t("settings.keyOrder.sortMode.usage"),
    };
  }

  private addClearRecentPropertyKeysButton(setting: Setting): void {
    setting.addButton((button) => {
      button
        .setButtonText(this.t("settings.keyOrder.recentHistory.clear"))
        .onClick(() => {
          const persisted = this.plugin.clearRecentPropertyKeys();
          new Notice(this.t(
            persisted
              ? "notice.recentHistoryCleared"
              : "notice.recentHistoryClearFailed",
          ));
        });
    });
  }

  private createSaveStatusDefinition(): SettingDefinitionItem {
    return {
      name: this.t("settings.saveStatus.failed"),
      searchable: false,
      render: (setting) => {
        this.beginSettingsSurfaceRender();
        const statusEl = this.mountSaveStatus(setting.settingEl, true);

        return () => {
          if (this.saveStatusEl === statusEl) {
            this.saveStatusEl = null;
          }
        };
      },
    };
  }

  private render(focusTab: SettingsTabId | null): void {
    const { containerEl } = this;
    this.resetRenderedSettings();
    this.beginSettingsSurfaceRender();

    const tabs = [
      { id: "general", label: this.t("settings.tab.general") },
      { id: "valueDrag", label: this.t("settings.tab.valueDrag") },
      { id: "keyOrder", label: this.t("settings.tab.keyOrder") },
    ] satisfies Array<{ id: SettingsTabId; label: string }>;
    const { activeTabEl, cleanup, panelEl } = createSettingsTabLayout(
      containerEl,
      tabs,
      this.activeTab,
      this.t("settings.tabsLabel"),
      (tabId) => {
        this.activeTab = tabId;
        this.render(tabId);
      },
    );
    this.tabLayoutCleanup = cleanup;
    this.mountSaveStatus(panelEl);

    if (this.activeTab === "keyOrder") {
      this.displayKeyOrderSettings(panelEl);
    } else if (this.activeTab === "valueDrag") {
      this.displayValueDragSettings(panelEl);
    } else {
      this.displayGeneralSettings(panelEl);
    }

    if (focusTab != null) {
      focusSettingsTab(activeTabEl);
    }
  }

  private displayGeneralSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(this.t("settings.general.heading"))
      .setHeading();

    new Setting(containerEl)
      .setName(this.t("settings.language.name"))
      .setDesc(this.t("settings.language.desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("auto", this.t("settings.language.auto"))
          .addOption("zh-CN", this.t("settings.language.zhCn"))
          .addOption("zh-TW", this.t("settings.language.zhTw"))
          .addOption("en", this.t("settings.language.en"))
          .setValue(this.plugin.propertyOrderSettings.language)
          .onChange(async (value) => {
            await this.applyImperativeControlValue("language", value);
          });
      });

    new Setting(containerEl)
      .setName(this.t("settings.diagnostics.name"))
      .setDesc(this.t("settings.diagnostics.desc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.propertyOrderSettings.showDiagnostics).onChange(async (value) => {
          await this.applyImperativeControlValue("showDiagnostics", value);
        });
      });
  }

  private displayValueDragSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(this.t("settings.valueDrag.heading"))
      .setHeading();

    if (Platform.isMobileApp) {
      addInactiveHint(containerEl, this.t("settings.valueDrag.mobileHint"));
    }

    new Setting(containerEl)
      .setName(this.t("settings.valueDrag.enable.name"))
      .setDesc(this.t("settings.valueDrag.enable.desc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.propertyOrderSettings.enablePropertyValueDrag).onChange(async (value) => {
          await this.applyImperativeControlValue("enablePropertyValueDrag", value);
        });
      });

    if (!this.plugin.propertyOrderSettings.enablePropertyValueDrag) {
      addInactiveHint(containerEl, this.t("settings.valueDrag.disabledHint"));
    }

    new Setting(containerEl)
      .setName(this.t("settings.writebackFormat.name"))
      .setDesc(this.t("settings.writebackFormat.desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("preserve", this.t("settings.writebackFormat.preserve"))
          .addOption("flow", this.t("settings.writebackFormat.flow"))
          .addOption("block", this.t("settings.writebackFormat.block"))
          .setValue(this.plugin.propertyOrderSettings.listWritebackFormat)
          .onChange(async (value) => {
            await this.applyImperativeControlValue("listWritebackFormat", value);
          });
      });

    new Setting(containerEl)
      .setName(this.t("settings.crossPropertyDrag.name"))
      .setDesc(this.t("settings.crossPropertyDrag.desc"))
      .addToggle((toggle) => {
        toggle
          .setValue(
            this.plugin.propertyOrderSettings.enablePropertyValueDrag &&
              this.plugin.propertyOrderSettings.enableCrossPropertyDrag,
          )
          .setDisabled(!this.plugin.propertyOrderSettings.enablePropertyValueDrag)
          .onChange(async (value) => {
            if (!this.plugin.propertyOrderSettings.enablePropertyValueDrag) {
              return;
            }
            await this.applyImperativeControlValue("enableCrossPropertyDrag", value);
          });
      });
  }

  private displayKeyOrderSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(this.t("settings.keyOrder.heading"))
      .setHeading();
    const availableNames = getAvailablePropertyNames(this.app);

    new Setting(containerEl)
      .setName(this.t("settings.keyOrder.enable.name"))
      .setDesc(this.t("settings.keyOrder.enable.desc"))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.propertyOrderSettings.enableNativeKeySuggestionOrder)
          .onChange(async (value) => {
            await this.applyImperativeControlValue("enableNativeKeySuggestionOrder", value);
          });
      });

    if (!this.plugin.propertyOrderSettings.enableNativeKeySuggestionOrder) {
      addInactiveHint(containerEl, this.t("settings.keyOrder.disabledHint"));
    }

    new Setting(containerEl)
      .setName(this.t("settings.keyOrder.sortMode.name"))
      .setDesc(this.t("settings.keyOrder.sortMode.desc"))
      .addDropdown((dropdown) => {
        for (const [value, label] of Object.entries(
          this.getKeySuggestionSortOptions(),
        )) {
          dropdown.addOption(value, label);
        }

        dropdown
          .setValue(this.plugin.propertyOrderSettings.keySuggestionSortMode)
          .onChange(async (value) => {
            await this.applyImperativeControlValue("keySuggestionSortMode", value);
          });
      });

    const recentHistorySetting = new Setting(containerEl)
      .setName(this.t("settings.keyOrder.recentHistory.name"))
      .setDesc(this.t("settings.keyOrder.recentHistory.desc"));
    this.addClearRecentPropertyKeysButton(recentHistorySetting);

    const surfaceGeneration = this.settingsSurfaceGeneration;
    this.trackKeyListSetting(
      addKeyListSetting(
        containerEl,
        this.t("settings.keyOrder.pinned.name"),
        this.t("settings.keyOrder.pinned.desc"),
        this.plugin.propertyOrderSettings.pinnedPropertyKeys,
        async (values) => {
          this.plugin.propertyOrderSettings.pinnedPropertyKeys = values;
          await this.persistSettings(true, surfaceGeneration);
        },
        this.app,
        availableNames,
        this.t("settings.keyOrder.addExisting.placeholder"),
      ),
    );
    this.trackKeyListSetting(
      addKeyListSetting(
        containerEl,
        this.t("settings.keyOrder.bottom.name"),
        this.t("settings.keyOrder.bottom.desc"),
        this.plugin.propertyOrderSettings.bottomPropertyKeys,
        async (values) => {
          this.plugin.propertyOrderSettings.bottomPropertyKeys = values;
          await this.persistSettings(true, surfaceGeneration);
        },
        this.app,
        availableNames,
        this.t("settings.keyOrder.addExisting.placeholder"),
      ),
    );
    this.trackKeyListSetting(
      addKeyListSetting(
        containerEl,
        this.t("settings.keyOrder.hidden.name"),
        this.t("settings.keyOrder.hidden.desc"),
        this.plugin.propertyOrderSettings.hiddenPropertyKeyPatterns,
        async (values) => {
          this.plugin.propertyOrderSettings.hiddenPropertyKeyPatterns = values;
          await this.persistSettings(true, surfaceGeneration);
        },
        this.app,
        availableNames,
        this.t("settings.keyOrder.addExisting.placeholder"),
      ),
    );
  }

  private trackKeyListSetting(lifecycle: KeyListSettingLifecycle): SettingsCleanup {
    const cleanup = createSettingsDisposer(
      () => {
        this.keyListSettingCleanups.delete(lifecycle);
      },
      () => lifecycle.close(),
      () => lifecycle.flush(),
    );
    this.keyListSettingCleanups.set(lifecycle, cleanup);
    return cleanup;
  }

  private cleanupRenderedSettings(): void {
    const tabLayoutCleanup = this.tabLayoutCleanup;
    this.tabLayoutCleanup = null;
    const cleanup = createSettingsDisposer(
      ...(tabLayoutCleanup == null ? [] : [tabLayoutCleanup]),
      ...this.keyListSettingCleanups.values(),
    );

    cleanup();
    this.keyListSettingCleanups.clear();
    this.saveStatusEl = null;
  }

  private resetRenderedSettings(): void {
    this.cleanupRenderedSettings();

    try {
      this.containerEl.empty();
    } catch (error) {
      reportSettingsCleanupError(error);
    }
  }

  private beginSettingsSurfaceRender(): void {
    this.settingsSurfaceVisible = true;
    this.settingsSurfaceGeneration += 1;
  }

  private isSettingsSurfaceCurrent(generation: number): boolean {
    return this.settingsSurfaceVisible && this.settingsSurfaceGeneration === generation;
  }

  private async applyImperativeControlValue(
    key: PropertyOrderControlKey,
    value: unknown,
  ): Promise<void> {
    if (!isPropertyOrderControlValue(key, value)) {
      return;
    }

    const mutation = applyPropertyOrderControlValue(
      this.plugin.propertyOrderSettings,
      key,
      value,
    );
    const surfaceGeneration = this.settingsSurfaceGeneration;
    await this.persistSettings(mutation.refreshKeySuggestions, surfaceGeneration);

    if (
      mutation.refreshMode !== "none" &&
      this.isSettingsSurfaceCurrent(surfaceGeneration)
    ) {
      this.render(null);
    }
  }

  private applyDeclarativeRefresh(mutation: SettingsControlMutation): void {
    if (mutation.refreshMode === "structure") {
      updateDeclarativeSettingTab(this);
    } else if (mutation.refreshMode === "state") {
      refreshDeclarativeSettingTabState(this);
    }
  }

  private async persistSettings(
    refreshKeySuggestions = false,
    surfaceGeneration = this.settingsSurfaceGeneration,
  ): Promise<boolean> {
    const shouldRefreshKeySuggestions =
      refreshKeySuggestions || this.pendingUnsavedKeySuggestionRefresh;

    try {
      await this.plugin.saveSettings(shouldRefreshKeySuggestions);
      this.hasUnsavedSettings = false;
      this.pendingUnsavedKeySuggestionRefresh = false;
      this.updateSaveStatus(surfaceGeneration);
      return true;
    } catch (error) {
      this.hasUnsavedSettings = true;
      this.pendingUnsavedKeySuggestionRefresh = shouldRefreshKeySuggestions;
      console.error("Property Order: failed to save settings", error);
      this.updateSaveStatus(surfaceGeneration);

      if (this.isSettingsSurfaceCurrent(surfaceGeneration)) {
        new Notice(this.t("notice.settingsSaveFailed"));
      }
      return false;
    }
  }

  private mountSaveStatus(parentEl: HTMLElement, reuseParent = false): HTMLElement {
    this.saveStatusEl?.remove();
    const statusEl = reuseParent ? parentEl : parentEl.createDiv();
    statusEl.classList.add("property-order-settings-save-status");
    if (!reuseParent) {
      parentEl.prepend(statusEl);
    }
    this.saveStatusEl = statusEl;
    this.updateSaveStatus();
    return statusEl;
  }

  private updateSaveStatus(
    surfaceGeneration = this.settingsSurfaceGeneration,
  ): void {
    if (!this.isSettingsSurfaceCurrent(surfaceGeneration)) {
      return;
    }

    if (this.saveStatusEl == null || this.saveStatusEl.parentElement == null) {
      this.mountSaveStatus(this.containerEl);
      return;
    }

    this.saveStatusEl.replaceChildren();
    this.saveStatusEl.hidden = !this.hasUnsavedSettings;

    if (!this.hasUnsavedSettings) {
      this.saveStatusEl.removeAttribute("role");
      return;
    }

    this.saveStatusEl.setAttribute("role", "alert");
    const messageEl = this.saveStatusEl.createSpan();
    messageEl.textContent = this.t("settings.saveStatus.failed");
    const retryButton = this.saveStatusEl.createEl("button");
    const retrySurfaceGeneration = this.settingsSurfaceGeneration;
    retryButton.type = "button";
    retryButton.textContent = this.t("settings.saveStatus.retry");
    retryButton.addEventListener("click", () => {
      retryButton.disabled = true;
      void this.persistSettings(false, retrySurfaceGeneration);
    });
    this.saveStatusEl.append(messageEl, retryButton);
  }

  private t(key: TranslationKey): string {
    return t(key, this.plugin.propertyOrderSettings.language);
  }
}

export function createSettingsDisposer(
  ...cleanups: readonly SettingsCleanup[]
): SettingsCleanup {
  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;

    for (let index = cleanups.length - 1; index >= 0; index -= 1) {
      try {
        cleanups[index]?.();
      } catch (error) {
        reportSettingsCleanupError(error);
      }
    }
  };
}

function reportSettingsCleanupError(error: unknown): void {
  console.error("Property Order: failed to clean up settings resource", error);
}

function addInactiveHint(containerEl: HTMLElement, text: string): void {
  containerEl.createDiv({
    cls: "property-order-settings-hint",
    text,
  });
}

function addKeyListSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  values: string[],
  onChange: (values: string[]) => Promise<void>,
  app: App,
  availableNames: string[],
  placeholder: string,
): KeyListSettingLifecycle {
  return configureKeyListSetting(
    new Setting(containerEl).setName(name).setDesc(description),
    values,
    onChange,
    app,
    availableNames,
    placeholder,
  );
}

function configureKeyListSetting(
  setting: Setting,
  values: string[],
  onChange: (values: string[]) => Promise<void>,
  app: App,
  availableNames: string[],
  placeholder: string,
): KeyListSettingLifecycle {
  let currentValues = [...values];
  let propertyNameSuggest: PropertyNameSuggest | null = null;
  let textAreaEl: HTMLTextAreaElement | null = null;

  const getTargetWindow = (): Window =>
    textAreaEl?.ownerDocument.defaultView ?? setting.settingEl.ownerDocument.defaultView ?? window;
  const pendingSave = createDebouncedCommit(() => {
    void onChange([...currentValues]).catch((error: unknown) => {
      console.error("Property Order: failed to save property name rules", error);
    });
  }, getTargetWindow);

  setting
    .setClass("property-order-key-list-setting")
    .addTextArea((textArea) => {
      textArea
        .setValue(currentValues.join("\n"))
        .onChange((value) => {
          currentValues = parseLines(value);
          pendingSave.schedule();
        });
      textArea.inputEl.rows = 5;
      textArea.inputEl.cols = 32;
      textArea.inputEl.addClass("property-order-key-list-input");
      textAreaEl = textArea.inputEl;
    })
    .addText((text) => {
      text
        .setPlaceholder(placeholder)
        .setValue("");
      text.inputEl.addClass("property-order-property-name-input");

      propertyNameSuggest = new PropertyNameSuggest(app, text.inputEl, {
        availableNames,
        getExcludedNames: () => currentValues,
        onSelect: async (value) => {
          pendingSave.cancel();
          currentValues = [...currentValues, value];

          if (textAreaEl != null) {
            textAreaEl.value = currentValues.join("\n");
          }

          await onChange(currentValues);
        },
      });
    });

  return {
    close: () => propertyNameSuggest?.close(),
    flush: () => pendingSave.flush(),
  };
}

interface DebouncedCommit {
  cancel(): void;
  flush(): void;
  schedule(): void;
}

export function createDebouncedCommit(
  commit: () => void,
  getTargetWindow: () => Window,
  delayMilliseconds = 200,
): DebouncedCommit {
  let timeoutId: number | null = null;

  const cancel = (): void => {
    if (timeoutId == null) {
      return;
    }

    getTargetWindow().clearTimeout(timeoutId);
    timeoutId = null;
  };
  const flush = (): void => {
    if (timeoutId == null) {
      return;
    }

    cancel();
    commit();
  };

  return {
    cancel,
    flush,
    schedule: () => {
      cancel();
      timeoutId = getTargetWindow().setTimeout(flush, delayMilliseconds);
    },
  };
}

function getAvailablePropertyNames(app: App): string[] {
  return getPropertyNameSuggestions(
    getCachedPropertyKeyUsage(app).map((item) => item.key),
    [],
    "",
  );
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function updateDeclarativeSettingTab(settingTab: object): void {
  const update: unknown = Reflect.get(settingTab, "update");
  if (typeof update === "function") {
    Reflect.apply(update, settingTab, []);
  }
}

function refreshDeclarativeSettingTabState(settingTab: object): void {
  const refreshDomState: unknown = Reflect.get(settingTab, "refreshDomState");
  if (typeof refreshDomState === "function") {
    Reflect.apply(refreshDomState, settingTab, []);
  }
}
