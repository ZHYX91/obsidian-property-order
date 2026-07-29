// @vitest-environment happy-dom

import { MarkdownView, type Editor, type Plugin, type TFile } from "obsidian";
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
  view: MarkdownView;
} {
  const file = { path: "Current.md" } as TFile;
  const editor = {
    getValue: () => "",
    offsetToPos: () => ({ line: 0, ch: 0 }),
    transaction: () => undefined,
  } as unknown as Editor;
  const leafContainer = document.createElement("div");
  const view = createMarkdownView(leafContainer, editor, file);
  const leaf = {
    containerEl: leafContainer,
    view,
  };
  const plugin = {
    app: {
      workspace: {
        getMostRecentLeaf: () => leaf,
        iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
      },
    },
  } as unknown as Plugin;

  return { editor, file, leafContainer, plugin, view };
}

function createMarkdownView(
  containerEl: HTMLElement,
  editor: Editor | null,
  file: TFile | null,
  contentEl = containerEl,
): MarkdownView {
  return Object.assign(new MarkdownView({} as never), {
    containerEl,
    contentEl,
    editor,
    file,
  }) as MarkdownView;
}

describe("pane context", () => {
  it("resolves an element contained by a known workspace leaf", () => {
    const { editor, file, leafContainer, plugin, view } = createPlugin();
    const child = document.createElement("div");
    leafContainer.appendChild(child);

    expect(resolvePaneFileContext(plugin, child)).toEqual({
      container: leafContainer,
      editor,
      file,
      view,
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
      view: createMarkdownView(
        leafContainer,
        null,
        { path: "No-editor.md" } as TFile,
      ),
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
      view: createMarkdownView(leafContainer, editor, file, contentContainer),
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
      view: leaf.view,
    });
    expect(resolveFileFromPaneContainer(plugin, contentContainer)).toBe(file);
  });
});
