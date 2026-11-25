import { AccessibleSetting as Setting } from "./accessible-setting";
import type { Setting as NativeSetting } from "obsidian";
import {
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  type App,
  type SettingDefinitionItem,
} from "obsidian";

import { explainPropertyKeyRules } from "../core/suggestions/order-keys";
import { getPropertyNameSuggestions } from "../core/suggestions/property-names";
import { getResolvedLocaleCode, t, type TranslationKey } from "../shared/i18n";
import { SUPPORTED_LOCALES } from "../shared/locale-catalog";
import { getCachedPropertyKeyUsage } from "../obsidian/metadata";
import { isKeySuggestionSortMode, isValueSuggestionDefaultBehavior, type PersistedSettingKey } from "../shared/settings";
import type {
  KeySuggestionSortMode,
  PropertyOrderSettings,
  PropertyValueUsage,
  ValueSuggestionDefaultBehavior,
} from "../shared/types";
import { PropertyNameSuggest } from "./property-name-suggest";
import { renderValueSuggestionBehaviorGroups } from "./value-suggestion-behavior-groups";
import { parseKeyRuleLines, preserveSettingsDrafts } from "./settings-drafts";
import { renderCustomValueSuggestionEditor } from "./value-suggestion-custom-editor";
import { renderWritebackFormatExamples } from "./writeback-format-examples";
import {
  SETTINGS_PANEL,
  applyPropertyOrderControlValue,
  isPropertyOrderControlValue,
  type PropertyOrderControlKey,
} from "./settings-control-contract";
import {
  createSettingsTabLayout,
  focusSettingsTab,
  type SettingsTabId,
} from "./settings-tabs";

interface PropertyOrderSettingsHost extends Plugin {
  clearRecentPropertyKeys(): boolean;
  clearPropertyValueFrequency(): boolean;
  getPropertyValueFrequency(propertyKey: string): PropertyValueUsage[];
  hasPendingSettingsSave(): boolean;
  saveSettings(
    refreshKeySuggestions?: boolean,
    refreshValueSuggestions?: boolean,
  ): Promise<void>;
  propertyOrderSettings: PropertyOrderSettings;
}

interface KeyListSettingLifecycle {
  close(): void;
  flush(): void;
}

type SettingsCleanup = () => void;

export class PropertyOrderSettingTab extends PluginSettingTab {
  private activeTab: SettingsTabId = "general";
  private readonly expandedHelp = new Set<"format" | "archive">();
  private activeHelp: { key: "format" | "archive"; details: HTMLDetailsElement } | null = null;
  private hasUnsavedSettings = false;
  private readonly keyListSettingCleanups = new Map<
    KeyListSettingLifecycle,
    SettingsCleanup
  >();
  private pendingUnsavedKeySuggestionRefresh = false;
  private pendingUnsavedValueSuggestionRefresh = false;
  private readonly plugin: PropertyOrderSettingsHost;
  private readonly ruleDiagnosticCleanups = new Set<SettingsCleanup>();
  private readonly ruleDiagnosticRefreshes = new Set<() => void>();
  private selectedCustomValuePropertyKey: string | null = null;
  private readonly valueSuggestionUiCleanups = new Set<SettingsCleanup>();
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
    // Nonempty definitions cause Obsidian to bypass our four-tab settings UI.
    return [];
  }

  override display(): void {
    this.hasUnsavedSettings = this.plugin.hasPendingSettingsSave();
    this.redrawCurrentTab();
  }

  override hide(): void {
    this.activeHelp = null;
    this.expandedHelp.clear();
    this.settingsSurfaceVisible = false;
    this.settingsSurfaceGeneration += 1;

    try {
      super.hide();
    } catch (error) {
      reportSettingsCleanupError(error);
    }

    this.resetRenderedSettings();
  }

  refreshAfterExternalSettingsChange(changed: readonly PersistedSettingKey[]): void {
    this.hasUnsavedSettings = this.plugin.hasPendingSettingsSave();
    if (!this.settingsSurfaceVisible || this.tabLayoutCleanup == null) return;
    if (changed.some((key) => key === "language" || SETTINGS_PANEL[key] === this.activeTab)) {
      this.redrawCurrentTab();
    }
  }

  private redrawCurrentTab(): void {
    preserveSettingsDrafts(this.containerEl, (draftBehaviors) => this.render(null, draftBehaviors));
    this.refreshRuleDiagnostics();
  }

  private restoreHelp(key: "format" | "archive", details: HTMLDetailsElement): void {
    details.open = this.expandedHelp.has(key);
    this.activeHelp = { key, details };
  }

  private getKeySuggestionSortOptions(): Record<KeySuggestionSortMode, string> {
    return {
      name: this.t("settings.keyOrder.sortMode.nameOption"),
      recent: this.t("settings.keyOrder.sortMode.recent"),
      usage: this.t("settings.keyOrder.sortMode.usage"),
    };
  }

  private addClearRecentPropertyKeysButton(setting: NativeSetting): void {
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

  private render(focusTab: SettingsTabId | null, draftBehaviors?: ReadonlySet<string>): void {
    const { containerEl } = this;
    if (this.activeHelp) {
      const { key, details } = this.activeHelp;
      if (details.open) this.expandedHelp.add(key);
      else this.expandedHelp.delete(key);
      this.activeHelp = null;
    }
    this.resetRenderedSettings();
    this.beginSettingsSurfaceRender();

    // Keep language and text direction on plugin-owned content, not the reusable host container.
    const localizedContainerEl = containerEl.createDiv();
    localizedContainerEl.className = "property-order-settings-content";
    const locale = getResolvedLocaleCode(this.plugin.propertyOrderSettings.language);
    localizedContainerEl.lang = locale;
    localizedContainerEl.dir = locale === "ar" ? "rtl" : "ltr";

    const tabs = [
      { id: "general", label: this.t("settings.tab.general") },
      { id: "valueDrag", label: this.t("settings.tab.valueOrder") },
      { id: "keyOrder", label: this.t("settings.tab.keySuggestions") },
      { id: "valueSuggestions", label: this.t("settings.tab.valueSuggestions") },
    ] satisfies Array<{ id: SettingsTabId; label: string }>;
    const { activeTabEl, cleanup, panelEl } = createSettingsTabLayout(
      localizedContainerEl,
      tabs,
      this.activeTab,
      this.t("settings.tabsLabel"),
      { earlier: this.t("settings.tabs.earlier"), later: this.t("settings.tabs.later") },
      (tabId) => {
        this.activeTab = tabId;
        this.render(tabId);
      },
    );
    this.tabLayoutCleanup = cleanup;
    this.mountSaveStatus(panelEl);

    if (this.activeTab === "valueSuggestions") {
      this.displayValueSuggestionSettings(panelEl, draftBehaviors);
    } else if (this.activeTab === "keyOrder") {
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
      .setFocusKey("language")
      .setName(this.t("settings.language.name"))
      .setDesc(this.t("settings.language.desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("auto", this.t("settings.language.auto"));
        for (const { id, label } of SUPPORTED_LOCALES) {
          dropdown.addOption(id, label);
        }
        dropdown
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
    const support = new Setting(containerEl)
      .setName(this.t("settings.support.name"))
      .setClass("property-order-settings-support");
    const locale = getResolvedLocaleCode(this.plugin.propertyOrderSettings.language);
    const guide = locale === "en" ? "README.md" : `docs/i18n/README.${locale}.md`;
    for (const [label, href] of [
      [this.t("settings.support.guide"), `https://github.com/ZHYX91/obsidian-property-order/blob/main/${guide}`],
      [this.t("settings.support.issue"), "https://github.com/ZHYX91/obsidian-property-order/issues/new/choose"],
    ]) {
      support.controlEl.createEl("a", {
        text: label,
        attr: { href },
        cls: "external-link",
      });
    }
  }

  private displayValueDragSettings(containerEl: HTMLElement): void {
    addInactiveHint(containerEl, this.t("keyboard.settingsHint"));
    if (Platform.isMobileApp) {
      addInactiveHint(containerEl, this.t("settings.valueDrag.mobileHint"));
    }

    new Setting(containerEl)
      .setFocusKey("enablePropertyValueDrag")
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

    const formatSetting = new Setting(containerEl)
      .setClass("property-order-writeback-format")
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

    const details = renderWritebackFormatExamples(formatSetting.settingEl, (key) => this.t(key));
    this.restoreHelp("format", details);

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
    const availableNames = getAvailablePropertyNames(this.app);

    new Setting(containerEl)
      .setFocusKey("enableNativeKeySuggestionOrder")
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

    const keyMode = this.plugin.propertyOrderSettings.keySuggestionSortMode;
    const keyOrder = new Setting(containerEl)
      .setName(this.t("settings.keyOrder.sortMode.name"))
      .setDesc(this.t(`settings.keyOrder.sortMode.help.${keyMode}`));
    keyOrder.addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(
        this.getKeySuggestionSortOptions(),
      )) {
        dropdown.addOption(value, label);
      }

      dropdown
        .setValue(keyMode)
        .onChange(async (value) => {
          if (!isKeySuggestionSortMode(value)) return;
          keyOrder.setDesc(this.t(`settings.keyOrder.sortMode.help.${value}`));
          await this.applyImperativeControlValue("keySuggestionSortMode", value);
        });
    });

    new Setting(containerEl)
      .setName(this.t("settings.keyOrder.groupByType.name"))
      .setDesc(this.t("settings.keyOrder.groupByType.desc"))
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.propertyOrderSettings.groupKeySuggestionsByType)
          .onChange(async (value) => {
            await this.applyImperativeControlValue("groupKeySuggestionsByType", value);
          });
      });

    const recentHistorySetting = new Setting(containerEl)
      .setName(this.t("settings.keyOrder.recentHistory.name"))
      .setDesc(this.t("settings.keyOrder.recentHistory.desc"));
    this.addClearRecentPropertyKeysButton(recentHistorySetting);

    for (const [key, label] of [
      ["pinnedPropertyKeys", "pinned"],
      ["bottomPropertyKeys", "bottom"],
      ["hiddenPropertyKeyPatterns", "hidden"],
    ] as const) {
      const setting = new Setting(containerEl)
        .setName(this.t(`settings.keyOrder.${label}.name`))
        .setDesc(this.t(`settings.keyOrder.${label}.desc`));
      this.trackKeyListSetting(configureKeyListSetting(
        setting, key, this.plugin.propertyOrderSettings[key],
        async (values) => {
          this.plugin.propertyOrderSettings[key] = values;
          this.refreshRuleDiagnostics();
          await this.persistSettings(true);
        },
        this.app, availableNames, this.t("settings.keyOrder.addExisting.placeholder"),
      ));
    }

    this.configureRuleDiagnosticSetting(
      new Setting(containerEl)
        .setName(this.t("settings.keyOrder.ruleDiagnostic.name"))
        .setDesc(this.t("settings.keyOrder.ruleDiagnostic.desc")),
    );
  }

  private displayValueSuggestionSettings(containerEl: HTMLElement, draftBehaviors?: ReadonlySet<string>): void {
    const surfaceGeneration = this.settingsSurfaceGeneration;
    const settingsAtRender = this.plugin.propertyOrderSettings;

    new Setting(containerEl)
      .setName(this.t("settings.valueSuggestions.enable.name"))
      .setDesc(this.t("settings.valueSuggestions.enable.desc"))
      .addToggle((toggle) => {
        toggle
          .setValue(settingsAtRender.enableNativeValueSuggestionOrder)
          .onChange(async (value) => {
            this.plugin.propertyOrderSettings.enableNativeValueSuggestionOrder = value;
            disabledHint.hidden = value;
            await this.persistSettings(false, true);
          });
      });

    const disabledHint = addInactiveHint(containerEl, this.t("settings.valueSuggestions.disabledHint"));
    disabledHint.hidden = settingsAtRender.enableNativeValueSuggestionOrder;

    const archivedRules = settingsAtRender.valueSuggestionLegacyRules;
    if (archivedRules !== null) {
      const migrationEl = containerEl.createDiv({
        cls: "property-order-value-suggestion-migration",
      });
      const message = migrationEl.createDiv({
        cls: "property-order-settings-hint",
      });
      message.textContent = this.t("settings.valueSuggestions.legacyRulesArchived");

      const details = migrationEl.createEl("details", { cls: "property-order-help-disclosure" });
      this.restoreHelp("archive", details);
      const summary = details.createEl("summary");
      summary.textContent = this.t("settings.valueSuggestions.legacyMigrationDetails");
      const legacyRules = details.createEl("pre");
      legacyRules.className = "property-order-legacy-value-rules";
      legacyRules.textContent = [
        `${this.t("settings.valueSuggestions.sortMode.name")}: ${this.getLegacyValueSuggestionModeLabel(archivedRules.sortMode)}`,
        ...archivedRules.sortOverrides.map((rule) =>
          `${this.t("settings.valueSuggestions.sortOverrides.name")}: ${this.formatLegacyValueSuggestionRule(rule)}`),
        ...archivedRules.pinnedValues.map((rule) =>
          `${this.t("settings.valueSuggestions.pinned.name")}: ${rule}`),
        ...archivedRules.bottomValues.map((rule) =>
          `${this.t("settings.valueSuggestions.bottom.name")}: ${rule}`),
        ...archivedRules.hiddenPatterns.map((rule) =>
          `${this.t("settings.valueSuggestions.hidden.name")}: ${rule}`),
      ].join("\n");

    }

    const valueMode = settingsAtRender.valueSuggestionDefaultBehavior;
    const valueOrder = new Setting(containerEl)
      .setName(this.t("settings.valueSuggestions.sortMode.name"))
      .setDesc(this.t(`settings.valueSuggestions.sortMode.help.${valueMode}`));
    valueOrder.addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(
        this.getValueSuggestionDefaultBehaviorOptions(),
      )) {
        dropdown.addOption(value, label);
      }

      dropdown
        .setValue(valueMode)
        .onChange(async (value) => {
          if (!isValueSuggestionDefaultBehavior(value)) {
            return;
          }

          valueOrder.setDesc(this.t(`settings.valueSuggestions.sortMode.help.${value}`));
          this.plugin.propertyOrderSettings.valueSuggestionDefaultBehavior = value;
          await this.persistSettings(false, true);
        });
    });

    const frequencySetting = new Setting(containerEl)
      .setName(this.t("settings.valueSuggestions.frequencyHistory.name"))
      .setDesc(this.t("settings.valueSuggestions.frequencyHistory.desc"));
    frequencySetting.addButton((button) => {
      button
        .setButtonText(this.t("settings.valueSuggestions.frequencyHistory.clear"))
        .onClick(() => {
          this.clearPropertyValueFrequency();
          const editor = containerEl.querySelector<HTMLElement>(".property-order-custom-value-layout")?.parentElement;
          if (editor != null) renderCustom(editor);
        });
    });

    const renderCustom = (container: HTMLElement): void => {
      if (!this.isSettingsSurfaceCurrent(surfaceGeneration)) return;
      preserveSettingsDrafts(container, () => {
        // Build off-document in the settings window's realm, then swap atomically.
        const staging = container.createDiv();
        staging.remove();
        const customLifecycle = renderCustomValueSuggestionEditor({
          app: this.app,
          assignments: this.plugin.propertyOrderSettings.valueSuggestionPropertyAssignments,
          containerEl: staging,
          customOrders: this.plugin.propertyOrderSettings.valueSuggestionCustomOrders,
          displayOrder: this.plugin.propertyOrderSettings.valueSuggestionKeyDisplayOrder,
          getFrequency: (propertyKey) =>
            this.plugin.getPropertyValueFrequency(propertyKey),
          onCustomOrdersChange: async (orders) => {
            this.plugin.propertyOrderSettings.valueSuggestionCustomOrders = orders;
            await this.persistSettings(false, true);
          },
          rerender: (selectedPropertyKey) => {
            this.selectedCustomValuePropertyKey =
              selectedPropertyKey ?? this.selectedCustomValuePropertyKey;
            if (this.isSettingsSurfaceCurrent(surfaceGeneration)) {
              renderCustom(container);
            }
          },
          selectedPropertyKey: this.selectedCustomValuePropertyKey,
          t: (key) => this.t(key),
        });
        this.selectedCustomValuePropertyKey = customLifecycle.selectedPropertyKey;
        container.replaceChildren(...Array.from(staging.childNodes));
      });
    };
    const behaviorLifecycle = renderValueSuggestionBehaviorGroups({
      draftBehaviors,
      app: this.app,
      containerEl,
      getCustomOrderKeys: () =>
        this.plugin.propertyOrderSettings.valueSuggestionCustomOrders.map(
          (order) => order.propertyKey,
        ),
      displayOrder: settingsAtRender.valueSuggestionKeyDisplayOrder,
      getAssignments: () =>
        this.plugin.propertyOrderSettings.valueSuggestionPropertyAssignments,
      onAssignmentsChange: async (assignments) => {
        this.plugin.propertyOrderSettings.valueSuggestionPropertyAssignments =
          assignments;
        await this.persistSettings(false, true);
      },
      onDisplayOrderChange: async (displayOrder) => {
        this.plugin.propertyOrderSettings.valueSuggestionKeyDisplayOrder =
          displayOrder;
        await this.persistSettings();
      },
      renderCustomEditor: renderCustom,
      t: (key) => this.t(key),
    });
    this.trackValueSuggestionUiCleanup(() => behaviorLifecycle.close());
  }

  private clearPropertyValueFrequency(): void {
    const persisted = this.plugin.clearPropertyValueFrequency();
    new Notice(this.t(
      persisted
        ? "notice.valueFrequencyCleared"
        : "notice.valueFrequencyClearFailed",
    ));
  }

  private getValueSuggestionDefaultBehaviorOptions(): Record<
    ValueSuggestionDefaultBehavior,
    string
  > {
    return {
      native: this.t("settings.valueSuggestions.sortMode.native"),
      name: this.t("settings.valueSuggestions.sortMode.nameOption"),
      frequency: this.t("settings.valueSuggestions.behavior.frequency"),
      "note-count": this.t("settings.valueSuggestions.sortMode.usage"),
      none: this.t("settings.valueSuggestions.sortMode.none"),
    };
  }

  private getLegacyValueSuggestionModeLabel(mode: string): string {
    const labels: Record<string, TranslationKey> = {
      native: "settings.valueSuggestions.sortMode.native",
      name: "settings.valueSuggestions.sortMode.nameOption",
      recent: "settings.valueSuggestions.sortMode.recent",
      usage: "settings.valueSuggestions.sortMode.usage",
      none: "settings.valueSuggestions.sortMode.none",
    };
    return Object.prototype.hasOwnProperty.call(labels, mode) ? this.t(labels[mode]) : mode;
  }

  private formatLegacyValueSuggestionRule(rule: string): string {
    const separator = rule.indexOf("=");
    if (separator < 0) return rule;
    const mode = rule.slice(separator + 1).trim();
    const label = this.getLegacyValueSuggestionModeLabel(mode);
    return label === mode ? rule : `${rule} (${label})`;
  }

  private configureRuleDiagnosticSetting(setting: NativeSetting): SettingsCleanup {
    let input: HTMLInputElement | undefined;
    const resultEl = setting.descEl.createDiv({
      cls: "property-order-rule-diagnostic-result",
    });
    resultEl.setAttribute("aria-live", "polite");

    const refresh = () => {
      resultEl.textContent = this.formatRuleDiagnostic(input?.value ?? "");
    };
    setting
      .setClass("property-order-rule-diagnostic-setting")
      .addText((text) => {
        text
          .setPlaceholder(this.t("settings.keyOrder.ruleDiagnostic.placeholder"))
          .setValue("")
          .onChange(refresh);
        input = text.inputEl;
        input.dataset.settingsFocus = "key-rule-diagnostic";
        text.inputEl.setAttribute(
          "aria-label",
          this.t("settings.keyOrder.ruleDiagnostic.name"),
        );
        text.inputEl.addClass("property-order-rule-diagnostic-input");
      });

    refresh();
    this.ruleDiagnosticRefreshes.add(refresh);
    const cleanup = createSettingsDisposer(
      () => this.ruleDiagnosticCleanups.delete(cleanup),
      () => this.ruleDiagnosticRefreshes.delete(refresh),
    );
    this.ruleDiagnosticCleanups.add(cleanup);
    return cleanup;
  }

  private formatRuleDiagnostic(propertyName: string): string {
    const explanation = explainPropertyKeyRules(propertyName, {
      bottomKeys: this.plugin.propertyOrderSettings.bottomPropertyKeys,
      hiddenPatterns: this.plugin.propertyOrderSettings.hiddenPropertyKeyPatterns,
      pinnedKeys: this.plugin.propertyOrderSettings.pinnedPropertyKeys,
    });
    if (explanation.key.length === 0) {
      return this.t("settings.keyOrder.ruleDiagnostic.empty");
    }

    const placementKey = `settings.keyOrder.ruleDiagnostic.${explanation.placement}` as const;
    const parts: string[] = [this.t(placementKey)];
    for (const [labelKey, pattern] of [
      ["settings.keyOrder.ruleDiagnostic.hiddenMatch", explanation.hiddenPattern],
      ["settings.keyOrder.ruleDiagnostic.pinnedMatch", explanation.pinnedPattern],
      ["settings.keyOrder.ruleDiagnostic.bottomMatch", explanation.bottomPattern],
    ] as const) {
      if (pattern != null) {
        parts.push(`${this.t(labelKey)}: ${pattern}`);
      }
    }
    if (parts.length > 1) {
      parts.push(this.t("settings.keyOrder.ruleDiagnostic.priority"));
    }
    return parts.join(" · ");
  }

  private refreshRuleDiagnostics(): void {
    for (const refresh of this.ruleDiagnosticRefreshes) {
      refresh();
    }
  }

  private trackValueSuggestionUiCleanup(cleanup: SettingsCleanup): void {
    const trackedCleanup = createSettingsDisposer(
      () => this.valueSuggestionUiCleanups.delete(trackedCleanup),
      cleanup,
    );
    this.valueSuggestionUiCleanups.add(trackedCleanup);
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
      ...this.ruleDiagnosticCleanups,
      ...this.valueSuggestionUiCleanups,
    );

    cleanup();
    this.keyListSettingCleanups.clear();
    this.ruleDiagnosticCleanups.clear();
    this.valueSuggestionUiCleanups.clear();
    this.ruleDiagnosticRefreshes.clear();
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
    const pendingSave = this.persistSettings(mutation.refreshKeySuggestions);
    if (
      mutation.rerender &&
      this.isSettingsSurfaceCurrent(surfaceGeneration)
    ) {
      this.redrawCurrentTab();
    }
    await pendingSave;
  }

  private async persistSettings(
    refreshKeySuggestions = false,
    refreshValueSuggestions = false,
  ): Promise<boolean> {
    const shouldRefreshKeySuggestions =
      refreshKeySuggestions || this.pendingUnsavedKeySuggestionRefresh;
    const shouldRefreshValueSuggestions =
      refreshValueSuggestions || this.pendingUnsavedValueSuggestionRefresh;

    try {
      await this.plugin.saveSettings(
        shouldRefreshKeySuggestions,
        shouldRefreshValueSuggestions,
      );
      this.hasUnsavedSettings = false;
      this.pendingUnsavedKeySuggestionRefresh = false;
      this.pendingUnsavedValueSuggestionRefresh = false;
      this.updateSaveStatus();
      return true;
    } catch (error) {
      this.hasUnsavedSettings = true;
      this.pendingUnsavedKeySuggestionRefresh = shouldRefreshKeySuggestions;
      this.pendingUnsavedValueSuggestionRefresh = shouldRefreshValueSuggestions;
      console.error("Property Order: failed to save settings", error);
      this.updateSaveStatus();

      if (this.settingsSurfaceVisible) {
        new Notice(this.t("notice.settingsSaveFailed"));
      }
      return false;
    }
  }

  private mountSaveStatus(parentEl: HTMLElement): HTMLElement {
    this.saveStatusEl?.remove();
    const statusEl = parentEl.createDiv();
    statusEl.classList.add("property-order-settings-save-status");
    parentEl.prepend(statusEl);
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

function addInactiveHint(containerEl: HTMLElement, text: string): HTMLElement {
  return containerEl.createDiv({
    cls: "property-order-settings-hint",
    text,
  });
}

function configureKeyListSetting(
  setting: NativeSetting,
  key: "pinnedPropertyKeys" | "bottomPropertyKeys" | "hiddenPropertyKeyPatterns",
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
          currentValues = parseKeyRuleLines(value);
          pendingSave.schedule();
        });
      textArea.inputEl.dataset.settingsFocus = `rules:${key}`;
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
      text.inputEl.dataset.settingsFocus = `add-key:${key}`;
      text.inputEl.setAttribute("aria-label", placeholder);

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
