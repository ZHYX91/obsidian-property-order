// @vitest-environment happy-dom

import { MarkdownView, type CachedMetadata, type Plugin, type TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import PropertyOrderPlugin from "../../src/app/plugin";
import { RecentPropertyKeyTracker } from "../../src/features/key-order/recent-property-key-tracker";
import { registerSuggestionKeyboardBridge } from "../../src/features/key-order/suggestion-keyboard-bridge";
import { mountCustomValuePopup } from "../../src/features/value-suggestions/custom-value-popup";
import { RecentPropertyValueTracker } from "../../src/features/value-suggestions/recent-property-value-tracker";
import { createDefaultSettings } from "../../src/shared/settings";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.body.className = "";
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function settingsHarness() {
  let stored: unknown = createDefaultSettings();
  const plugin = new (PropertyOrderPlugin as unknown as new () => PropertyOrderPlugin)();
  Object.assign(plugin, { app: { workspace: { iterateAllLeaves: vi.fn() } } });
  const load = vi.spyOn(plugin, "loadData").mockImplementation(async () => stored);
  const save = vi.spyOn(plugin, "saveData").mockImplementation(async (value: unknown) => { stored = value; });
  await plugin.loadSettings();
  cleanups.push(() => plugin.onunload());
  return { plugin, load, save, stored: () => stored, setStored: (value: unknown) => { stored = value; } };
}

describe("settings snapshots behind an external read", () => {
  it("retains external fields when only the local language changes", async () => {
    const test = await settingsHarness();
    const reading = deferred<void>();
    const externalRead = deferred<unknown>();
    test.load.mockImplementationOnce(() => { reading.resolve(); return externalRead.promise; });
    const external = test.plugin.onExternalSettingsChange();
    await reading.promise;
    test.plugin.propertyOrderSettings.language = "zh-CN";
    const saving = test.plugin.saveSettings();
    const incoming = { ...createDefaultSettings(), enablePropertyValueDrag: false, pinnedPropertyKeys: ["external"], foreign: "preserve" };
    test.setStored(incoming);
    externalRead.resolve(incoming);
    await Promise.all([external, saving]);
    expect(test.stored()).toMatchObject({ language: "zh-CN", enablePropertyValueDrag: false, pinnedPropertyKeys: ["external"], foreign: "preserve" });
    expect(test.plugin.propertyOrderSettings).toMatchObject({ language: "zh-CN", enablePropertyValueDrag: false, pinnedPropertyKeys: ["external"] });
  });

  it("does not resurrect an older external reload after a newer disk revision", async () => {
    const test = await settingsHarness();
    const reading = deferred<void>();
    const externalRead = deferred<unknown>();
    test.load.mockImplementationOnce(() => { reading.resolve(); return externalRead.promise; });
    const external = test.plugin.onExternalSettingsChange();
    await reading.promise;
    test.plugin.propertyOrderSettings.language = "zh-CN";
    const saving = test.plugin.saveSettings();
    test.setStored({ ...createDefaultSettings(), enablePropertyValueDrag: true, pinnedPropertyKeys: ["latest"] });
    externalRead.resolve({ ...createDefaultSettings(), enablePropertyValueDrag: false, pinnedPropertyKeys: ["older"] });
    await Promise.all([external, saving]);
    expect(test.stored()).toMatchObject({ language: "zh-CN", enablePropertyValueDrag: true, pinnedPropertyKeys: ["latest"] });
    expect(test.plugin.propertyOrderSettings).toMatchObject({ enablePropertyValueDrag: true, pinnedPropertyKeys: ["latest"] });
    test.plugin.propertyOrderSettings.language = "ja";
    await test.plugin.saveSettings();
    expect(test.stored()).toMatchObject({ language: "ja", enablePropertyValueDrag: true, pinnedPropertyKeys: ["latest"] });
  });

  it("preserves a later local change while the preceding save is reading", async () => {
    const test = await settingsHarness();
    const reading = deferred<void>();
    const saveRead = deferred<unknown>();
    test.load.mockImplementationOnce(() => { reading.resolve(); return saveRead.promise; });
    test.plugin.propertyOrderSettings.language = "zh-CN";
    const first = test.plugin.saveSettings();
    await reading.promise;
    test.plugin.propertyOrderSettings.language = "ja";
    const second = test.plugin.saveSettings();
    saveRead.resolve(test.stored());
    await Promise.all([first, second]);
    expect(test.stored()).toMatchObject({ language: "ja" });
    expect(test.plugin.propertyOrderSettings.language).toBe("ja");
  });
});

function valueHarness() {
  const file = { path: "note.md" } as TFile;
  let cache = { frontmatter: { status: ["open"] } } as CachedMetadata;
  let content = "---\nstatus: [open]\n---";
  const pane = document.createElement("div");
  pane.className = "workspace-leaf-content";
  const row = document.createElement("div");
  row.className = "metadata-property";
  row.dataset.propertyKey = "status";
  const editor = document.createElement("input");
  editor.className = "metadata-property-value";
  row.append(editor); pane.append(row); document.body.append(pane); editor.focus();
  const view = Object.assign(Object.create(MarkdownView.prototype) as MarkdownView, {
    containerEl: pane, contentEl: pane, file,
    editor: { getValue: () => content, offsetToPos: () => ({ line: 0, ch: 0 }), transaction: vi.fn() },
  });
  const plugin = { app: { metadataCache: { getFileCache: () => cache },
    workspace: { iterateAllLeaves: (callback: (leaf: unknown) => void) => callback({ containerEl: pane, view }) },
  } } as unknown as Plugin;
  const onConfirmed = vi.fn();
  const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });
  tracker.registerDocument(document);
  cleanups.push(() => tracker.dispose());
  const onCommit = vi.fn(() => { content = "---\nstatus: [open, draft]\n---"; });
  const mount = mountCustomValuePopup({ editor, row, propertyKey: "status" }, ["draft"], onCommit)!;
  cleanups.push(() => mount.cleanup());
  const item = mount.container.querySelector<HTMLElement>(".suggestion-item")!;
  const updateCache = () => {
    cache = { frontmatter: { status: ["open", "draft"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
  };
  return { editor, file, item, mount, onCommit, onConfirmed, tracker, updateCache };
}

function press(item: HTMLElement): void {
  item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
}

describe("fallback value selection versus a cancelled press", () => {
  it("does not count a cancelled press followed by an unrelated same-value write", () => {
    const test = valueHarness();
    press(test.item);
    document.body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    test.editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    test.mount.cleanup();
    test.updateCache();
    expect(test.onCommit).not.toHaveBeenCalled();
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it("does not confirm metadata arriving before a fallback press becomes a click", () => {
    const test = valueHarness();
    press(test.item);
    test.updateCache();
    expect(test.onCommit).not.toHaveBeenCalled();
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it("keeps a real click pending through popup removal and focus loss", () => {
    const test = valueHarness();
    press(test.item); test.item.click();
    expect(test.onCommit).toHaveBeenCalledOnce();
    expect(test.onConfirmed).not.toHaveBeenCalled();
    test.mount.cleanup(); test.editor.blur();
    test.updateCache(); test.updateCache();
    expect(test.onConfirmed.mock.calls).toEqual([["status", "draft"]]);
  });

  it.each(["Enter", "Tab"])("counts an actual %s bridge activation exactly once", (key) => {
    const test = valueHarness();
    cleanups.push(registerSuggestionKeyboardBridge({
      getActiveContainer: () => test.mount.container,
      getSuggestionElements: (container) => [...container.querySelectorAll<HTMLElement>(".suggestion-item")],
      hasActiveContext: () => true,
      onActivationIntent: (element) => test.tracker.captureSuggestionActivation(element),
      onSynchronizationFailure: () => { throw new Error("Unexpected bridge failure"); },
      supportsEmacsNavigation: false,
      targetWindow: window,
    }));
    test.editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
    expect(test.onCommit).toHaveBeenCalledOnce();
    expect(test.onConfirmed).not.toHaveBeenCalled();
    test.updateCache(); test.updateCache();
    expect(test.onConfirmed.mock.calls).toEqual([["status", "draft"]]);
  });

  it("does not count fallback keyboard intent without the ensuing activation", () => {
    const test = valueHarness();
    test.tracker.captureSuggestionActivation(test.item);
    test.mount.cleanup(); test.updateCache();
    expect(test.onCommit).not.toHaveBeenCalled();
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it("does not count a right-button press", () => {
    const test = valueHarness();
    test.item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    test.updateCache();
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });
});

function keyHarness(onConfirmed: (key: string) => void) {
  const file = { path: "note.md" } as TFile;
  const plugin = { app: { metadataCache: { getFileCache: () => ({ frontmatter: {} }) } } } as unknown as Plugin;
  const tracker = new RecentPropertyKeyTracker({ getEnabled: () => true, plugin, onConfirmed, resolveFile: () => file });
  cleanups.push(() => tracker.dispose());
  const otherDocument = document.implementation.createHTMLDocument("second window");
  const inputs = [document, otherDocument].map((owner) => {
    tracker.registerDocument(owner);
    const editor = owner.createElement("div"); editor.className = "metadata-property-key";
    const input = owner.createElement("input"); editor.append(input); owner.body.append(editor);
    return input;
  });
  const activate = (windowIndex: number, key: string) => {
    const input = inputs[windowIndex]!; input.value = key;
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  };
  return { activate, file, tracker };
}

describe("cross-document property-key confirmation order", () => {
  it("preserves A-alpha, B-beta, A-gamma order even in the same millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(100);
    const confirmed = vi.fn(); const test = keyHarness(confirmed);
    test.activate(0, "alpha"); test.activate(1, "beta"); test.activate(0, "gamma");
    test.tracker.handleMetadataChanged(test.file, { frontmatter: { alpha: null, beta: null, gamma: null } });
    expect(confirmed.mock.calls).toEqual([["alpha"], ["beta"], ["gamma"]]);
  });

  it("consumes all confirmed intents before callbacks can reenter", () => {
    let reentered = false;
    const cache = { frontmatter: { alpha: null, beta: null, gamma: null } };
    const confirmed = vi.fn(() => {
      if (!reentered) { reentered = true; test.tracker.handleMetadataChanged(test.file, cache); }
    });
    const test = keyHarness(confirmed);
    test.activate(0, "alpha"); test.activate(1, "beta"); test.activate(0, "gamma");
    test.tracker.handleMetadataChanged(test.file, cache);
    expect(confirmed.mock.calls).toEqual([["alpha"], ["beta"], ["gamma"]]);
  });

  it("gives a repeated intent its latest position across documents", () => {
    const confirmed = vi.fn(); const test = keyHarness(confirmed);
    test.activate(0, "alpha"); test.activate(1, "beta"); test.activate(0, "alpha");
    test.tracker.handleMetadataChanged(test.file, { frontmatter: { alpha: null, beta: null } });
    expect(confirmed.mock.calls).toEqual([["beta"], ["alpha"]]);
  });
});
