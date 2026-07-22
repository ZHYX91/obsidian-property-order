// @vitest-environment happy-dom

import type { Plugin, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
}));

import {
  resolveFileFromPaneContainer,
  resolvePaneFileContext,
} from "../../src/obsidian/pane-context";

function createPlugin(): {
  file: TFile;
  leafContainer: HTMLElement;
  plugin: Plugin;
} {
  const file = { path: "Current.md" } as TFile;
  const leafContainer = document.createElement("div");
  const leaf = {
    containerEl: leafContainer,
    view: { containerEl: leafContainer, file },
  };
  const plugin = {
    app: {
      workspace: {
        getMostRecentLeaf: () => leaf,
        iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
      },
    },
  } as unknown as Plugin;

  return { file, leafContainer, plugin };
}

describe("pane context", () => {
  it("resolves an element contained by a known workspace leaf", () => {
    const { file, leafContainer, plugin } = createPlugin();
    const child = document.createElement("div");
    leafContainer.appendChild(child);

    expect(resolvePaneFileContext(plugin, child)).toEqual({
      container: leafContainer,
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

  it("keeps a single-leaf content surface mapped without a recent-leaf fallback", () => {
    const file = { path: "Mobile.md" } as TFile;
    const leafContainer = document.createElement("div");
    const contentContainer = document.createElement("div");
    const child = document.createElement("div");
    contentContainer.appendChild(child);
    const leaf = {
      containerEl: leafContainer,
      view: { containerEl: leafContainer, contentEl: contentContainer, file },
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
      file,
    });
    expect(resolveFileFromPaneContainer(plugin, contentContainer)).toBe(file);
  });
});
