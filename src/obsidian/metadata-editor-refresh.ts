import { parseYaml, type Editor, type MarkdownView, type TFile } from "obsidian";

import { extractFrontmatterBounds } from "../core/frontmatter/bounds";
import {
  blurFocusedPropertyEditor,
  findPropertyListContextByKey,
} from "./properties-dom";

export type MetadataEditorRefreshResult =
  | "already-aligned"
  | "failed"
  | "reconciled"
  | "stale"
  | "unsupported";

interface MetadataEditorRefreshOptions {
  canRefresh?: () => boolean;
  document: Document;
  editor: Editor;
  expectedContent: string;
  file: TFile;
  isAligned: () => boolean;
  paneContainer: HTMLElement;
  propertyKeys: readonly string[];
  view: MarkdownView;
}

interface MetadataEditorHost {
  metadataEditor?: {
    containerEl?: HTMLElement;
    owner?: {
      getFile?: () => TFile | null;
    };
    synchronize?: (properties: Record<string, unknown>) => void;
  };
}

/**
 * Reconciles a stale native Properties editor after an exact editor commit.
 *
 * `metadataEditor.synchronize` is an undocumented host capability, so this
 * adapter owns every structural and document-identity guard around it. It is
 * deliberately UI-only: it never invokes a native value setter, mutates a
 * pill, writes through the Vault, or changes editor text.
 */
export function reconcileMetadataEditorProperties(
  options: MetadataEditorRefreshOptions,
): MetadataEditorRefreshResult {
  try {
    return reconcileMetadataEditorPropertiesGuarded(options);
  } catch (error) {
    console.warn("Property Order: failed to inspect the native Properties editor", error);
    return "failed";
  }
}

function reconcileMetadataEditorPropertiesGuarded(
  options: MetadataEditorRefreshOptions,
): MetadataEditorRefreshResult {
  if (!isOriginalDocumentCurrent(options)) {
    return "stale";
  }

  if (options.isAligned()) {
    return "already-aligned";
  }

  const frontmatter = extractFrontmatterBounds(options.expectedContent);
  const metadataEditor = (options.view as MarkdownView & MetadataEditorHost).metadataEditor;
  const synchronize = metadataEditor?.synchronize;
  const metadataEditorContainer = metadataEditor?.containerEl;
  const getFile = metadataEditor?.owner?.getFile;

  if (
    frontmatter == null ||
    metadataEditor == null ||
    metadataEditorContainer == null ||
    typeof synchronize !== "function" ||
    typeof getFile !== "function" ||
    metadataEditor.owner !== options.view ||
    getFile.call(metadataEditor.owner) !== options.file ||
    !metadataEditorContainer.isConnected ||
    metadataEditorContainer.ownerDocument !== options.document ||
    !options.paneContainer.contains(metadataEditorContainer)
  ) {
    return "unsupported";
  }

  let properties: unknown;

  try {
    properties = parseYaml(frontmatter.body);
  } catch (error) {
    console.warn("Property Order: failed to parse committed Properties state", error);
    return "failed";
  }

  if (
    !isPropertyRecord(properties) ||
    options.propertyKeys.some(
      (propertyKey) => !Object.prototype.hasOwnProperty.call(properties, propertyKey),
    )
  ) {
    return "failed";
  }

  const affectedPropertyElements = options.propertyKeys
    .map(
      (propertyKey) =>
        findPropertyListContextByKey(options.paneContainer, propertyKey)?.propertyElement ??
        null,
    )
    .filter((propertyElement): propertyElement is HTMLElement => propertyElement != null);

  for (const propertyElement of new Set(affectedPropertyElements)) {
    blurFocusedPropertyEditor(propertyElement);
  }

  const activeElement = options.document.activeElement;

  if (
    activeElement != null &&
    affectedPropertyElements.some((propertyElement) => propertyElement.contains(activeElement))
  ) {
    return "failed";
  }

  if (!isOriginalDocumentCurrent(options)) {
    return "stale";
  }

  try {
    synchronize.call(metadataEditor, properties);
  } catch (error) {
    console.warn("Property Order: failed to reconcile the native Properties editor", error);
    return "failed";
  }

  if (!isOriginalDocumentCurrent(options)) {
    return "stale";
  }

  return options.isAligned() ? "reconciled" : "failed";
}

function isOriginalDocumentCurrent(options: MetadataEditorRefreshOptions): boolean {
  return (
    options.canRefresh?.() !== false &&
    options.view.editor === options.editor &&
    options.view.file === options.file &&
    options.editor.getValue() === options.expectedContent &&
    options.view.containerEl.ownerDocument === options.document &&
    options.paneContainer.isConnected &&
    options.paneContainer.ownerDocument === options.document
  );
}

function isPropertyRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
