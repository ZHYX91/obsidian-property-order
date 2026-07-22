import { Platform, Plugin } from "obsidian";

import { KeySuggestionOrderController } from "../features/key-order/key-suggestion-controller";
import { PropertyValueOrderController } from "../features/value-order/value-drag-controller";
import {
  createDefaultSettings,
  hasFutureSettingsSchema,
  normalizeSettings,
  prepareSettingsForStorage,
} from "../shared/settings";
import type { PropertyOrderSettings } from "../shared/types";
import { PropertyOrderSettingTab } from "./settings-tab";

export const VALUE_DRAG_ENABLED_CLASS = "property-order-value-drag-enabled";

interface SettingsSaveWaiter {
  reject(reason: unknown): void;
  resolve(): void;
}

export default class PropertyOrderPlugin extends Plugin {
  private cleanupCallbacks: Array<() => void> = [];
  private keySuggestionOrderController: KeySuggestionOrderController | null = null;
  private pendingKeySuggestionRefresh = false;
  private readonly pendingSettingsSaveWaiters: SettingsSaveWaiter[] = [];
  private settingsSaveRequested = false;
  private settingsSaveTask: Promise<void> | null = null;
  private persistedSettingsBaseline = createDefaultSettings();
  private storedSettings: unknown = null;
  private trackedDocuments = new Set<Document>();
  propertyOrderSettings: PropertyOrderSettings = createDefaultSettings();

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.registerEvent(
      this.app.workspace.on("window-open", (_workspaceWindow, targetWindow) => {
        this.applyValueDragState(targetWindow.document);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("window-close", (_workspaceWindow, targetWindow) => {
        targetWindow.document.body.classList.remove(VALUE_DRAG_ENABLED_CLASS);
        this.trackedDocuments.delete(targetWindow.document);
      }),
    );
    this.addSettingTab(new PropertyOrderSettingTab(this.app, this));
    this.registerController(
      new PropertyValueOrderController(this, () => this.propertyOrderSettings).initialize(),
    );
    this.keySuggestionOrderController = new KeySuggestionOrderController(
      this,
      () => this.propertyOrderSettings,
    );
    this.registerController(this.keySuggestionOrderController.initialize());
  }

  override onunload(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }

    for (const trackedDocument of this.trackedDocuments) {
      trackedDocument.body.classList.remove(VALUE_DRAG_ENABLED_CLASS);
    }

    this.trackedDocuments.clear();
    this.keySuggestionOrderController = null;
  }

  async loadSettings(): Promise<void> {
    const storedSettings = await this.loadData();
    this.storedSettings = storedSettings;
    this.propertyOrderSettings = normalizeSettings(storedSettings);
    this.persistedSettingsBaseline = normalizeSettings(storedSettings);
    this.syncValueDragState();

    if (
      !hasFutureSettingsSchema(storedSettings) &&
      JSON.stringify(storedSettings) !== JSON.stringify(this.propertyOrderSettings)
    ) {
      const settingsForStorage = prepareSettingsForStorage(
        this.propertyOrderSettings,
        storedSettings,
      );
      await this.saveData(settingsForStorage);
      this.storedSettings = settingsForStorage;
      this.persistedSettingsBaseline = normalizeSettings(settingsForStorage);
    }
  }

  /**
   * Resolves when the save batch containing this request is persisted. Requests
   * received while a batch is in flight are coalesced into the following batch;
   * a failed batch rejects only its own callers and does not strand later work.
   */
  saveSettings(refreshKeySuggestions = false): Promise<void> {
    this.settingsSaveRequested = true;
    this.pendingKeySuggestionRefresh ||= refreshKeySuggestions;
    this.syncValueDragState();
    const result = new Promise<void>((resolve, reject) => {
      this.pendingSettingsSaveWaiters.push({ reject, resolve });
    });

    this.startSettingsSaveTask();
    return result;
  }

  private startSettingsSaveTask(): void {
    if (this.settingsSaveTask != null) {
      return;
    }

    const task = this.flushSettingsSaves();
    this.settingsSaveTask = task;
    void task.finally(() => {
      if (this.settingsSaveTask !== task) {
        return;
      }

      this.settingsSaveTask = null;

      if (this.settingsSaveRequested) {
        this.startSettingsSaveTask();
      }
    });
  }

  private registerController(cleanup: () => void): void {
    this.cleanupCallbacks.push(cleanup);
  }

  private async flushSettingsSaves(): Promise<void> {
    while (this.settingsSaveRequested) {
      this.settingsSaveRequested = false;
      const shouldRefreshKeySuggestions = this.pendingKeySuggestionRefresh;
      this.pendingKeySuggestionRefresh = false;
      const saveWaiters = this.pendingSettingsSaveWaiters.splice(0);

      try {
        const settingsSnapshot = normalizeSettings(this.propertyOrderSettings);
        const settingsForStorage = prepareSettingsForStorage(
          settingsSnapshot,
          this.storedSettings,
          this.persistedSettingsBaseline,
        );
        await this.saveData(settingsForStorage);
        this.storedSettings = settingsForStorage;
        this.persistedSettingsBaseline = settingsSnapshot;

        if (shouldRefreshKeySuggestions) {
          this.refreshKeySuggestionsSafely();
        }

        for (const waiter of saveWaiters) {
          waiter.resolve();
        }
      } catch (error) {
        if (shouldRefreshKeySuggestions) {
          this.refreshKeySuggestionsSafely();
        }

        for (const waiter of saveWaiters) {
          waiter.reject(error);
        }
      }
    }
  }

  private refreshKeySuggestionsSafely(): void {
    try {
      this.keySuggestionOrderController?.refresh();
    } catch (error) {
      console.error("Property Order: failed to refresh property name suggestions", error);
    }
  }

  private syncValueDragState(): void {
    if (typeof document !== "undefined") {
      this.applyValueDragState(document);
    }

    this.app.workspace.iterateAllLeaves((leaf) => {
      this.applyValueDragState(leaf.view.containerEl.ownerDocument);
    });
  }

  private applyValueDragState(targetDocument: Document): void {
    this.trackedDocuments.add(targetDocument);
    targetDocument.body.classList.toggle(
      VALUE_DRAG_ENABLED_CLASS,
      !Platform.isMobileApp && this.propertyOrderSettings.enablePropertyValueDrag,
    );
  }
}
