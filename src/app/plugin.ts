import { Notice, Plugin } from "obsidian";

import { KeySuggestionOrderController } from "../features/key-order/key-suggestion-controller";
import { PropertyValueOrderController } from "../features/value-order/value-drag-controller";
import { t } from "../shared/i18n";
import {
  createDefaultSettings,
  hasFutureSettingsSchema,
  normalizeSettings,
  prepareSettingsForStorage,
} from "../shared/settings";
import type { PropertyOrderSettings } from "../shared/types";
import { PropertyOrderSettingTab } from "./settings-tab";

export const VALUE_DRAG_ENABLED_CLASS = "property-order-value-drag-enabled";
const STALE_SETTINGS_INSTANCE_ERROR =
  "Property Order settings cannot be saved after plugin unload.";

let settingsStorageQueue: Promise<void> = Promise.resolve();

interface SettingsSaveWaiter {
  reject(reason: unknown): void;
  resolve(): void;
}

export default class PropertyOrderPlugin extends Plugin {
  private cleanupCallbacks: Array<() => void> = [];
  private keySuggestionOrderController: KeySuggestionOrderController | null = null;
  private lifecycleEpoch = 0;
  private pendingKeySuggestionRefresh = false;
  private pendingSettingsSave = false;
  private readonly pendingSettingsSaveWaiters: SettingsSaveWaiter[] = [];
  private settingsSaveRequested = false;
  private settingsSaveTask: Promise<void> | null = null;
  private settingTab: PropertyOrderSettingTab | null = null;
  private persistedSettingsBaseline = createDefaultSettings();
  private trackedDocuments = new Set<Document>();
  private unloaded = false;
  propertyOrderSettings: PropertyOrderSettings = createDefaultSettings();

  override onload(): void {
    this.unloaded = false;
    const lifecycleEpoch = ++this.lifecycleEpoch;
    void this.initialize(lifecycleEpoch).catch((error: unknown) => {
      if (this.isLifecycleCurrent(lifecycleEpoch)) {
        console.error("Property Order: failed to initialize", error);
      }
    });
  }

  override onunload(): void {
    this.unloaded = true;
    this.lifecycleEpoch += 1;
    this.releaseCleanupCallbacks(0);

    this.clearTrackedDocumentState();
    this.keySuggestionOrderController = null;
    this.settingTab = null;
  }

  override async onExternalSettingsChange(): Promise<void> {
    const lifecycleEpoch = this.lifecycleEpoch;
    await this.settingsSaveTask;

    if (!this.isLifecycleCurrent(lifecycleEpoch)) {
      return;
    }

    let externalSettings: unknown;

    try {
      externalSettings = await runSettingsStorageOperation(() => this.loadData());
    } catch (error) {
      if (this.isLifecycleCurrent(lifecycleEpoch)) {
        console.error("Property Order: failed to reload external settings", error);
      }
      return;
    }

    if (!this.isLifecycleCurrent(lifecycleEpoch)) {
      return;
    }

    const previousSettings = normalizeSettings(this.propertyOrderSettings);
    const externalBaseline = normalizeSettings(externalSettings);
    const mergedSettings = normalizeSettings(
      prepareSettingsForStorage(
        previousSettings,
        externalSettings,
        this.persistedSettingsBaseline,
      ),
    );
    this.propertyOrderSettings = mergedSettings;
    this.persistedSettingsBaseline = externalBaseline;
    this.syncValueDragState();

    if (!areSuggestionSettingsEqual(previousSettings, mergedSettings)) {
      this.refreshKeySuggestionsSafely();
    }

    this.settingTab?.refreshAfterExternalSettingsChange();
  }

  async loadSettings(expectedLifecycleEpoch?: number): Promise<boolean> {
    const storedSettings: unknown = await runSettingsStorageOperation(() =>
      this.loadData(),
    );

    if (!this.isLifecycleCurrent(expectedLifecycleEpoch)) {
      return false;
    }

    const normalizedSettings = normalizeSettings(storedSettings);
    this.propertyOrderSettings = normalizedSettings;
    this.persistedSettingsBaseline = normalizeSettings(storedSettings);
    this.pendingSettingsSave = false;
    this.syncValueDragState();

    if (
      !hasFutureSettingsSchema(storedSettings) &&
      JSON.stringify(storedSettings) !== JSON.stringify(this.propertyOrderSettings)
    ) {
      const settingsForStorage = prepareSettingsForStorage(
        this.propertyOrderSettings,
        storedSettings,
      );

      try {
        await runSettingsStorageOperation(() => this.saveData(settingsForStorage));
      } catch (error) {
        if (!this.isLifecycleCurrent(expectedLifecycleEpoch)) {
          return false;
        }

        this.pendingSettingsSave = true;
        console.error("Property Order: failed to save migrated settings", error);
        new Notice(t("notice.settingsSaveFailed", this.propertyOrderSettings.language));
        return true;
      }

      if (!this.isLifecycleCurrent(expectedLifecycleEpoch)) {
        return false;
      }

      this.persistedSettingsBaseline = normalizeSettings(settingsForStorage);
    }

    return true;
  }

  hasPendingSettingsSave(): boolean {
    return this.pendingSettingsSave;
  }

  clearRecentPropertyKeys(): boolean {
    return this.keySuggestionOrderController?.clearRecentPropertyKeys() ?? false;
  }

  private async initialize(lifecycleEpoch: number): Promise<void> {
    const settingsLoaded = await this.loadSettings(lifecycleEpoch);

    if (!settingsLoaded || !this.isLifecycleCurrent(lifecycleEpoch)) {
      return;
    }

    const cleanupCheckpoint = this.cleanupCallbacks.length;

    try {
      const windowOpenRef = this.app.workspace.on(
        "window-open",
        (_workspaceWindow, targetWindow) => {
          this.applyValueDragState(targetWindow.document);
        },
      );
      this.registerEvent(windowOpenRef);
      this.registerController(() => this.app.workspace.offref(windowOpenRef));

      const windowCloseRef = this.app.workspace.on(
        "window-close",
        (_workspaceWindow, targetWindow) => {
          try {
            targetWindow.document.body.classList.remove(VALUE_DRAG_ENABLED_CLASS);
          } catch (error) {
            console.error("Property Order: failed to clean a closed window drag state", error);
          } finally {
            this.trackedDocuments.delete(targetWindow.document);
          }
        },
      );
      this.registerEvent(windowCloseRef);
      this.registerController(() => this.app.workspace.offref(windowCloseRef));

      const valueOrderController = new PropertyValueOrderController(
        this,
        () => this.propertyOrderSettings,
      );
      this.registerController(valueOrderController.dispose);
      valueOrderController.initialize();

      this.keySuggestionOrderController = new KeySuggestionOrderController(
        this,
        () => this.propertyOrderSettings,
      );
      this.registerController(this.keySuggestionOrderController.dispose);
      this.keySuggestionOrderController.initialize();

      if (!this.isLifecycleCurrent(lifecycleEpoch)) {
        this.releaseCleanupCallbacks(cleanupCheckpoint);
        this.keySuggestionOrderController = null;
        return;
      }

      this.settingTab = new PropertyOrderSettingTab(this.app, this);
      this.addSettingTab(this.settingTab);
    } catch (error) {
      this.releaseCleanupCallbacks(cleanupCheckpoint);
      this.keySuggestionOrderController = null;
      this.settingTab = null;
      this.clearTrackedDocumentState();
      throw error;
    }
  }

  /**
   * Resolves when the save batch containing this request is persisted. Requests
   * received while a batch is in flight are coalesced into the following batch;
   * a failed batch rejects only its own callers and does not strand later work.
   */
  saveSettings(refreshKeySuggestions = false): Promise<void> {
    if (this.unloaded) {
      return Promise.reject(new Error(STALE_SETTINGS_INSTANCE_ERROR));
    }

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

  private releaseCleanupCallbacks(startIndex: number): void {
    const cleanupCount = this.cleanupCallbacks.length - startIndex;

    if (cleanupCount <= 0) {
      return;
    }

    for (const cleanup of this.cleanupCallbacks.splice(startIndex, cleanupCount).reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.error("Property Order: failed to release a plugin resource", error);
      }
    }
  }

  private clearTrackedDocumentState(): void {
    for (const trackedDocument of this.trackedDocuments) {
      try {
        trackedDocument.body.classList.remove(VALUE_DRAG_ENABLED_CLASS);
      } catch (error) {
        console.error("Property Order: failed to clean a document drag state", error);
      }
    }

    this.trackedDocuments.clear();
  }

  private async flushSettingsSaves(): Promise<void> {
    while (this.settingsSaveRequested) {
      this.settingsSaveRequested = false;
      const shouldRefreshKeySuggestions = this.pendingKeySuggestionRefresh;
      this.pendingKeySuggestionRefresh = false;
      const saveWaiters = this.pendingSettingsSaveWaiters.splice(0);

      try {
        const settingsSnapshot = normalizeSettings(this.propertyOrderSettings);
        const settingsForStorage = await runSettingsStorageOperation(async () => {
          const latestStoredSettings: unknown = await this.loadData();
          const preparedSettings = prepareSettingsForStorage(
            settingsSnapshot,
            latestStoredSettings,
            this.persistedSettingsBaseline,
          );

          if (this.unloaded) {
            throw new Error(STALE_SETTINGS_INSTANCE_ERROR);
          }

          await this.saveData(preparedSettings);
          return preparedSettings;
        });
        const mergedSettings = normalizeSettings(settingsForStorage);
        const currentSettings = normalizeSettings(this.propertyOrderSettings);
        const runtimeSettings = normalizeSettings(
          prepareSettingsForStorage(
            currentSettings,
            settingsForStorage,
            settingsSnapshot,
          ),
        );
        const settingsChangedExternally = !areSuggestionSettingsEqual(
          settingsSnapshot,
          runtimeSettings,
        );
        this.propertyOrderSettings = runtimeSettings;
        this.persistedSettingsBaseline = mergedSettings;
        this.pendingSettingsSave = false;
        this.syncValueDragState();

        if (shouldRefreshKeySuggestions || settingsChangedExternally) {
          this.refreshKeySuggestionsSafely();
        }

        for (const waiter of saveWaiters) {
          waiter.resolve();
        }
      } catch (error) {
        this.pendingSettingsSave = true;

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

  private isLifecycleCurrent(expectedLifecycleEpoch?: number): boolean {
    return expectedLifecycleEpoch == null || (
      !this.unloaded && this.lifecycleEpoch === expectedLifecycleEpoch
    );
  }

  private syncValueDragState(): void {
    if (this.unloaded) {
      return;
    }

    if (typeof document !== "undefined") {
      this.applyValueDragState(document);
    }

    this.app.workspace.iterateAllLeaves((leaf) => {
      this.applyValueDragState(leaf.view.containerEl.ownerDocument);
    });
  }

  private applyValueDragState(targetDocument: Document): void {
    if (this.unloaded) {
      targetDocument.body.classList.remove(VALUE_DRAG_ENABLED_CLASS);
      this.trackedDocuments.delete(targetDocument);
      return;
    }

    this.trackedDocuments.add(targetDocument);
    targetDocument.body.classList.toggle(
      VALUE_DRAG_ENABLED_CLASS,
      this.propertyOrderSettings.enablePropertyValueDrag,
    );
  }
}

function areSuggestionSettingsEqual(
  left: PropertyOrderSettings,
  right: PropertyOrderSettings,
): boolean {
  return (
    left.enableNativeKeySuggestionOrder === right.enableNativeKeySuggestionOrder &&
    left.keySuggestionSortMode === right.keySuggestionSortMode &&
    areStringListsEqual(left.pinnedPropertyKeys, right.pinnedPropertyKeys) &&
    areStringListsEqual(left.bottomPropertyKeys, right.bottomPropertyKeys) &&
    areStringListsEqual(left.hiddenPropertyKeyPatterns, right.hiddenPropertyKeyPatterns)
  );
}

function areStringListsEqual(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function runSettingsStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsStorageQueue.then(operation, operation);
  settingsStorageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
