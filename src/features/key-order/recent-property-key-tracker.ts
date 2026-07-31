import type { CachedMetadata, Plugin, TFile } from "obsidian";

import {
  getSuggestionItems,
  isPropertyKeySuggestionContainer,
  resolveSuggestionContainer,
} from "../../obsidian/native-suggest-dom";
import { resolvePaneFileContext } from "../../obsidian/pane-context";
import { isSuggestionElementVisible } from "./suggestion-visibility";

const FRONTMATTER_CACHE_METADATA_KEYS = new Set(["position"]);
const MAX_PENDING_USES_PER_DOCUMENT = 10;
const PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS = 5_000;

interface PendingPropertyKeyUse {
  beforeKeys: ReadonlySet<string>;
  createdAt: number;
  editorId: number;
  file: TFile;
  keys: readonly string[];
  source: "suggestion" | "tab" | "typed-explicit" | "typed-passive";
}

interface RecentPropertyKeyTrackerOptions {
  getEnabled: () => boolean;
  onConfirmed: (key: string) => void;
  plugin: Plugin;
  resolveFile?: (element: HTMLElement) => TFile | null;
}

export class RecentPropertyKeyTracker {
  private readonly capturedTabEvents = new WeakSet<KeyboardEvent>();
  private readonly documentCleanups = new Map<Document, () => void>();
  private readonly editorIds = new WeakMap<HTMLElement, number>();
  private readonly getEnabled: () => boolean;
  private readonly onConfirmed: (key: string) => void;
  private readonly passiveCompanionTokens = new WeakMap<HTMLElement, object>();
  private readonly pendingByDocument = new Map<Document, PendingPropertyKeyUse[]>();
  private readonly plugin: Plugin;
  private readonly resolveFile: (element: HTMLElement) => TFile | null;
  private nextEditorId = 1;

  constructor(options: RecentPropertyKeyTrackerOptions) {
    this.getEnabled = options.getEnabled;
    this.onConfirmed = options.onConfirmed;
    this.plugin = options.plugin;
    this.resolveFile = options.resolveFile ?? ((element) =>
      resolvePaneFileContext(this.plugin, element)?.file ?? null);
  }

  registerDocument(targetDocument: Document): () => void {
    const existingCleanup = this.documentCleanups.get(targetDocument);

    if (existingCleanup != null) {
      return existingCleanup;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button === 0) {
        this.captureSuggestionIntent(asHtmlElement(event.target));
      }
    };
    const handlePossibleCommit = (event: Event): void => {
      this.captureTypedIntent(event, "typed-passive");
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.isComposing && (event.key === "Enter" || event.key === "Tab")) {
        if (event.key === "Tab" && this.capturedTabEvents.has(event)) {
          return;
        }

        this.captureTypedIntent(event, "typed-explicit");
      }
    };
    const handleFocusOut = (event: FocusEvent): void => {
      this.captureTypedIntent(event, "typed-passive");
    };

    targetDocument.addEventListener("change", handlePossibleCommit, true);
    targetDocument.addEventListener("focusout", handleFocusOut, true);
    targetDocument.addEventListener("keydown", handleKeyDown, true);
    targetDocument.addEventListener("pointerdown", handlePointerDown, true);

    const cleanup = (): void => {
      targetDocument.removeEventListener("change", handlePossibleCommit, true);
      targetDocument.removeEventListener("focusout", handleFocusOut, true);
      targetDocument.removeEventListener("keydown", handleKeyDown, true);
      targetDocument.removeEventListener("pointerdown", handlePointerDown, true);
      this.documentCleanups.delete(targetDocument);

      this.pendingByDocument.delete(targetDocument);
    };

    this.documentCleanups.set(targetDocument, cleanup);
    return cleanup;
  }

  handleMetadataChanged(file: TFile, cache: CachedMetadata): void {
    if (!this.getEnabled()) {
      this.pendingByDocument.clear();
      return;
    }

    const now = Date.now();
    const currentKeys = getFrontmatterKeys(cache);

    for (const [targetDocument, queue] of this.pendingByDocument) {
      const remaining: PendingPropertyKeyUse[] = [];

      for (const pending of queue) {
        if (now - pending.createdAt > PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS) {
          continue;
        }

        if (pending.file !== file) {
          remaining.push(pending);
          continue;
        }

        const addedKeys = currentKeys == null
          ? []
          : Array.from(currentKeys).filter((key) => !pending.beforeKeys.has(key));
        const intendedMatches = addedKeys.filter((key) => pending.keys.includes(key));
        const confirmedKey = intendedMatches.length === 1
          ? intendedMatches[0]
          : null;

        if (confirmedKey == null) {
          remaining.push(pending);
          continue;
        }

        try {
          this.onConfirmed(confirmedKey);
        } catch (error) {
          console.error("Property Order: failed to record a recent property key", error);
        }
      }

      this.setPendingQueue(targetDocument, remaining);
    }
  }

  handleFileDeleted(file: TFile): void {
    for (const [targetDocument, queue] of this.pendingByDocument) {
      this.setPendingQueue(
        targetDocument,
        queue.filter((pending) => pending.file !== file),
      );
    }
  }

  captureSuggestionActivation(
    itemElement: HTMLElement,
    includeTypedFallback = false,
    activationEvent?: KeyboardEvent,
  ): void {
    const pending = this.captureSuggestionIntent(itemElement, includeTypedFallback);

    if (
      includeTypedFallback &&
      pending != null &&
      activationEvent?.key === "Tab"
    ) {
      this.capturedTabEvents.add(activationEvent);
    }
  }

  clearPending(): void {
    this.pendingByDocument.clear();
  }

  dispose(): void {
    for (const cleanup of Array.from(this.documentCleanups.values()).reverse()) {
      cleanup();
    }

    this.pendingByDocument.clear();
  }

  private captureSuggestionIntent(
    target: HTMLElement | null,
    includeTypedFallback = false,
  ): PendingPropertyKeyUse | null {
    if (!this.getEnabled()) {
      return null;
    }

    const itemElement = target?.closest<HTMLElement>(".suggestion-item, .menu-item") ?? null;
    const container = itemElement == null ? null : resolveSuggestionContainer(itemElement);

    if (
      itemElement == null ||
      container == null ||
      !isSuggestionElementVisible(itemElement) ||
      container.dataset.propertyOrderEnhanced !== "true" ||
      !isPropertyKeySuggestionContainer(container)
    ) {
      return null;
    }

    const item = getSuggestionItems(container).find(({ element }) => element === itemElement);
    const activeElement = asHtmlElement(container.ownerDocument.activeElement);
    const editor = container.closest<HTMLElement>(".metadata-property-key") ??
      getPropertyKeyEditor(activeElement);

    if (item == null || editor == null) {
      return null;
    }

    const rawKeys = [item.key];
    let typedKeyBeforeDispatch: string | null = null;

    if (includeTypedFallback) {
      typedKeyBeforeDispatch = getPropertyKeyEditorValue(
        editor,
        activeElement ?? editor,
      )?.trim() ?? null;

      if (typedKeyBeforeDispatch != null && typedKeyBeforeDispatch.length > 0) {
        rawKeys.push(typedKeyBeforeDispatch);
      }
    }

    const pending = this.captureIntent(
      editor,
      rawKeys,
      includeTypedFallback ? "tab" : "suggestion",
    );

    if (includeTypedFallback && pending != null) {
      queueMicrotask(() => {
        queueMicrotask(() => {
          this.capturePostTabEditorValue(
            editor,
            pending,
            typedKeyBeforeDispatch,
          );
        });
      });
    }

    return pending;
  }

  private captureTypedIntent(
    event: Event,
    source: "typed-explicit" | "typed-passive",
  ): void {
    if (!this.getEnabled()) {
      return;
    }

    const target = asHtmlElement(event.target);
    const editor = getPropertyKeyEditor(target);

    if (target == null || editor == null) {
      return;
    }

    if ("isComposing" in event && event.isComposing === true) {
      return;
    }

    const key = getPropertyKeyEditorValue(editor, target);

    if (key != null) {
      this.captureIntent(editor, [key], source);
    }
  }

  private captureIntent(
    editor: HTMLElement,
    rawKeys: readonly string[],
    source: PendingPropertyKeyUse["source"],
  ): PendingPropertyKeyUse | null {
    const file = this.resolveFile(editor);
    const beforeKeys = file == null
      ? null
      : getFrontmatterKeys(this.plugin.app.metadataCache.getFileCache(file));

    if (file == null || beforeKeys == null) {
      return null;
    }

    const keys = Array.from(new Set(rawKeys.map((key) => key.trim())))
      .filter((key) => key.length > 0 && !beforeKeys.has(key));

    if (keys.length === 0) {
      return null;
    }

    if (
      source === "typed-passive" &&
      this.passiveCompanionTokens.has(editor)
    ) {
      return null;
    }

    if (source !== "typed-passive") {
      this.markPassiveCompanionTask(editor);
    }

    const pending: PendingPropertyKeyUse = {
      beforeKeys,
      createdAt: Date.now(),
      editorId: this.getEditorId(editor),
      file,
      keys,
      source,
    };
    const queue = this.getLivePendingQueue(editor.ownerDocument, pending.createdAt);
    const related = findLastPending(
      queue,
      (candidate) =>
        candidate.editorId === pending.editorId && candidate.file === pending.file,
    );

    if (
      related?.source === pending.source &&
      haveSameKeys(related.keys, pending.keys)
    ) {
      related.createdAt = pending.createdAt;
      this.setPendingQueue(
        editor.ownerDocument,
        queue.slice(-MAX_PENDING_USES_PER_DOCUMENT),
      );
      return related;
    } else {
      queue.push(pending);
    }

    this.setPendingQueue(
      editor.ownerDocument,
      queue.slice(-MAX_PENDING_USES_PER_DOCUMENT),
    );
    return pending;
  }

  private markPassiveCompanionTask(editor: HTMLElement): void {
    const token = {};
    this.passiveCompanionTokens.set(editor, token);
    const targetWindow = editor.ownerDocument.defaultView;
    const schedule = targetWindow?.setTimeout.bind(targetWindow) ?? setTimeout;

    schedule(() => {
      if (this.passiveCompanionTokens.get(editor) === token) {
        this.passiveCompanionTokens.delete(editor);
      }
    }, 0);
  }

  private capturePostTabEditorValue(
    editor: HTMLElement,
    pending: PendingPropertyKeyUse,
    typedKeyBeforeDispatch: string | null,
  ): void {
    if (!this.getEnabled() || pending.source !== "tab") {
      return;
    }

    const now = Date.now();
    const targetDocument = editor.ownerDocument;
    const queue = this.getLivePendingQueue(targetDocument, now);

    if (!queue.includes(pending)) {
      this.setPendingQueue(targetDocument, queue);
      return;
    }

    if (editor.isConnected && this.resolveFile(editor) !== pending.file) {
      this.setPendingQueue(
        targetDocument,
        queue.filter((candidate) => candidate !== pending),
      );
      return;
    }

    const key = getPropertyKeyEditorValue(editor, editor)?.trim() ?? "";

    if (
      key.length > 0 &&
      !pending.beforeKeys.has(key) &&
      key !== typedKeyBeforeDispatch
    ) {
      pending.keys = [key];
    }

    this.setPendingQueue(targetDocument, queue);
  }

  private getLivePendingQueue(
    targetDocument: Document,
    now: number,
  ): PendingPropertyKeyUse[] {
    return (this.pendingByDocument.get(targetDocument) ?? []).filter(
      (pending) =>
        now - pending.createdAt <= PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS,
    );
  }

  private getEditorId(editor: HTMLElement): number {
    const existingId = this.editorIds.get(editor);

    if (existingId != null) {
      return existingId;
    }

    const editorId = this.nextEditorId;
    this.nextEditorId += 1;
    this.editorIds.set(editor, editorId);
    return editorId;
  }

  private setPendingQueue(
    targetDocument: Document,
    queue: PendingPropertyKeyUse[],
  ): void {
    if (queue.length === 0) {
      this.pendingByDocument.delete(targetDocument);
    } else {
      this.pendingByDocument.set(targetDocument, queue);
    }
  }
}

function haveSameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function findLastPending(
  queue: readonly PendingPropertyKeyUse[],
  predicate: (pending: PendingPropertyKeyUse) => boolean,
): PendingPropertyKeyUse | null {
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const pending = queue[index];

    if (pending != null && predicate(pending)) {
      return pending;
    }
  }

  return null;
}

function getFrontmatterKeys(cache: CachedMetadata | null): ReadonlySet<string> | null {
  if (cache?.frontmatter == null) {
    return cache == null ? null : new Set();
  }

  return new Set(
    Object.keys(cache.frontmatter).filter((key) => !FRONTMATTER_CACHE_METADATA_KEYS.has(key)),
  );
}

function getPropertyKeyEditor(element: HTMLElement | null): HTMLElement | null {
  return element?.closest<HTMLElement>(".metadata-property-key") ?? null;
}

function getPropertyKeyEditorValue(
  editor: HTMLElement,
  eventTarget: HTMLElement,
): string | null {
  const input = eventTarget.matches("input, textarea")
    ? eventTarget
    : editor.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

  if (input != null) {
    return (input as HTMLInputElement | HTMLTextAreaElement).value;
  }

  const metadataInput = eventTarget.closest<HTMLElement>(".metadata-input") ??
    editor.querySelector<HTMLElement>(".metadata-input, [contenteditable='true']");
  return metadataInput?.textContent ?? null;
}

function asHtmlElement(value: unknown): HTMLElement | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HTMLElement>;
  return candidate.nodeType === 1 && typeof candidate.closest === "function"
    ? (candidate as HTMLElement)
    : null;
}
