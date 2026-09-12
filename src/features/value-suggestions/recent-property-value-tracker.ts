import type { CachedMetadata, Plugin, TFile } from "obsidian";

import {
  getPropertyValueSuggestionContext,
  getSuggestionItems,
  isPropertyValueSuggestionContainer,
  resolvePropertyValueSuggestionContainer,
} from "../../obsidian/native-suggest-dom";
import { resolvePaneFileContext } from "../../obsidian/pane-context";
import { isSuggestionElementVisible } from "../key-order/suggestion-visibility";

const MAX_PENDING_USES_PER_DOCUMENT = 10;
const PENDING_CONFIRMATION_MAX_AGE_MILLISECONDS = 5_000;

interface PendingPropertyValueUse {
  beforeValues: readonly string[];
  createdAt: number;
  file: TFile;
  propertyKey: string;
  value: string;
}

interface RecentPropertyValueTrackerOptions {
  getEnabled: () => boolean;
  onConfirmed: (propertyKey: string, value: string) => void;
  plugin: Plugin;
}

export class RecentPropertyValueTracker {
  private readonly documentCleanups = new Map<Document, () => void>();
  private readonly getEnabled: () => boolean;
  private readonly onConfirmed: (propertyKey: string, value: string) => void;
  private readonly pendingByDocument = new Map<Document, PendingPropertyValueUse[]>();
  private readonly plugin: Plugin;

  constructor(options: RecentPropertyValueTrackerOptions) {
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
        const changed = !haveSameValues(pending.beforeValues, currentValues);

        if (!changed || !currentValues.includes(pending.value)) {
          remaining.push(pending);
          continue;
        }

        try {
          this.onConfirmed(pending.propertyKey, pending.value);
        } catch (error) {
          console.error("Property Order: failed to record a recent property value", error);
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

  captureSuggestionActivation(target: HTMLElement | null): void {
    if (!this.getEnabled()) {
      return;
    }

    const itemElement = target?.closest<HTMLElement>(".suggestion-item, .menu-item") ?? null;
    const container =
      itemElement == null ? null : resolvePropertyValueSuggestionContainer(itemElement);

    if (
      itemElement == null ||
      container == null ||
      !isSuggestionElementVisible(itemElement) ||
      container.dataset.propertyOrderValueEnhanced !== "true" ||
      !isPropertyValueSuggestionContainer(container)
    ) {
      return;
    }

    const context = getPropertyValueSuggestionContext(container);
    const item = getSuggestionItems(container).find(({ element }) => element === itemElement);

    if (context == null || item == null) {
      return;
    }

    const paneContext = resolvePaneFileContext(this.plugin, context.editor);
    const file = paneContext?.file ?? null;
    const cache = file == null ? null : this.plugin.app.metadataCache.getFileCache(file);

    if (file == null || cache == null) {
      return;
    }

    const beforeValues = getFrontmatterValues(cache, context.propertyKey);
    const value = item.key.trim();

    if (value.length === 0) {
      return;
    }

    const pending: PendingPropertyValueUse = {
      beforeValues,
      createdAt: Date.now(),
      file,
      propertyKey: context.propertyKey,
      value,
    };
    const queue = this.getLivePendingQueue(itemElement.ownerDocument, pending.createdAt).filter(
      (candidate) =>
        candidate.file !== pending.file ||
        candidate.propertyKey !== pending.propertyKey ||
        candidate.value !== pending.value,
    );
    queue.push(pending);
    this.setPendingQueue(
      itemElement.ownerDocument,
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

function getFrontmatterValues(cache: CachedMetadata, propertyKey: string): string[] {
  const frontmatter = cache.frontmatter;

  if (frontmatter == null) {
    return [];
  }

  const normalizedPropertyKey = propertyKey.trim().toLocaleLowerCase();
  const entry = Object.entries(frontmatter).find(
    ([key]) => key !== "position" && key.trim().toLocaleLowerCase() === normalizedPropertyKey,
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
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function haveSameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
