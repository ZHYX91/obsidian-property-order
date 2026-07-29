import {
  type Editor,
  MarkdownView,
  type Plugin,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";

export interface PaneFileContext {
  container: HTMLElement;
  editor: Editor;
  file: TFile;
  view: MarkdownView;
}

export function resolvePaneFileContext(
  plugin: Plugin,
  element: HTMLElement,
): PaneFileContext | null {
  let result: PaneFileContext | null = null;

  plugin.app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view instanceof MarkdownView ? leaf.view : null;

    if (view == null || view.file == null || !isTransactionEditor(view.editor)) {
      return;
    }

    const containers = getPaneContainers(leaf, view);
    const containingPane = containers.find((container) => container.contains(element));

    if (result != null || containingPane == null) {
      return;
    }

    result = { container: containingPane, editor: view.editor, file: view.file, view };
  });

  if (result != null) {
    return result;
  }

  return null;
}

export function resolveFileFromPaneContainer(
  plugin: Plugin,
  paneContainer: HTMLElement,
): TFile | null {
  let result: TFile | null = null;

  plugin.app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view instanceof MarkdownView ? leaf.view : null;

    if (
      result == null &&
      view?.file != null &&
      getPaneContainers(leaf, view).includes(paneContainer)
    ) {
      result = view.file;
    }
  });

  if (result != null) {
    return result;
  }

  return null;
}

function getPaneContainers(leaf: WorkspaceLeaf, view: MarkdownView): HTMLElement[] {
  const leafContainer = (leaf as unknown as { containerEl?: HTMLElement }).containerEl;
  const candidates = [leafContainer, view.containerEl, view.contentEl];

  return candidates.filter(
    (candidate, index): candidate is HTMLElement =>
      candidate != null && candidates.indexOf(candidate) === index,
  );
}

function isTransactionEditor(editor: Editor | null | undefined): editor is Editor {
  return editor != null &&
    typeof editor.getValue === "function" &&
    typeof editor.offsetToPos === "function" &&
    typeof editor.transaction === "function";
}
