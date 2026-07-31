// @vitest-environment happy-dom

import type { CachedMetadata, Plugin, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecentPropertyKeyTracker } from "../../../src/features/key-order/recent-property-key-tracker";

interface TrackerHarness {
  cleanup(): void;
  editor: HTMLElement;
  file: TFile;
  input: HTMLInputElement;
  item: HTMLElement;
  menu: HTMLElement;
  onConfirmed: ReturnType<typeof vi.fn>;
  setEnabled(enabled: boolean): void;
  setFileCache(cache: CachedMetadata | null): void;
  setResolvedFile(file: TFile): void;
  tracker: RecentPropertyKeyTracker;
}

function createHarness(options: {
  baseline?: CachedMetadata | null;
  onConfirmed?: (key: string) => void;
  portaled?: boolean;
} = {}): TrackerHarness {
  const file = { path: "note.md" } as TFile;
  let enabled = true;
  let resolvedFile = file;
  let fileCache = options.baseline === undefined
    ? ({ frontmatter: { title: "Note" } } as CachedMetadata)
    : options.baseline;
  const onConfirmed = vi.fn(options.onConfirmed);
  const editor = document.createElement("div");
  editor.className = "metadata-property-key";
  const input = document.createElement("input");
  editor.appendChild(input);
  document.body.appendChild(editor);

  const menu = document.createElement("div");
  menu.className = "suggestion-container mod-property-key";
  menu.dataset.propertyOrderEnhanced = "true";
  const item = document.createElement("div");
  item.className = "suggestion-item";
  const title = document.createElement("span");
  title.className = "suggestion-title";
  title.textContent = "status";
  item.appendChild(title);
  menu.appendChild(item);

  const secondItem = document.createElement("div");
  secondItem.className = "suggestion-item";
  secondItem.textContent = "project";
  menu.appendChild(secondItem);

  if (options.portaled) {
    document.body.appendChild(menu);
  } else {
    editor.appendChild(menu);
  }

  const plugin = {
    app: {
      metadataCache: {
        getFileCache: vi.fn(() => fileCache),
      },
    },
  } as unknown as Plugin;
  const tracker = new RecentPropertyKeyTracker({
    getEnabled: () => enabled,
    onConfirmed,
    plugin,
    resolveFile: (element) =>
      element.closest(".metadata-property-key") == null ? null : resolvedFile,
  });
  const cleanup = tracker.registerDocument(document);
  input.focus();

  return {
    cleanup,
    editor,
    file,
    input,
    item,
    menu,
    onConfirmed,
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
    },
    setFileCache(cache) {
      fileCache = cache;
    },
    setResolvedFile(nextFile) {
      resolvedFile = nextFile;
    },
    tracker,
  };
}

function pressSuggestion(item: HTMLElement): void {
  item.dispatchEvent(new MouseEvent("pointerdown", {
    bubbles: true,
    button: 0,
  }));
}

describe("RecentPropertyKeyTracker", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("confirms a pointer intent only after the exact file cache contains the key", () => {
    const harness = createHarness({ portaled: true });
    const samePathDifferentFile = { path: harness.file.path } as TFile;

    pressSuggestion(harness.item);
    harness.menu.remove();
    expect(harness.onConfirmed).not.toHaveBeenCalled();

    harness.tracker.handleMetadataChanged(
      samePathDifferentFile,
      { frontmatter: { status: null } },
    );
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { Status: null } },
    );
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { title: "Changed" } },
    );
    expect(harness.onConfirmed).not.toHaveBeenCalled();

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null, title: "Changed" } },
    );
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledTimes(1);
    expect(harness.onConfirmed).toHaveBeenCalledWith("status");
    harness.cleanup();
  });

  it("records a manually typed key after a successful metadata commit", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "  Project State  ";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { "Project State": null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledWith("Project State");
    harness.cleanup();
  });

  it("does not treat intermediate input as a committed property key", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "sta";
    harness.input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { sta: null } },
    );

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("keeps rapid commits from separate editors in action order", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "alpha";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    const secondEditor = document.createElement("div");
    secondEditor.className = "metadata-property-key";
    const secondInput = document.createElement("input");
    secondInput.value = "beta";
    secondEditor.appendChild(secondInput);
    document.body.appendChild(secondEditor);
    secondInput.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { alpha: null, beta: null } },
    );

    expect(harness.onConfirmed.mock.calls).toEqual([["alpha"], ["beta"]]);
    harness.cleanup();
  });

  it("keeps rapid distinct commits when the host reuses one editor element", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "alpha";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));
    harness.input.value = "beta";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { alpha: null, beta: null } },
    );

    expect(harness.onConfirmed.mock.calls).toEqual([["alpha"], ["beta"]]);
    harness.cleanup();
  });

  it("does not coalesce the same editor and key across files", () => {
    const harness = createHarness({ baseline: {} });
    const secondFile = { path: "second.md" } as TFile;
    harness.input.value = "status";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));
    harness.setResolvedFile(secondFile);
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    harness.tracker.handleMetadataChanged(
      secondFile,
      { frontmatter: { status: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledOnce();
    expect(harness.onConfirmed).toHaveBeenCalledWith("status");
    harness.cleanup();
  });

  it("keeps a suggestion and a following typed commit when the host reuses one editor", () => {
    const harness = createHarness({ baseline: {} });
    pressSuggestion(harness.item);
    harness.input.value = "project";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { project: null, status: null } },
    );

    expect(harness.onConfirmed.mock.calls).toEqual([["status"], ["project"]]);
    harness.cleanup();
  });

  it("records a later focusout commit after an earlier explicit action task", async () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "alpha";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    harness.input.value = "beta";
    harness.input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { alpha: null, beta: null } },
    );

    expect(harness.onConfirmed.mock.calls).toEqual([["alpha"], ["beta"]]);
    harness.cleanup();
  });

  it("confirms the typed fallback when native Tab commits it instead of the candidate", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "custom-status";
    harness.tracker.captureSuggestionActivation(harness.item, true);

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { "custom-status": null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledWith("custom-status");
    harness.cleanup();
  });

  it("uses the exact post-keydown editor value when native Tab commits a stale host index", async () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "sta";
    harness.tracker.captureSuggestionActivation(harness.item, true);
    queueMicrotask(() => {
      harness.input.value = "priority";
    });
    harness.editor.remove();
    await Promise.resolve();
    await Promise.resolve();

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { priority: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledWith("priority");
    harness.cleanup();
  });

  it("does not attribute an unrelated unique cache delta to a canceled Tab", async () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "sta";
    harness.tracker.captureSuggestionActivation(harness.item, true);
    await Promise.resolve();

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { priority: null } },
    );

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("treats one bridged Tab event as one fail-closed action", async () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "custom-status";
    const tab = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    const captureBridgeIntent = (event: KeyboardEvent): void => {
      harness.tracker.captureSuggestionActivation(harness.item, true, event);
    };
    window.addEventListener("keydown", captureBridgeIntent, {
      capture: true,
      once: true,
    });

    harness.input.dispatchEvent(tab);
    await Promise.resolve();
    await Promise.resolve();
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { "custom-status": null, status: null } },
    );

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("still records a manually typed Tab commit without a bridged suggestion", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "project";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Tab",
    }));

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { project: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledWith("project");
    harness.cleanup();
  });

  it("fails closed when multiple Tab alternatives appear in the same cache update", () => {
    const harness = createHarness({ baseline: {} });
    harness.input.value = "custom-status";
    harness.tracker.captureSuggestionActivation(harness.item, true);

    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { "custom-status": null, status: null } },
    );

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("keeps an exact suggestion intent when focusout emits a partial typed value", () => {
    const harness = createHarness();
    harness.input.value = "sta";

    pressSuggestion(harness.item);
    harness.input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null, title: "Note" } },
    );
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { sta: null, status: null, title: "Note" } },
    );

    expect(harness.onConfirmed.mock.calls).toEqual([["status"]]);
    harness.cleanup();
  });

  it("fails closed for disabled, unenhanced, hidden, known-existing, and unknown baselines", () => {
    const disabled = createHarness();
    disabled.setEnabled(false);
    pressSuggestion(disabled.item);
    disabled.tracker.handleMetadataChanged(disabled.file, { frontmatter: { status: null } });
    expect(disabled.onConfirmed).not.toHaveBeenCalled();
    disabled.cleanup();

    document.body.replaceChildren();
    const unenhanced = createHarness();
    delete unenhanced.menu.dataset.propertyOrderEnhanced;
    pressSuggestion(unenhanced.item);
    unenhanced.tracker.handleMetadataChanged(unenhanced.file, { frontmatter: { status: null } });
    expect(unenhanced.onConfirmed).not.toHaveBeenCalled();
    unenhanced.cleanup();

    document.body.replaceChildren();
    const hidden = createHarness();
    hidden.item.hidden = true;
    pressSuggestion(hidden.item);
    hidden.tracker.handleMetadataChanged(hidden.file, { frontmatter: { status: null } });
    expect(hidden.onConfirmed).not.toHaveBeenCalled();
    hidden.cleanup();

    document.body.replaceChildren();
    const existing = createHarness({ baseline: { frontmatter: { status: null } } });
    pressSuggestion(existing.item);
    existing.tracker.handleMetadataChanged(existing.file, { frontmatter: { status: null } });
    expect(existing.onConfirmed).not.toHaveBeenCalled();
    existing.cleanup();

    document.body.replaceChildren();
    const unknown = createHarness({ baseline: null });
    pressSuggestion(unknown.item);
    unknown.tracker.handleMetadataChanged(unknown.file, { frontmatter: { status: null } });
    expect(unknown.onConfirmed).not.toHaveBeenCalled();
    unknown.cleanup();
  });

  it("expires stale intent and clears pending state on file deletion or disposal", () => {
    vi.useFakeTimers();
    const expired = createHarness();
    pressSuggestion(expired.item);
    vi.advanceTimersByTime(5_001);
    expired.tracker.handleMetadataChanged(expired.file, { frontmatter: { status: null } });
    expect(expired.onConfirmed).not.toHaveBeenCalled();
    expired.cleanup();

    document.body.replaceChildren();
    const deleted = createHarness();
    pressSuggestion(deleted.item);
    deleted.tracker.handleFileDeleted(deleted.file);
    deleted.tracker.handleMetadataChanged(deleted.file, { frontmatter: { status: null } });
    expect(deleted.onConfirmed).not.toHaveBeenCalled();
    deleted.cleanup();

    document.body.replaceChildren();
    const disposed = createHarness();
    pressSuggestion(disposed.item);
    disposed.tracker.dispose();
    disposed.tracker.handleMetadataChanged(disposed.file, { frontmatter: { status: null } });
    expect(disposed.onConfirmed).not.toHaveBeenCalled();
  });

  it("drops an armed intent when suggestion enhancement is disabled", () => {
    const harness = createHarness();
    pressSuggestion(harness.item);
    harness.setEnabled(false);
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null } },
    );
    harness.setEnabled(true);
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null } },
    );

    expect(harness.onConfirmed).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("lets a new typed commit replace an expired canceled suggestion intent", () => {
    vi.useFakeTimers();
    const harness = createHarness({ baseline: {} });
    pressSuggestion(harness.item);
    vi.advanceTimersByTime(5_001);
    harness.input.value = "project";
    harness.input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
    }));
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { project: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledWith("project");
    harness.cleanup();
  });

  it("contains callback failures and consumes the confirmed intent", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const harness = createHarness({
      onConfirmed: () => {
        throw new Error("write failed");
      },
    });
    pressSuggestion(harness.item);

    expect(() => harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null } },
    )).not.toThrow();
    harness.tracker.handleMetadataChanged(
      harness.file,
      { frontmatter: { status: null } },
    );

    expect(harness.onConfirmed).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    harness.cleanup();
  });
});
