import {
  type Editor,
  MarkdownView,
  type Plugin,
  type TFile,
  type View,
  type WorkspaceLeaf,
} from "obsidian";

export interface PaneFileContext {
  container: HTMLElement;
  editor: Editor;
  file: TFile;
}

export function resolvePaneFileContext(
  plugin: Plugin,
  element: HTMLElement,
): PaneFileContext | null {
  let result: PaneFileContext | null = null;

  plugin.app.workspace.iterateAllLeaves((leaf) => {
    const containers = getPaneContainers(leaf);
    const containingPane = containers.find((container) => container.contains(element));

    if (result != null || containingPane == null) {
      return;
    }

    const file = resolveFileFromView(leaf.view);
    const editor = resolveEditorFromView(leaf.view);

    if (file != null && editor != null) {
      result = { container: containingPane, editor, file };
    }
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
    if (result == null && getPaneContainers(leaf).includes(paneContainer)) {
      result = resolveFileFromView(leaf.view);
    }
  });

  if (result != null) {
    return result;
  }

  return null;
}

function getPaneContainers(leaf: WorkspaceLeaf): HTMLElement[] {
  const leafContainer = (leaf as unknown as { containerEl?: HTMLElement }).containerEl;
  const contentContainer = (leaf.view as View & { contentEl?: HTMLElement }).contentEl;
  const candidates = [leafContainer, leaf.view.containerEl, contentContainer];

  return candidates.filter(
    (candidate, index): candidate is HTMLElement =>
      candidate != null && candidates.indexOf(candidate) === index,
  );
}

function resolveFileFromView(view: View): TFile | null {
  if (view instanceof MarkdownView) {
    return view.file;
  }

  return (view as unknown as { file?: TFile | null }).file ?? null;
}

function resolveEditorFromView(view: View): Editor | null {
  if (view instanceof MarkdownView) {
    return view.editor;
  }

  const editor = (view as unknown as { editor?: Editor | null }).editor;

  return editor != null &&
    typeof editor.getValue === "function" &&
    typeof editor.offsetToPos === "function" &&
    typeof editor.transaction === "function"
    ? editor
    : null;
}
