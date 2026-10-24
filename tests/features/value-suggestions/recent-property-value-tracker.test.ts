// @vitest-environment happy-dom

import { MarkdownView, type CachedMetadata, type Plugin, type TFile } from "obsidian";
import { Window as HappyDomWindow } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecentPropertyValueTracker } from "../../../src/features/value-suggestions/recent-property-value-tracker";

const peerWindows: HappyDomWindow[] = [];

function createPeerDocument(): Document {
  const peerWindow = new HappyDomWindow();
  peerWindows.push(peerWindow);
  return peerWindow.document as unknown as Document;
}

function createValueSuggestion(
  value = "draft",
  propertyKey = "status",
  targetDocument = document,
): { container: HTMLElement; editor: HTMLInputElement; item: HTMLElement; row: HTMLElement } {
  const pane = targetDocument.createElement("div");
  pane.className = "workspace-leaf-content";
  const row = targetDocument.createElement("div");
  row.className = "metadata-property";
  row.dataset.propertyKey = propertyKey;
  const editor = targetDocument.createElement("input");
  editor.className = "metadata-property-value";
  row.appendChild(editor);
  pane.appendChild(row);
  targetDocument.body.appendChild(pane);

  const container = targetDocument.createElement("div");
  container.className = "suggestion-container";
  container.dataset.propertyOrderValueEnhanced = "true";
  const item = targetDocument.createElement("div");
  item.className = "suggestion-item";
  const title = targetDocument.createElement("div");
  title.className = "suggestion-title";
  title.textContent = value;
  item.appendChild(title);
  container.appendChild(item);
  targetDocument.body.appendChild(container);
  editor.focus();
  return { container, editor, item, row };
}

function createPlugin(
  paneElement: HTMLElement,
  file: TFile,
  getCache: () => CachedMetadata | null,
  getContent: () => string = () => "",
): Plugin {
  return createMultiPanePlugin(file, getCache, [{ paneElement, getContent }]);
}

function createMultiPanePlugin(
  file: TFile,
  getCache: () => CachedMetadata | null,
  panes: Array<{ paneElement: HTMLElement; getContent: () => string }>,
): Plugin {
  const leaves = panes.map(({ paneElement, getContent }) => ({
    containerEl: paneElement,
    view: Object.assign(Object.create(MarkdownView.prototype) as MarkdownView, {
      containerEl: paneElement,
      contentEl: paneElement,
      editor: {
        getValue: vi.fn(getContent),
        offsetToPos: vi.fn(() => ({ ch: 0, line: 0 })),
        transaction: vi.fn(),
      },
      file,
    }),
  }));

  return {
    app: {
      metadataCache: {
        getFileCache: vi.fn(() => getCache()),
      },
      workspace: {
        iterateAllLeaves: vi.fn((callback: (leaf: unknown) => void) => leaves.forEach(callback)),
      },
    },
  } as unknown as Plugin;
}

describe("RecentPropertyValueTracker", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const peerWindow of peerWindows.splice(0)) {
      peerWindow.close();
    }
  });

  it("confirms a clicked native value only after metadata changes", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const pane = suggestion.row.parentElement as HTMLElement;
    const plugin = createPlugin(pane, file, () => cache);
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });
    tracker.registerDocument(document);

    suggestion.item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(onConfirmed).toHaveBeenCalledWith("status", "draft");
    tracker.dispose();
  });

  it("does not confirm when metadata is unchanged or the selected value is absent", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });
    tracker.captureSuggestionActivation(suggestion.item);

    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: "done" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("does not confirm a candidate that was already present when another value changes", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: ["draft"] } } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: ["draft", "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("requires exact metadata value identity including edge Unicode", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: "draft\u00a0" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("confirms leading and trailing whitespace as exact candidate identity", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion(" draft ");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: " draft " } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).toHaveBeenCalledWith("status", " draft ");
    tracker.dispose();
  });

  it("lets a later activation supersede stale intent for the same property", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const first = createValueSuggestion("draft");
    const second = createValueSuggestion("done");
    const plugin = createPlugin(
      second.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    second.editor.focus();
    tracker.captureSuggestionActivation(first.item);
    tracker.captureSuggestionActivation(second.item);

    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: ["draft", "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledWith("status", "done");
    tracker.dispose();
  });

  it.each([
    ["draft", "done"],
    ["\u00a0draft\u00a0", " done "],
  ])("confirms both committed list selections %j and %j after one cache update", (first, second) => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { Status: [] } } as CachedMetadata;
    let content = "---\nStatus: []\n---\nUnsaved body";
    const suggestion = createValueSuggestion(first, "status");
    const secondItem = suggestion.container.createDiv({ cls: "suggestion-item" });
    secondItem.createDiv({ cls: "suggestion-title", text: second });
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
      () => content,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    content = `---\nStatus: ${JSON.stringify([first])}\n---\nUnsaved body`;
    tracker.captureSuggestionActivation(secondItem);
    content = `---\nStatus: ${JSON.stringify([first, second])}\n---\nUnsaved body`;
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { Status: [first, second] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([["status", first], ["status", second]]);
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it("does not confirm a second selection when the same value was only added once", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    let content = "---\nstatus: []\n---";
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
      () => content,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });

    tracker.captureSuggestionActivation(suggestion.item);
    content = "---\nstatus: [draft]\n---";
    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: ["draft"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([["status", "draft"]]);
    tracker.dispose();
  });

  it.each([
    { values: ["draft", "done", "draft"] },
    { values: ["draft", "draft"] },
  ])("confirms every added occurrence in successive selections: $values", ({ values }) => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    let content = "---\nstatus: []\n---";
    const suggestion = createValueSuggestion("draft");
    const doneItem = suggestion.container.createDiv({ cls: "suggestion-item" });
    doneItem.createDiv({ cls: "suggestion-title", text: "done" });
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
      () => content,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });

    for (const [index, value] of values.entries()) {
      tracker.captureSuggestionActivation(value === "draft" ? suggestion.item : doneItem);
      content = `---\nstatus: ${JSON.stringify(values.slice(0, index + 1))}\n---`;
    }
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: values } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual(values.map((value) => ["status", value]));
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledTimes(values.length);
    tracker.dispose();
  });

  it("does not count an unchanged cached value when the pane source is behind", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: ["draft"] } } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
      () => "---\nstatus: []\n---",
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: ["draft"], other: "changed" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: ["draft", "draft"], other: "changed" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([["status", "draft"]]);
    tracker.dispose();
  });

  it.each([
    "---\nstatus: []\n---",
    "---\nstatus:\n  nested: draft\n---",
    null,
  ])("lets an uncommitted or unreadable earlier intent yield to the next selection: %j", (source) => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const secondItem = suggestion.container.createDiv({ cls: "suggestion-item" });
    secondItem.createDiv({ cls: "suggestion-title", text: "done" });
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
      () => {
        if (source == null) throw new Error("editor is unavailable");
        return source;
      },
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });

    tracker.captureSuggestionActivation(suggestion.item);
    tracker.captureSuggestionActivation(secondItem);
    cache = { frontmatter: { status: ["draft", "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([["status", "done"]]);
    tracker.dispose();
  });

  it.each([1, 2, 3])("shares %i added occurrences across two window queues", (addedCount) => {
    const peerDocument = createPeerDocument();
    const first = createValueSuggestion("draft", "status");
    const second = createValueSuggestion("draft", "Status", peerDocument);
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    const plugin = createMultiPanePlugin(file, () => cache, [first, second].map((suggestion) => ({
      paneElement: suggestion.row.parentElement as HTMLElement,
      getContent: () => "---\nstatus: []\n---",
    })));
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });
    tracker.registerDocument(document);
    const closePeer = tracker.registerDocument(peerDocument);
    tracker.captureSuggestionActivation(first.item);
    tracker.captureSuggestionActivation(second.item);

    cache = { frontmatter: { status: Array<string>(addedCount).fill("draft") } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledTimes(Math.min(addedCount, 2));
    tracker.handleMetadataChanged(file, cache);
    cache = { frontmatter: { status: [...Array<string>(addedCount).fill("draft"), "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledTimes(Math.min(addedCount, 2));
    closePeer();
    tracker.dispose();
  });

  it("retains a committed source selection when a stale peer pane becomes active", () => {
    const first = createValueSuggestion("draft");
    const second = createValueSuggestion("done");
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    let firstContent = "---\nstatus: []\n---";
    const plugin = createMultiPanePlugin(file, () => cache, [
      { paneElement: first.row.parentElement as HTMLElement, getContent: () => firstContent },
      { paneElement: second.row.parentElement as HTMLElement, getContent: () => "---\nstatus: []\n---" },
    ]);
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });
    first.editor.focus();
    tracker.captureSuggestionActivation(first.item);
    firstContent = "---\nstatus: [draft]\n---";
    second.editor.focus();
    tracker.captureSuggestionActivation(second.item);
    expect(onConfirmed).not.toHaveBeenCalled();

    cache = { frontmatter: { status: ["draft", "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([["status", "draft"], ["status", "done"]]);
    tracker.dispose();
  });

  it("keeps activation order across interleaved window queues", () => {
    const peerDocument = createPeerDocument();
    const first = createValueSuggestion("draft");
    const review = first.container.createDiv({ cls: "suggestion-item" });
    review.createDiv({ cls: "suggestion-title", text: "review" });
    const second = createValueSuggestion("done", "status", peerDocument);
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    let firstContent = "---\nstatus: []\n---";
    const plugin = createMultiPanePlugin(file, () => cache, [
      { paneElement: first.row.parentElement as HTMLElement, getContent: () => firstContent },
      { paneElement: second.row.parentElement as HTMLElement, getContent: () => "---\nstatus: []\n---" },
    ]);
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });
    tracker.captureSuggestionActivation(first.item);
    firstContent = "---\nstatus: [draft]\n---";
    tracker.captureSuggestionActivation(second.item);
    tracker.captureSuggestionActivation(review);

    cache = { frontmatter: { status: ["draft", "done", "review"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed.mock.calls).toEqual([
      ["status", "draft"], ["status", "done"], ["status", "review"],
    ]);
    tracker.dispose();
  });

  it("can count a later removal and re-addition after competing intents were consumed", () => {
    const suggestion = createValueSuggestion("draft");
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { status: [] } } as CachedMetadata;
    const plugin = createPlugin(suggestion.row.parentElement as HTMLElement, file, () => cache);
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({ getEnabled: () => true, onConfirmed, plugin });
    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: ["draft"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    cache = { frontmatter: { status: [] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: ["draft"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it("supports list-valued frontmatter and case-insensitive property keys", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: { Status: ["draft"] } } as CachedMetadata;
    const suggestion = createValueSuggestion("done", "status");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { Status: ["draft", "done"] } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).toHaveBeenCalledWith("status", "done");
    tracker.dispose();
  });

  it("ignores candidates without an enhanced active value-suggestion context", () => {
    const file = { path: "note.md" } as TFile;
    const suggestion = createValueSuggestion("draft");
    suggestion.container.dataset.propertyOrderValueEnhanced = "false";
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => ({ frontmatter: {} }) as CachedMetadata,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    tracker.handleMetadataChanged(
      file,
      { frontmatter: { status: "draft" } } as CachedMetadata,
    );

    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("ignores right-clicks and removes document listeners on cleanup", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });
    const cleanup = tracker.registerDocument(document);
    expect(tracker.registerDocument(document)).toBe(cleanup);

    suggestion.item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();

    cleanup();
    cleanup();
    suggestion.item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("clears pending work immediately when the feature becomes disabled", () => {
    const file = { path: "note.md" } as TFile;
    let enabled = true;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => enabled,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    enabled = false;
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);
    expect(onConfirmed).not.toHaveBeenCalled();

    enabled = true;
    tracker.captureSuggestionActivation(suggestion.item);
    enabled = false;
    tracker.captureSuggestionActivation(suggestion.item);
    tracker.clearPending();
    tracker.dispose();
  });

  it("expires stale pending confirmations", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    vi.advanceTimersByTime(5_001);
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("drops pending confirmations for deleted files", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    tracker.handleFileDeleted(file);
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("does not consume pending work for a different file", () => {
    const file = { path: "note.md" } as TFile;
    const otherFile = { path: "other.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const onConfirmed = vi.fn();
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    tracker.handleMetadataChanged(
      otherFile,
      { frontmatter: { status: "draft" } } as CachedMetadata,
    );
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;
    tracker.handleMetadataChanged(file, cache);

    expect(onConfirmed).toHaveBeenCalledOnce();
    tracker.dispose();
  });

  it("contains callback failures and continues processing", () => {
    const file = { path: "note.md" } as TFile;
    let cache = { frontmatter: {} } as CachedMetadata;
    const suggestion = createValueSuggestion("draft");
    const plugin = createPlugin(
      suggestion.row.parentElement as HTMLElement,
      file,
      () => cache,
    );
    const error = new Error("recent store failed");
    const onConfirmed = vi.fn(() => {
      throw error;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tracker = new RecentPropertyValueTracker({
      getEnabled: () => true,
      onConfirmed,
      plugin,
    });

    tracker.captureSuggestionActivation(suggestion.item);
    cache = { frontmatter: { status: "draft" } } as CachedMetadata;

    expect(() => tracker.handleMetadataChanged(file, cache)).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Property Order: failed to record a recent property value",
      error,
    );
    tracker.dispose();
  });
});
