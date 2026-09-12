// @vitest-environment happy-dom

import { MarkdownView, type CachedMetadata, type Plugin, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecentPropertyValueTracker } from "../../../src/features/value-suggestions/recent-property-value-tracker";

function createValueSuggestion(
  value = "draft",
  propertyKey = "status",
): { container: HTMLElement; editor: HTMLInputElement; item: HTMLElement; row: HTMLElement } {
  const pane = document.createElement("div");
  pane.className = "workspace-leaf-content";
  const row = document.createElement("div");
  row.className = "metadata-property";
  row.dataset.propertyKey = propertyKey;
  const editor = document.createElement("input");
  editor.className = "metadata-property-value";
  row.appendChild(editor);
  pane.appendChild(row);
  document.body.appendChild(pane);

  const container = document.createElement("div");
  container.className = "suggestion-container";
  container.dataset.propertyOrderValueEnhanced = "true";
  const item = document.createElement("div");
  item.className = "suggestion-item";
  const title = document.createElement("div");
  title.className = "suggestion-title";
  title.textContent = value;
  item.appendChild(title);
  container.appendChild(item);
  document.body.appendChild(container);
  editor.focus();
  return { container, editor, item, row };
}

function createPlugin(
  paneElement: HTMLElement,
  file: TFile,
  getCache: () => CachedMetadata | null,
): Plugin {
  const view = Object.create(MarkdownView.prototype) as MarkdownView;
  Object.assign(view, {
    containerEl: paneElement,
    contentEl: paneElement,
    editor: {
      getValue: vi.fn(() => ""),
      offsetToPos: vi.fn(() => ({ ch: 0, line: 0 })),
      transaction: vi.fn(),
    },
    file,
  });
  const leaf = {
    containerEl: paneElement,
    view,
  };

  return {
    app: {
      metadataCache: {
        getFileCache: vi.fn(() => getCache()),
      },
      workspace: {
        iterateAllLeaves: vi.fn((callback: (leaf: unknown) => void) => callback(leaf)),
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
