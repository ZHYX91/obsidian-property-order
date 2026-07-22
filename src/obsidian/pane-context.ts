import {
  MarkdownView,
  type Plugin,
  type TFile,
  type View,
  type WorkspaceLeaf,
} from "obsidian";

export interface PaneFileContext {
  container: HTMLElement;
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

    if (file != null) {
      result = { container: containingPane, file };
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
