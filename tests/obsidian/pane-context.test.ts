// @vitest-environment happy-dom

import type { Editor, Plugin, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
}));

import {
  resolveFileFromPaneContainer,
  resolvePaneFileContext,
} from "../../src/obsidian/pane-context";

function createPlugin(): {
  editor: Editor;
  file: TFile;
  leafContainer: HTMLElement;
  plugin: Plugin;
} {
  const file = { path: "Current.md" } as TFile;
  const editor = {
    getValue: () => "",
    offsetToPos: () => ({ line: 0, ch: 0 }),
    transaction: () => undefined,
  } as unknown as Editor;
  const leafContainer = document.createElement("div");
  const leaf = {
    containerEl: leafContainer,
    view: { containerEl: leafContainer, editor, file },
  };
  const plugin = {
    app: {
      workspace: {
        getMostRecentLeaf: () => leaf,
        iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
      },
    },
  } as unknown as Plugin;

  return { editor, file, leafContainer, plugin };
}

describe("pane context", () => {
  it("resolves an element contained by a known workspace leaf", () => {
    const { editor, file, leafContainer, plugin } = createPlugin();
    const child = document.createElement("div");
    leafContainer.appendChild(child);

    expect(resolvePaneFileContext(plugin, child)).toEqual({
      container: leafContainer,
      editor,
      file,
    });
    expect(resolveFileFromPaneContainer(plugin, leafContainer)).toBe(file);
  });

  it("does not bind unmatched connected DOM to the most recent leaf", () => {
    const { plugin } = createPlugin();
    const unmatchedPane = document.createElement("div");
    const child = document.createElement("div");
    unmatchedPane.appendChild(child);
    document.body.appendChild(unmatchedPane);

    expect(resolvePaneFileContext(plugin, child)).toBeNull();
    expect(resolveFileFromPaneContainer(plugin, unmatchedPane)).toBeNull();
  });

  it("fails closed when the containing file view has no editor transaction", () => {
    const leafContainer = document.createElement("div");
    const child = document.createElement("div");
    leafContainer.appendChild(child);
    const leaf = {
      containerEl: leafContainer,
      view: {
        containerEl: leafContainer,
        file: { path: "No-editor.md" } as TFile,
      },
    };
    const plugin = {
      app: {
        workspace: {
          iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
        },
      },
    } as unknown as Plugin;

    expect(resolvePaneFileContext(plugin, child)).toBeNull();
  });

  it("keeps a single-leaf content surface mapped without a recent-leaf fallback", () => {
    const file = { path: "Mobile.md" } as TFile;
    const editor = {
      getValue: () => "",
      offsetToPos: () => ({ line: 0, ch: 0 }),
      transaction: () => undefined,
    } as unknown as Editor;
    const leafContainer = document.createElement("div");
    const contentContainer = document.createElement("div");
    const child = document.createElement("div");
    contentContainer.appendChild(child);
    const leaf = {
      containerEl: leafContainer,
      view: { containerEl: leafContainer, contentEl: contentContainer, editor, file },
    };
    const plugin = {
      app: {
        workspace: {
          getMostRecentLeaf: () => leaf,
          iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
        },
      },
    } as unknown as Plugin;

    expect(resolvePaneFileContext(plugin, child)).toEqual({
      container: contentContainer,
      editor,
      file,
    });
    expect(resolveFileFromPaneContainer(plugin, contentContainer)).toBe(file);
  });
});
