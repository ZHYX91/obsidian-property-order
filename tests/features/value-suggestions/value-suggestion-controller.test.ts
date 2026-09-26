// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { Platform, type App, type Plugin, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyValueFrequencyStore } from "../../../src/features/value-suggestions/property-value-frequency-store";
import { RecentPropertyValueStore } from "../../../src/features/value-suggestions/recent-property-value-store";
import { ValueSuggestionOrderController } from "../../../src/features/value-suggestions/value-suggestion-controller";
import { createDefaultSettings } from "../../../src/shared/settings";
import type { PropertyOrderSettings } from "../../../src/shared/types";

interface RafHarness {
  flush(): void;
  pending(): number;
}

interface TestableValueController {
  activeContainers: Map<Document, HTMLElement>;
  documentStates: Map<Document, unknown>;
  enhanceContainer(container: HTMLElement): void;
  getActiveContainer(targetDocument: Document): HTMLElement | null;
  invalidateUsage(): void;
  originalSuggestions: Map<HTMLElement, unknown>;
  recordConfirmedPropertyValue(propertyKey: string, value: string): void;
  recordRecentPropertyValue(propertyKey: string, value: string): void;
  refreshCustomFallback(targetDocument: Document): void;
  restoreContainer(container: HTMLElement): void;
  shouldScheduleEnhancement(
    targetDocument: Document,
    mutations: readonly MutationRecord[],
  ): boolean;
}

function installRafHarness(targetWindow: Window = window): RafHarness {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(targetWindow, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(targetWindow, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const queued = Array.from(callbacks.values());
      callbacks.clear();
      for (const callback of queued) {
        callback(targetWindow.performance.now());
      }
    },
    pending: () => callbacks.size,
  };
}

function createApp(options: {
  files?: TFile[];
  frontmatterByFile?: Map<TFile, Record<string, unknown>>;
} = {}): App {
  const files = options.files ?? [];
  const frontmatterByFile = options.frontmatterByFile ?? new Map();

  return {
    loadLocalStorage: vi.fn(() => null),
    saveLocalStorage: vi.fn(),
    metadataCache: {
      getFileCache: vi.fn((file: TFile) => {
        const frontmatter = frontmatterByFile.get(file);
        return frontmatter == null ? null : { frontmatter };
      }),
      offref: vi.fn(),
      on: vi.fn(() => ({})),
    },
    vault: {
      getMarkdownFiles: vi.fn(() => files),
    },
    workspace: {
      iterateAllLeaves: vi.fn(),
      offref: vi.fn(),
      on: vi.fn(() => ({})),
    },
  } as unknown as App;
}

function createController(
  settings: PropertyOrderSettings,
  app = createApp(),
  store?: RecentPropertyValueStore,
  frequencyStore?: PropertyValueFrequencyStore,
): ValueSuggestionOrderController {
  const plugin = {
    app,
    registerEvent: vi.fn(),
  } as unknown as Plugin;
  return new ValueSuggestionOrderController(plugin, () => settings, store, frequencyStore);
}

function createValueMenu(
  values: string[],
  propertyKey = "status",
  targetDocument: Document = document,
): { container: HTMLElement; editor: HTMLInputElement; row: HTMLElement } {
  const row = targetDocument.createElement("div");
  row.className = "metadata-property";
  row.dataset.propertyKey = propertyKey;
  const editor = targetDocument.createElement("input");
  editor.className = "metadata-property-value";
  row.appendChild(editor);
  targetDocument.body.appendChild(row);

  const container = targetDocument.createElement("div");
  container.className = "suggestion-container";
  replaceValues(container, values, targetDocument);
  targetDocument.body.appendChild(container);
  editor.focus();
  return { container, editor, row };
}

function replaceValues(
  container: HTMLElement,
  values: string[],
  targetDocument = container.ownerDocument,
): HTMLElement[] {
  const items = values.map((value) => {
    const item = targetDocument.createElement("div");
    item.className = "suggestion-item";
    const title = targetDocument.createElement("div");
    title.className = "suggestion-title";
    title.textContent = value;
    item.appendChild(title);
    return item;
  });
  container.replaceChildren(...items);
  items[0]?.classList.add("is-selected");
  return items;
}

function allValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".suggestion-item")).map(
    (item) => item.textContent?.trim() ?? "",
  );
}

function visibleValues(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(".suggestion-item:not([hidden])"),
  ).map((item) => item.textContent?.trim() ?? "");
}

function asTestable(controller: ValueSuggestionOrderController): TestableValueController {
  return controller as unknown as TestableValueController;
}

describe("ValueSuggestionOrderController", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    Platform.isIosApp = false;
    Platform.isMacOS = false;
    Platform.isMobileApp = false;
    vi.restoreAllMocks();
  });

  it("ignores unrelated body mutations after tracking a popup but detects candidate lifecycle changes", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["a", "b"]);

    testable.enhanceContainer(container);
    expect(testable.originalSuggestions.size).toBe(1);

    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true });
    const unrelatedText = document.createTextNode("unrelated");
    document.body.appendChild(unrelatedText);
    const unrelatedTextMutations = observer.takeRecords();
    observer.disconnect();

    expect(unrelatedTextMutations).toHaveLength(1);
    expect(unrelatedTextMutations[0]?.target).toBe(document.body);
    expect(
      testable.shouldScheduleEnhancement(document, unrelatedTextMutations),
    ).toBe(false);
    unrelatedText.remove();

    const unrelated = document.createElement("div");
    document.body.appendChild(unrelated);
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [unrelated],
      removedNodes: [],
      target: document.body,
      type: "childList",
    } as unknown as MutationRecord])).toBe(false);

    const addedItem = document.createElement("div");
    addedItem.className = "suggestion-item";
    container.appendChild(addedItem);
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [addedItem],
      removedNodes: [],
      target: container,
      type: "childList",
    } as unknown as MutationRecord])).toBe(true);

    const titleText = container.querySelector(".suggestion-title")?.firstChild;
    expect(titleText).not.toBeNull();
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [],
      removedNodes: [],
      target: titleText as Node,
      type: "characterData",
    } as unknown as MutationRecord])).toBe(true);

    const wrapper = document.createElement("div");
    document.body.insertBefore(wrapper, container);
    wrapper.appendChild(container);
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [],
      removedNodes: [],
      target: wrapper,
      type: "attributes",
      attributeName: "hidden",
    } as unknown as MutationRecord])).toBe(true);

    addedItem.remove();
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [],
      removedNodes: [addedItem],
      target: container,
      type: "childList",
    } as unknown as MutationRecord])).toBe(true);

    container.remove();
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [],
      removedNodes: [container],
      target: wrapper,
      type: "childList",
    } as unknown as MutationRecord])).toBe(true);

    const inserted = createValueMenu(["c", "d"]).container;
    expect(testable.shouldScheduleEnhancement(document, [{
      addedNodes: [inserted],
      removedNodes: [],
      target: document.body,
      type: "childList",
    } as unknown as MutationRecord])).toBe(true);
    controller.dispose();
  });

  it("refreshes note-count ordering only when an active popup uses it", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["b", "a"]);
    controller.initialize();
    raf.flush();
    testable.enhanceContainer(container);

    testable.invalidateUsage();
    expect(raf.pending()).toBe(0);

    settings.valueSuggestionDefaultBehavior = "note-count";
    testable.enhanceContainer(container);
    testable.invalidateUsage();
    expect(raf.pending()).toBe(1);
    controller.dispose();
  });

  it("re-evaluates a reused popup when focus moves to another property", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "none", propertyKey: "status" },
      { behavior: "name", propertyKey: "priority" },
    ];
    const controller = createController(settings);
    const status = createValueMenu(["beta", "alpha"], "status");
    controller.initialize();
    raf.flush();

    expect(status.container.classList.contains("property-order-value-suggestions-suppressed")).toBe(
      true,
    );

    const priorityRow = document.createElement("div");
    priorityRow.className = "metadata-property";
    priorityRow.dataset.propertyKey = "priority";
    const priorityEditor = document.createElement("input");
    priorityEditor.className = "metadata-property-value";
    priorityRow.appendChild(priorityEditor);
    document.body.appendChild(priorityRow);
    priorityEditor.focus();

    expect(raf.pending()).toBe(1);
    raf.flush();

    expect(status.container.classList.contains("property-order-value-suggestions-suppressed")).toBe(
      false,
    );
    expect(visibleValues(status.container)).toEqual(["alpha", "beta"]);
    controller.dispose();
  });

  it("suppresses the native value candidate popup for a matching property", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "none", propertyKey: "status" },
    ];
    const controller = createController(settings);
    const { container } = createValueMenu(["draft", "done"]);

    asTestable(controller).enhanceContainer(container);

    expect(container.classList.contains("property-order-value-suggestions-suppressed")).toBe(true);
    expect(asTestable(controller).getActiveContainer(document)).toBeNull();
    expect(container.querySelector(".suggestion-item.is-selected")).toBeNull();
    expect(
      Array.from(container.querySelectorAll<HTMLElement>(".suggestion-item")).every(
        (item) =>
          item.hidden &&
          item.getAttribute("aria-hidden") === "true" &&
          item.classList.contains("property-order-suggestion-hidden"),
      ),
    ).toBe(true);

    settings.valueSuggestionPropertyAssignments = [];
    asTestable(controller).enhanceContainer(container);
    expect(container.classList.contains("property-order-value-suggestions-suppressed")).toBe(false);
    expect(visibleValues(container)).toEqual(["draft", "done"]);
    controller.dispose();
  });

  it("orders, hides, and restores native value suggestions", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionLegacyMigrationPending = true;
    settings.valueSuggestionSortMode = "name";
    settings.pinnedPropertyValues = ["status = draft"];
    settings.bottomPropertyValues = ["status = archived"];
    settings.hiddenPropertyValuePatterns = ["status = cancel*"];
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu([
      "archived",
      "beta",
      "draft",
      "cancelled",
      "alpha",
    ]);

    testable.enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["draft", "alpha", "beta", "archived"]);
    expect(allValues(container)).toEqual([
      "draft",
      "alpha",
      "beta",
      "archived",
      "cancelled",
    ]);
    expect(container.dataset.propertyOrderValueEnhanced).toBe("true");
    expect(
      container.querySelector<HTMLElement>(".suggestion-item.is-selected")?.textContent,
    ).toBe("draft");
    expect(testable.originalSuggestions.size).toBe(1);

    settings.enableNativeValueSuggestionOrder = false;
    testable.enhanceContainer(container);

    expect(allValues(container)).toEqual([
      "archived",
      "beta",
      "draft",
      "cancelled",
      "alpha",
    ]);
    expect(container.querySelector<HTMLElement>(".suggestion-item[hidden]")).toBeNull();
    expect(container.dataset.propertyOrderValueEnhanced).toBeUndefined();
    expect(testable.originalSuggestions.size).toBe(0);
  });

  it("preserves Obsidian order in native mode and avoids repeated work for one signature", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "native";
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["gamma", "alpha", "beta"]);

    testable.enhanceContainer(container);
    const signature = container.dataset.propertyOrderValueSignature;
    const firstNodes = Array.from(container.children);
    testable.enhanceContainer(container);

    expect(allValues(container)).toEqual(["gamma", "alpha", "beta"]);
    expect(container.dataset.propertyOrderValueSignature).toBe(signature);
    expect(Array.from(container.children)).toEqual(firstNodes);
  });

  it("records frequency only for properties configured to use it", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const frequencyStore = {
      clear: vi.fn(() => true),
      getCounts: vi.fn(() => []),
      increment: vi.fn(() => []),
    } as unknown as PropertyValueFrequencyStore;
    const controller = createController(settings, createApp(), undefined, frequencyStore);
    const testable = asTestable(controller);

    testable.recordConfirmedPropertyValue("status", "draft");
    expect(frequencyStore.increment).not.toHaveBeenCalled();

    settings.valueSuggestionPropertyAssignments = [
      { behavior: "frequency", propertyKey: "status" },
    ];
    testable.recordConfirmedPropertyValue("status", "done");
    expect(frequencyStore.increment).toHaveBeenCalledWith("status", "done");

    settings.valueSuggestionPropertyAssignments = [
      { behavior: "custom", propertyKey: "priority" },
    ];
    settings.valueSuggestionCustomOrders = [
      {
        bottomValues: [],
        middleSortMode: "frequency",
        middleValues: [],
        pinnedValues: [],
        propertyKey: "priority",
      },
    ];
    testable.recordConfirmedPropertyValue("priority", "high");
    expect(frequencyStore.increment).toHaveBeenCalledWith("priority", "high");
  });

  it("uses recent values from the device-local store", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionLegacyMigrationPending = true;
    settings.valueSuggestionSortMode = "recent";
    const store = {
      clear: vi.fn(() => true),
      getValues: vi.fn(() => ["beta"]),
      touch: vi.fn((_propertyKey: string, value: string) => [value, "beta"]),
    } as unknown as RecentPropertyValueStore;
    const controller = createController(settings, createApp(), store);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["gamma", "alpha", "beta"]);

    testable.enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["beta", "alpha", "gamma"]);
    expect(store.getValues).toHaveBeenCalledWith("status");
  });

  it("uses cached frontmatter note counts for usage ordering", () => {
    const one = { path: "one.md" } as TFile;
    const two = { path: "two.md" } as TFile;
    const three = { path: "three.md" } as TFile;
    const app = createApp({
      files: [one, two, three],
      frontmatterByFile: new Map([
        [one, { status: "done" }],
        [two, { status: ["done", "draft"] }],
        [three, { status: "draft" }],
      ]),
    });
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "note-count";
    const controller = createController(settings, app);
    const { container } = createValueMenu(["archived", "draft", "done"]);

    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["done", "draft", "archived"]);
    expect(app.vault.getMarkdownFiles).toHaveBeenCalledOnce();
  });

  it("uses per-property sort overrides instead of the global mode", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "native";
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "name", propertyKey: "status" },
    ];
    const controller = createController(settings);
    const { container } = createValueMenu(["gamma", "alpha", "beta"]);

    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("injects configured preset candidates that are absent from the native popup", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "custom", propertyKey: "status" },
    ];
    settings.valueSuggestionCustomOrders = [
      {
        bottomValues: ["never-bottom"],
        middleSortMode: "name",
        middleValues: [],
        pinnedValues: ["never-top"],
        propertyKey: "status",
      },
    ];
    const controller = createController(settings);
    const { container, editor } = createValueMenu(["draft", "done"]);

    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual([
      "never-top",
      "done",
      "draft",
      "never-bottom",
    ]);
    expect(
      container.querySelectorAll(".property-order-preset-value-item"),
    ).toHaveLength(2);

    const events: string[] = [];
    editor.addEventListener("input", () => events.push("input"));
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") events.push("enter");
    });
    container
      .querySelector<HTMLElement>(".property-order-preset-value-item")
      ?.click();

    expect(events).toEqual(["input", "enter"]);
    controller.dispose();
  });

  it("filters injected preset-only candidates by the active input query", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "custom", propertyKey: "status" },
    ];
    settings.valueSuggestionCustomOrders = [
      {
        bottomValues: ["archived"],
        middleSortMode: "native",
        middleValues: [],
        pinnedValues: ["planned"],
        propertyKey: "status",
      },
    ];
    const controller = createController(settings);
    const { container, editor } = createValueMenu(["planned", "archived"], "status");
    editor.value = "pla";

    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["planned"]);
    controller.dispose();
  });

  it("renders a plugin-owned custom fallback when no native popup exists", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionPropertyAssignments = [
      { behavior: "custom", propertyKey: "status" },
    ];
    settings.valueSuggestionCustomOrders = [
      {
        bottomValues: ["archived"],
        middleSortMode: "native",
        middleValues: [],
        pinnedValues: ["draft"],
        propertyKey: "status",
      },
    ];
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container, editor } = createValueMenu([], "status");
    container.remove();
    editor.focus();

    testable.refreshCustomFallback(document);

    const fallback = document.querySelector<HTMLElement>(
      ".property-order-custom-value-popup",
    );
    expect(fallback).not.toBeNull();
    expect(visibleValues(fallback!)).toEqual(["draft", "archived"]);
    expect(testable.getActiveContainer(document)).toBe(fallback);
    controller.dispose();
    expect(
      document.querySelector(".property-order-custom-value-popup"),
    ).toBeNull();
  });

  it("re-snapshots when Obsidian replaces suggestion items", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["b", "a"]);

    testable.enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["a", "b"]);

    replaceValues(container, ["d", "c"]);
    testable.enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["c", "d"]);
    expect(testable.originalSuggestions.size).toBe(1);
  });

  it("hides duplicate native labels after exact-value de-duplication", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);
    const { container } = createValueMenu(["draft", "draft", "done"]);

    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["draft", "done"]);
    expect(container.querySelectorAll<HTMLElement>(".suggestion-item[hidden]")).toHaveLength(1);
  });

  it("leaves unrelated, hidden, and key-suggestion menus untouched", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const testable = asTestable(controller);

    const unrelated = document.createElement("div");
    unrelated.className = "suggestion-container";
    replaceValues(unrelated, ["b", "a"]);
    document.body.appendChild(unrelated);
    testable.enhanceContainer(unrelated);
    expect(allValues(unrelated)).toEqual(["b", "a"]);

    const valueMenu = createValueMenu(["b", "a"]).container;
    valueMenu.hidden = true;
    testable.enhanceContainer(valueMenu);
    expect(allValues(valueMenu)).toEqual(["b", "a"]);

    valueMenu.remove();
    const keyEditor = document.createElement("input");
    keyEditor.className = "metadata-property-key";
    document.body.appendChild(keyEditor);
    const keyMenu = document.createElement("div");
    keyMenu.className = "suggestion-container mod-property-key";
    replaceValues(keyMenu, ["status", "priority"]);
    document.body.appendChild(keyMenu);
    keyEditor.focus();
    testable.enhanceContainer(keyMenu);
    expect(allValues(keyMenu)).toEqual(["status", "priority"]);
  });

  it("restores a menu when suggestion items do not share one parent", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);
    const { container } = createValueMenu([]);
    const left = document.createElement("div");
    const right = document.createElement("div");
    const leftItem = document.createElement("div");
    const rightItem = document.createElement("div");
    leftItem.className = "suggestion-item";
    rightItem.className = "suggestion-item";
    leftItem.textContent = "a";
    rightItem.textContent = "b";
    left.appendChild(leftItem);
    right.appendChild(rightItem);
    container.append(left, right);

    asTestable(controller).enhanceContainer(container);

    expect(container.dataset.propertyOrderValueEnhanced).toBeUndefined();
  });

  it("enhances through the observer schedule and restores when disabled", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["b", "a"]);

    const dispose = controller.initialize();
    expect(raf.pending()).toBe(1);
    raf.flush();

    expect(visibleValues(container)).toEqual(["a", "b"]);
    expect(testable.activeContainers.get(document)).toBe(container);
    expect(testable.getActiveContainer(document)).toBe(container);

    settings.enableNativeValueSuggestionOrder = false;
    controller.refresh();
    expect(allValues(container)).toEqual(["b", "a"]);
    expect(testable.getActiveContainer(document)).toBeNull();

    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
    expect(testable.documentStates.size).toBe(0);
  });

  it("reschedules active usage ordering after metadata invalidation only while enabled", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "note-count";
    const app = createApp();
    const controller = createController(settings, app);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["a", "b"]);

    controller.initialize();
    raf.flush();
    testable.enhanceContainer(container);
    testable.invalidateUsage();
    expect(raf.pending()).toBe(1);
    raf.flush();

    settings.enableNativeValueSuggestionOrder = false;
    testable.invalidateUsage();
    expect(raf.pending()).toBe(0);
    controller.dispose();
  });

  it("records recent values only when the MRU changes", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const getValues = vi.fn(() => ["draft"]);
    const touch = vi
      .fn()
      .mockReturnValueOnce(["done", "draft"])
      .mockReturnValueOnce(["draft"]);
    const store = {
      clear: vi.fn(() => true),
      getValues,
      touch,
    } as unknown as RecentPropertyValueStore;
    const controller = createController(settings, createApp(), store);
    const testable = asTestable(controller);

    controller.initialize();
    raf.flush();
    testable.recordRecentPropertyValue("status", "done");
    expect(raf.pending()).toBe(1);
    raf.flush();

    testable.recordRecentPropertyValue("status", "draft");
    expect(touch).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it("clears recent value history and refreshes active documents", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const clear = vi.fn(() => false);
    const store = {
      clear,
      getValues: vi.fn(() => []),
      touch: vi.fn(() => []),
    } as unknown as RecentPropertyValueStore;
    const controller = createController(settings, createApp(), store);

    controller.initialize();
    raf.flush();
    expect(controller.clearRecentPropertyValues()).toBe(false);
    expect(clear).toHaveBeenCalledOnce();
    expect(raf.pending()).toBe(1);
    controller.dispose();
  });

  it("registers and explicitly releases workspace and metadata events", () => {
    const settings = createDefaultSettings();
    const workspaceRefs = [{ type: "open" }, { type: "close" }];
    const metadataRefs = [{ type: "changed" }, { type: "deleted" }, { type: "resolved" }];
    const workspaceOffref = vi.fn();
    const metadataOffref = vi.fn();
    const registerEvent = vi.fn();
    const app = createApp();
    vi.mocked(app.workspace.on)
      .mockReturnValueOnce(workspaceRefs[0] as never)
      .mockReturnValueOnce(workspaceRefs[1] as never);
    vi.mocked(app.metadataCache.on)
      .mockReturnValueOnce(metadataRefs[0] as never)
      .mockReturnValueOnce(metadataRefs[1] as never)
      .mockReturnValueOnce(metadataRefs[2] as never);
    Reflect.set(app.workspace, "offref", workspaceOffref);
    Reflect.set(app.metadataCache, "offref", metadataOffref);
    const plugin = { app, registerEvent } as unknown as Plugin;
    const controller = new ValueSuggestionOrderController(plugin, () => settings);

    controller.initialize();
    controller.dispose();

    expect(registerEvent).toHaveBeenCalledTimes(5);
    expect(workspaceOffref).toHaveBeenCalledWith(workspaceRefs[1]);
    expect(workspaceOffref).toHaveBeenCalledWith(workspaceRefs[0]);
    expect(metadataOffref).toHaveBeenCalledWith(metadataRefs[2]);
    expect(metadataOffref).toHaveBeenCalledWith(metadataRefs[1]);
    expect(metadataOffref).toHaveBeenCalledWith(metadataRefs[0]);
  });

  it("registers and unregisters secondary workspace documents", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const callbacks = new Map<string, (...args: never[]) => void>();
    const app = createApp();
    const workspaceOn = vi.fn(
      (name: string, callback: (...args: never[]) => void) => {
        callbacks.set(name, callback);
        return {} as never;
      },
    );
    Reflect.set(app.workspace, "on", workspaceOn);
    const controller = createController(settings, app);
    const testable = asTestable(controller);
    controller.initialize();

    const secondaryWindow = new HappyDomWindow() as unknown as Window;
    callbacks.get("window-open")?.(
      {} as never,
      { document: secondaryWindow.document } as never,
    );
    expect(testable.documentStates.has(secondaryWindow.document)).toBe(true);

    callbacks.get("window-close")?.(
      {} as never,
      { document: secondaryWindow.document } as never,
    );
    expect(testable.documentStates.has(secondaryWindow.document)).toBe(false);
    controller.dispose();
  });

  it("does not schedule the initial enhancement on mobile", () => {
    const raf = installRafHarness();
    Platform.isMobileApp = true;
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);

    controller.initialize();

    expect(raf.pending()).toBe(0);
    controller.dispose();
  });

  it("rolls back document resources when observation setup throws", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    vi.spyOn(window.MutationObserver.prototype, "observe").mockImplementation(() => {
      throw new Error("observer rejected");
    });
    const controller = createController(settings);

    expect(() => controller.initialize()).toThrow("observer rejected");
    expect(removeEventListener).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function),
      true,
    );
    expect(asTestable(controller).documentStates.size).toBe(0);
    expect(() => controller.dispose()).not.toThrow();
  });

  it("cancels a queued frame when refresh disables the feature", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);

    controller.initialize();
    expect(raf.pending()).toBe(1);
    settings.enableNativeValueSuggestionOrder = false;
    controller.refresh();
    expect(raf.pending()).toBe(0);
    controller.dispose();
  });

  it("restores disconnected tracked containers during document enhancement", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    const controller = createController(settings);
    const testable = asTestable(controller);
    const { container } = createValueMenu(["b", "a"]);

    testable.enhanceContainer(container);
    container.remove();
    const enhanceDocument = (
      testable as unknown as { enhanceDocument(targetDocument: Document): void }
    ).enhanceDocument.bind(testable);
    enhanceDocument(document);

    expect(testable.originalSuggestions.size).toBe(0);
  });

  it("leaves action menus untouched even while a property value has focus", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    createValueMenu(["b", "a"]);
    const menu = document.createElement("div");
    menu.className = "menu";
    menu.innerHTML = '<div class="menu-item">Cut</div><div class="menu-item">Copy</div>';
    document.body.appendChild(menu);

    asTestable(controller).enhanceContainer(menu);

    expect(menu.textContent).toBe("CutCopy");
    expect(menu.dataset.propertyOrderValueEnhanced).toBeUndefined();
  });

  it("preserves keyboard selection on an unchanged enhancement", () => {
    installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const { container } = createValueMenu(["b", "a"]);
    controller.initialize();
    asTestable(controller).enhanceContainer(container);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown", bubbles: true, cancelable: true,
    }));
    expect(container.querySelector(".is-selected")?.textContent).toBe("b");

    asTestable(controller).enhanceContainer(container);

    expect(container.querySelector(".is-selected")?.textContent).toBe("b");
    controller.dispose();
  });

  it("recomputes usage ordering after metadata changes without new candidate labels", () => {
    installRafHarness();
    const files = ["one.md", "two.md", "three.md"].map((path) => ({ path }) as TFile);
    const frontmatterByFile = new Map(files.map((file, index) => [
      file, { status: index < 2 ? "a" : "b" },
    ]));
    const app = createApp({ files, frontmatterByFile });
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "note-count";
    const controller = createController(settings, app);
    const { container } = createValueMenu(["a", "b"]);
    controller.initialize();
    asTestable(controller).enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["a", "b"]);

    frontmatterByFile.set(files[0], { status: "b" });
    asTestable(controller).invalidateUsage();
    asTestable(controller).enhanceContainer(container);

    expect(visibleValues(container)).toEqual(["b", "a"]);
    controller.dispose();
  });

  it("restores native ordering after removing a pin or changing sort mode", () => {
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionLegacyMigrationPending = true;
    settings.valueSuggestionSortMode = "name";
    const controller = createController(settings);
    const { container } = createValueMenu(["b", "a"]);
    asTestable(controller).enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["a", "b"]);

    settings.valueSuggestionSortMode = "native";
    asTestable(controller).enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["b", "a"]);
    settings.pinnedPropertyValues = ["status = a"];
    asTestable(controller).enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["a", "b"]);
    settings.pinnedPropertyValues = [];
    asTestable(controller).enhanceContainer(container);
    expect(visibleValues(container)).toEqual(["b", "a"]);
    controller.dispose();
  });

  it("owns a nested suggestion popup once and restores it when disabled", () => {
    const raf = installRafHarness();
    const settings = createDefaultSettings();
    settings.enableNativeValueSuggestionOrder = true;
    settings.valueSuggestionDefaultBehavior = "name";
    const controller = createController(settings);
    const { container } = createValueMenu(["b", "a"]);
    const list = document.createElement("div");
    list.className = "suggestion";
    list.append(...container.childNodes);
    container.appendChild(list);
    controller.initialize();
    raf.flush();
    expect(visibleValues(container)).toEqual(["a", "b"]);
    expect(asTestable(controller).originalSuggestions.size).toBe(1);

    settings.enableNativeValueSuggestionOrder = false;
    controller.refresh();

    expect(visibleValues(container)).toEqual(["b", "a"]);
    controller.dispose();
  });
});
