import { Notice, Platform, Plugin, PluginSettingTab, Setting, type App } from "obsidian";

import { getPropertyNameSuggestions } from "../core/suggestions/property-names";
import {
  isKeySuggestionSortMode,
  isListWritebackFormat,
  isPluginLanguage,
} from "../shared/settings";
import { t, type TranslationKey } from "../shared/i18n";
import { getCachedPropertyKeyUsage } from "../obsidian/metadata";
import type { PropertyOrderSettings } from "../shared/types";
import { PropertyNameSuggest } from "./property-name-suggest";
import { createSettingsTabLayout, type SettingsTabId } from "./settings-tabs";

interface PropertyOrderSettingsHost extends Plugin {
  saveSettings(refreshKeySuggestions?: boolean): Promise<void>;
  propertyOrderSettings: PropertyOrderSettings;
}

export class PropertyOrderSettingTab extends PluginSettingTab {
  private activeTab: SettingsTabId = "general";
  private hasUnsavedSettings = false;
  private readonly pendingKeyListSaveFlushes = new Set<() => void>();
  private pendingUnsavedKeySuggestionRefresh = false;
  private readonly plugin: PropertyOrderSettingsHost;
  private readonly propertyNameSuggests = new Set<PropertyNameSuggest>();
  private saveStatusEl: HTMLElement | null = null;
  private tabLayoutCleanup: (() => void) | null = null;

  constructor(app: App, plugin: PropertyOrderSettingsHost) {
    super(app, plugin);
    this.plugin = plugin;
  }

  override display(): void {
    this.render(null);
  }

  override hide(): void {
    this.tabLayoutCleanup?.();
    this.tabLayoutCleanup = null;
    this.flushPendingKeyListSaves();
    this.closePropertyNameSuggests();
    super.hide();
  }

  private render(focusTab: SettingsTabId | null): void {
    const { containerEl } = this;
    this.tabLayoutCleanup?.();
    this.tabLayoutCleanup = null;
    this.flushPendingKeyListSaves();
    this.closePropertyNameSuggests();
    containerEl.empty();

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
      activeTabEl.focus();
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
            if (!isPluginLanguage(value)) {
              return;
            }

            this.plugin.propertyOrderSettings.language = value;
            await this.persistSettings();
            this.render(null);
          });
      });

    new Setting(containerEl)
      .setName(this.t("settings.diagnostics.name"))
      .setDesc(this.t("settings.diagnostics.desc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.propertyOrderSettings.showDiagnostics).onChange(async (value) => {
          this.plugin.propertyOrderSettings.showDiagnostics = value;
          await this.persistSettings();
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
          this.plugin.propertyOrderSettings.enablePropertyValueDrag = value;

          if (!value) {
            this.plugin.propertyOrderSettings.enableCrossPropertyDrag = false;
          }

          await this.persistSettings();
          this.render(null);
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
            if (!isListWritebackFormat(value)) {
              return;
            }

            this.plugin.propertyOrderSettings.listWritebackFormat = value;
            await this.persistSettings();
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

            this.plugin.propertyOrderSettings.enableCrossPropertyDrag = value;
            await this.persistSettings();
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
            this.plugin.propertyOrderSettings.enableNativeKeySuggestionOrder = value;
            await this.persistSettings(true);
            this.render(null);
          });
      });

    if (!this.plugin.propertyOrderSettings.enableNativeKeySuggestionOrder) {
      addInactiveHint(containerEl, this.t("settings.keyOrder.disabledHint"));
    }

    new Setting(containerEl)
      .setName(this.t("settings.keyOrder.sortMode.name"))
      .setDesc(this.t("settings.keyOrder.sortMode.desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("name", this.t("settings.keyOrder.sortMode.nameOption"))
          .addOption("usage", this.t("settings.keyOrder.sortMode.usage"))
          .setValue(this.plugin.propertyOrderSettings.keySuggestionSortMode)
          .onChange(async (value) => {
            if (!isKeySuggestionSortMode(value)) {
              return;
            }

            this.plugin.propertyOrderSettings.keySuggestionSortMode = value;
            await this.persistSettings(true);
          });
      });

    addKeyListSetting(
      containerEl,
      this.t("settings.keyOrder.pinned.name"),
      this.t("settings.keyOrder.pinned.desc"),
      this.plugin.propertyOrderSettings.pinnedPropertyKeys,
      async (values) => {
        this.plugin.propertyOrderSettings.pinnedPropertyKeys = values;
        await this.persistSettings(true);
      },
      this.app,
      availableNames,
      this.t("settings.keyOrder.addExisting.placeholder"),
      (suggest) => this.propertyNameSuggests.add(suggest),
      (flush) => this.pendingKeyListSaveFlushes.add(flush),
    );
    addKeyListSetting(
      containerEl,
      this.t("settings.keyOrder.bottom.name"),
      this.t("settings.keyOrder.bottom.desc"),
      this.plugin.propertyOrderSettings.bottomPropertyKeys,
      async (values) => {
        this.plugin.propertyOrderSettings.bottomPropertyKeys = values;
        await this.persistSettings(true);
      },
      this.app,
      availableNames,
      this.t("settings.keyOrder.addExisting.placeholder"),
      (suggest) => this.propertyNameSuggests.add(suggest),
      (flush) => this.pendingKeyListSaveFlushes.add(flush),
    );
    addKeyListSetting(
      containerEl,
      this.t("settings.keyOrder.hidden.name"),
      this.t("settings.keyOrder.hidden.desc"),
      this.plugin.propertyOrderSettings.hiddenPropertyKeyPatterns,
      async (values) => {
        this.plugin.propertyOrderSettings.hiddenPropertyKeyPatterns = values;
        await this.persistSettings(true);
      },
      this.app,
      availableNames,
      this.t("settings.keyOrder.addExisting.placeholder"),
      (suggest) => this.propertyNameSuggests.add(suggest),
      (flush) => this.pendingKeyListSaveFlushes.add(flush),
    );
  }

  private closePropertyNameSuggests(): void {
    for (const suggest of this.propertyNameSuggests) {
      suggest.close();
    }

    this.propertyNameSuggests.clear();
  }

  private flushPendingKeyListSaves(): void {
    for (const flush of this.pendingKeyListSaveFlushes) {
      flush();
    }

    this.pendingKeyListSaveFlushes.clear();
  }

  private async persistSettings(refreshKeySuggestions = false): Promise<boolean> {
    const shouldRefreshKeySuggestions =
      refreshKeySuggestions || this.pendingUnsavedKeySuggestionRefresh;

    try {
      await this.plugin.saveSettings(shouldRefreshKeySuggestions);
      this.hasUnsavedSettings = false;
      this.pendingUnsavedKeySuggestionRefresh = false;
      this.updateSaveStatus();
      return true;
    } catch (error) {
      this.hasUnsavedSettings = true;
      this.pendingUnsavedKeySuggestionRefresh = shouldRefreshKeySuggestions;
      console.error("Property Order: failed to save settings", error);
      this.updateSaveStatus();
      new Notice(this.t("notice.settingsSaveFailed"));
      return false;
    }
  }

  private mountSaveStatus(parentEl: HTMLElement): void {
    this.saveStatusEl?.remove();
    const statusEl = parentEl.ownerDocument.createElement("div");
    statusEl.className = "property-order-settings-save-status";
    parentEl.prepend(statusEl);
    this.saveStatusEl = statusEl;
    this.updateSaveStatus();
  }

  private updateSaveStatus(): void {
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
    const messageEl = this.saveStatusEl.ownerDocument.createElement("span");
    messageEl.textContent = this.t("settings.saveStatus.failed");
    const retryButton = this.saveStatusEl.ownerDocument.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = this.t("settings.saveStatus.retry");
    retryButton.addEventListener("click", () => {
      retryButton.disabled = true;
      void this.persistSettings();
    });
    this.saveStatusEl.append(messageEl, retryButton);
  }

  private t(key: TranslationKey): string {
    return t(key, this.plugin.propertyOrderSettings.language);
  }
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
  registerSuggest: (suggest: PropertyNameSuggest) => void,
  registerPendingSaveFlush: (flush: () => void) => void,
): void {
  let currentValues = [...values];
  let textAreaEl: HTMLTextAreaElement | null = null;

  const getTargetWindow = (): Window =>
    textAreaEl?.ownerDocument.defaultView ?? containerEl.ownerDocument.defaultView ?? window;
  const pendingSave = createDebouncedCommit(() => {
    void onChange([...currentValues]).catch((error: unknown) => {
      console.error("Property Order: failed to save property name rules", error);
    });
  }, getTargetWindow);
  registerPendingSaveFlush(() => pendingSave.flush());

  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
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

      const suggest = new PropertyNameSuggest(app, text.inputEl, {
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

      registerSuggest(suggest);
    });
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
