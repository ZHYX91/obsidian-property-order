import { normalizePropertyKeyIdentity } from "../../core/suggestions/property-names";
import type { CachedMetadata, Editor, Plugin, TFile } from "obsidian";

import { getFrontmatterListPropertyScalars } from "../../core/frontmatter";
import {
  getPropertyValueSuggestionContext,
  getPropertyValueSuggestionItems,
  isPropertyValueSuggestionContainer,
  resolvePropertyValueSuggestionContainer,
  type PropertyValueSuggestionContext,
} from "../../obsidian/native-suggest-dom";
import { resolvePaneFileContext, type PaneFileContext } from "../../obsidian/pane-context";
import { isSuggestionElementVisible } from "../../obsidian/suggestion-visibility";

const MAX_PENDING_USES_PER_DOCUMENT = 10;
const PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS = 5_000;

interface PendingPropertyValueUse {
  beforeCount: number;
  createdAt: number;
  file: TFile;
  propertyKey: string;
  sequence: number;
  source: PaneFileContext;
  value: string;
}

interface PropertyValueSelectionTrackerOptions {
  getEnabled: () => boolean;
  onConfirmed: (propertyKey: string, value: string) => void;
  plugin: Plugin;
}

export class PropertyValueSelectionTracker {
  private readonly documentCleanups = new Map<Document, () => void>();
  private readonly getEnabled: () => boolean;
  private readonly onConfirmed: (propertyKey: string, value: string) => void;
  private readonly pendingByDocument = new Map<Document, PendingPropertyValueUse[]>();
  private readonly plugin: Plugin;
  private nextActivationSequence = 0;

  constructor(options: PropertyValueSelectionTrackerOptions) {
    this.getEnabled = options.getEnabled;
    this.onConfirmed = options.onConfirmed;
    this.plugin = options.plugin;
  }

  registerDocument(targetDocument: Document): () => void {
    const existingCleanup = this.documentCleanups.get(targetDocument);

    if (existingCleanup != null) {
      return existingCleanup;
    }

    const handleMouseDown = (event: MouseEvent): void => {
      if (event.button === 0) {
        this.captureSuggestionActivation(asHtmlElement(event.target));
      }
    };
    targetDocument.addEventListener("mousedown", handleMouseDown, true);

    const cleanup = (): void => {
      targetDocument.removeEventListener("mousedown", handleMouseDown, true);
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
    const confirmed: PendingPropertyValueUse[] = [];
    const claimedOccurrences = new Map<string, Map<string, Set<number>>>();

    for (const [targetDocument, queue] of this.pendingByDocument) {
      const remaining: PendingPropertyValueUse[] = [];

      for (const pending of queue) {
        if (now - pending.createdAt > PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS) {
          continue;
        }

        if (pending.file !== file) {
          remaining.push(pending);
          continue;
        }

        const currentValues = getFrontmatterValues(cache, pending.propertyKey);
        const currentCount = countValue(currentValues, pending.value);

        if (currentCount <= pending.beforeCount) {
          remaining.push(pending);
          continue;
        }

        // All documents observe the same cache change. Each newly present
        // occurrence can confirm only one activation, including across popouts.
        const key = normalizePropertyKeyIdentity(pending.propertyKey);
        const byValue = claimedOccurrences.get(key) ?? new Map<string, Set<number>>();
        claimedOccurrences.set(key, byValue);
        const claimed = byValue.get(pending.value) ?? new Set<number>();
        byValue.set(pending.value, claimed);
        let occurrence = pending.beforeCount + 1;
        while (claimed.has(occurrence)) occurrence += 1;
        if (occurrence <= currentCount) {
          claimed.add(occurrence);
          confirmed.push(pending);
        }
        // A competing intent with no remaining occurrence is consumed too:
        // it must not claim an unrelated addition in a later metadata event.
      }

      this.setPendingQueue(targetDocument, remaining);
    }

    // Clear consumed intents before callbacks and preserve activation order
    // when one cache update confirms selections from interleaved windows.
    for (const pending of confirmed.sort((left, right) => left.sequence - right.sequence)) {
      try {
        this.onConfirmed(pending.propertyKey, pending.value);
      } catch (error) {
        console.error("Property Order: failed to record a recent property value", error);
      }
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

  captureSuggestionActivation(target: HTMLElement | null): void {
    const itemElement = target?.closest<HTMLElement>(".suggestion-item, .menu-item");
    // Native rows may commit on mousedown. Plugin rows commit in their own click handler.
    if (!itemElement || itemElement.dataset.propertyOrderPresetValue === "true" ||
      !isSuggestionElementVisible(itemElement)) return;
    const container = resolvePropertyValueSuggestionContainer(itemElement);
    if (!container || container.dataset.propertyOrderValueEnhanced !== "true" ||
      !isPropertyValueSuggestionContainer(container)) return;
    const context = getPropertyValueSuggestionContext(container);
    const item = getPropertyValueSuggestionItems(container).find(({ element }) => element === itemElement);
    if (context && item) {
      const pending = this.prepareUse(context, item.key);
      if (pending) this.enqueue(pending);
    }
  }

  trackCustomCommit(context: PropertyValueSuggestionContext, value: string, commit: () => boolean): boolean {
    const doc = context.editor.ownerDocument;
    const registration = this.documentCleanups.get(doc);
    let pending: PendingPropertyValueUse | null = null;
    try {
      if (registration) pending = this.prepareUse(context, value);
    } catch (error) {
      console.error("Property Order: failed to capture the preset selection", error);
    }
    const committed = commit();
    if (committed && pending && this.getEnabled() && this.documentCleanups.get(doc) === registration) {
      try {
        this.enqueue(pending);
        // A host commit can synchronously update Metadata Cache before it returns.
        const cache = this.plugin.app.metadataCache.getFileCache(pending.file);
        if (cache && countValue(getFrontmatterValues(cache, pending.propertyKey), value) > pending.beforeCount) {
          this.handleMetadataChanged(pending.file, cache);
        }
      } catch (error) {
        console.error("Property Order: failed to track the committed preset", error);
      }
    }
    return committed;
  }

  private prepareUse(context: PropertyValueSuggestionContext, value: string): PendingPropertyValueUse | null {
    if (!this.getEnabled() || value.length === 0) return null;
    const paneContext = resolvePaneFileContext(this.plugin, context.editor);
    const file = paneContext?.file ?? null;
    const cache = file == null ? null : this.plugin.app.metadataCache.getFileCache(file);

    if (paneContext == null || file == null || cache == null) {
      return null;
    }

    const editorValues = getEditorFrontmatterValues(
      paneContext.editor,
      context.propertyKey,
      cache,
    );
    return {
      // A lagging pane must not make an existing cached value look newly added.
      beforeCount: Math.max(
        countValue(getFrontmatterValues(cache, context.propertyKey), value),
        countValue(editorValues ?? [], value),
      ),
      createdAt: Date.now(),
      file,
      propertyKey: context.propertyKey,
      sequence: this.nextActivationSequence++,
      source: paneContext,
      value,
    };
  }

  private enqueue(pending: PendingPropertyValueUse): void {
    const doc = pending.source.container.ownerDocument;
    const cache = this.plugin.app.metadataCache.getFileCache(pending.file);
    // A second list selection can precede the first Metadata Cache update.
    // Check each earlier intent's own pane; a newly active peer can lag behind
    // that pane. Cancelled, switched-file or unreadable source intents still
    // yield to the next activation. Only Metadata Cache confirms a selection.
    const queue = this.getLivePendingQueue(doc, pending.createdAt).filter(
      (candidate) =>
        candidate.file !== pending.file ||
        !equalPropertyKey(candidate.propertyKey, pending.propertyKey) ||
        (
          cache != null && countValue(getPendingEditorValues(candidate, cache) ?? [], candidate.value) >
            candidate.beforeCount
        ),
    );
    queue.push(pending);
    this.setPendingQueue(
      doc,
      queue.slice(-MAX_PENDING_USES_PER_DOCUMENT),
    );
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

  private getLivePendingQueue(
    targetDocument: Document,
    now: number,
  ): PendingPropertyValueUse[] {
    return (this.pendingByDocument.get(targetDocument) ?? []).filter(
      (pending) =>
        now - pending.createdAt <= PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS,
    );
  }

  private setPendingQueue(
    targetDocument: Document,
    queue: PendingPropertyValueUse[],
  ): void {
    if (queue.length === 0) {
      this.pendingByDocument.delete(targetDocument);
    } else {
      this.pendingByDocument.set(targetDocument, queue);
    }
  }
}

function getPendingEditorValues(
  pending: PendingPropertyValueUse,
  cache: CachedMetadata,
): string[] | null {
  const { source } = pending;
  if (source.view.file !== pending.file || source.view.editor !== source.editor) return null;
  return getEditorFrontmatterValues(source.editor, pending.propertyKey, cache);
}

function getEditorFrontmatterValues(
  editor: Editor,
  propertyKey: string,
  cache: CachedMetadata,
): string[] | null {
  try {
    const content = editor.getValue();
    const cachedKey = Object.keys(cache.frontmatter ?? {}).find(
      (key) => equalPropertyKey(key, propertyKey),
    );
    const scalars = getFrontmatterListPropertyScalars(content, propertyKey, true) ??
      (cachedKey != null && cachedKey !== propertyKey
        ? getFrontmatterListPropertyScalars(content, cachedKey, true)
        : null);
    return scalars?.filter((scalar) => scalar.kind !== "null")
      .map((scalar) => scalar.value) ?? null;
  } catch {
    return null;
  }
}

function equalPropertyKey(left: string, right: string): boolean {
  return normalizePropertyKeyIdentity(left) === normalizePropertyKeyIdentity(right);
}

function getFrontmatterValues(cache: CachedMetadata, propertyKey: string): string[] {
  const frontmatter = cache.frontmatter;

  if (frontmatter == null) {
    return [];
  }

  const normalizedPropertyKey = normalizePropertyKeyIdentity(propertyKey);
  const entry = Object.entries(frontmatter).find(
    ([key]) => normalizePropertyKeyIdentity(key) === normalizedPropertyKey,
  );

  if (entry == null) {
    return [];
  }

  const rawValues = Array.isArray(entry[1]) ? entry[1] : [entry[1]];
  return rawValues
    .filter(
      (value): value is string | number | boolean =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    )
    .map((value) => String(value))
    .filter((value) => value.length > 0);
}

function countValue(values: readonly string[], target: string): number {
  let count = 0;

  for (const value of values) {
    if (value === target) {
      count += 1;
    }
  }

  return count;
}

function asHtmlElement(value: unknown): HTMLElement | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HTMLElement>;
  return candidate.nodeType === 1 && typeof candidate.matches === "function"
    ? (candidate as HTMLElement)
    : null;
}
