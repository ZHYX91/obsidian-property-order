import { MarkdownView, type Plugin } from "obsidian";
import { vi } from "vitest";
import { bindPropertyKeySource, releasePropertyKeySource } from "../../src/obsidian/property-key-source";

export function bindTestPropertyKeySource(pane: HTMLElement, getLines: () => string[]): () => void {
  const view = Object.assign(Object.create(MarkdownView.prototype) as MarkdownView, {
    file: { path: "note.md" },
    containerEl: pane,
    editor: {
      getValue: () => getLines().join("\n"),
      getLine: (line: number) => getLines()[line],
      lineCount: () => getLines().length,
      transaction: vi.fn(),
      offsetToPos: vi.fn(),
    },
  });
  const plugin = { app: { workspace: {
    iterateAllLeaves: (visit: (leaf: unknown) => void) => visit({ view, containerEl: pane }),
  } } } as unknown as Plugin;
  bindPropertyKeySource(pane.ownerDocument, plugin);
  return () => releasePropertyKeySource(pane.ownerDocument, plugin);
}
