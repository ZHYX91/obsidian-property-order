import type { App, CachedMetadata, TAbstractFile, TFile } from "obsidian";

import { normalizePropertyKeyIdentity } from "../core/suggestions/property-names";
import type { PropertyKeyUsage, PropertyValueUsage } from "../shared/types";

type UsageChange = { file: TFile; metadata: CachedMetadata | null } | "resolved";
type FileValues = Map<string | TFile, string[]>;
interface UsageSnapshot<T> {
  result: T[];
  files: FileValues;
  incomplete: boolean;
}

const propertyKeyUsageCache = new WeakMap<App, UsageSnapshot<PropertyKeyUsage>>();
const propertyValueUsageCache = new WeakMap<App, Map<string, UsageSnapshot<PropertyValueUsage>>>();
const keyEventBatches = new WeakSet<App>();
const valueEventBatches = new WeakSet<App>();

function fileIdentity(file: TFile): string | TFile {
  return file.path ?? file;
}

function sameFileValues(files: FileValues, file: TFile, next: string[]): boolean {
  const before = files.get(fileIdentity(file)) ?? [];
  return next.length === before.length && next.every((value, i) => value === before[i]);
}

function isDetailedChange(change?: UsageChange): change is Exclude<UsageChange, "resolved"> {
  return change != null && change !== "resolved" && change.file != null &&
    change.metadata !== undefined;
}

/** Renamed folders can move cached descendant paths, even when their own name has no extension. */
export function renameAffectsMarkdownUsage(file: TAbstractFile, oldPath: string): boolean {
  return "children" in file || /\.md$/iu.test(oldPath) || /\.md$/iu.test(file.path);
}

export type CachedFrontmatterStorageKind = "array" | "scalar";

export function getCachedFrontmatterStorageKinds(
  app: App,
  file: TFile,
): ReadonlyMap<string, CachedFrontmatterStorageKind> | null {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  if (frontmatter == null) {
    return null;
  }

  const properties = new Map<string, CachedFrontmatterStorageKind>();

  for (const [key, value] of Object.entries(frontmatter)) {
    properties.set(key, Array.isArray(value) ? "array" : "scalar");
  }

  return properties;
}

function scanPropertyKeyUsage(app: App): UsageSnapshot<PropertyKeyUsage> {
  const files: FileValues = new Map();
  const usageByKey = new Map<string, PropertyKeyUsage>();
  let incomplete = false;
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache == null) incomplete = true;
    if (cache?.frontmatter == null) continue;
    const keys = Object.keys(cache.frontmatter);
    if (keys.length) files.set(fileIdentity(file), keys);
    const seen = new Set<string>();
    for (const key of keys) {
      const identity = normalizePropertyKeyIdentity(key);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const usage = usageByKey.get(identity);
      if (usage == null) usageByKey.set(identity, { key, count: 1 });
      else usage.count += 1;
    }
  }
  return { result: Array.from(usageByKey.values()), files, incomplete };
}

export function getPropertyKeyUsage(app: App): PropertyKeyUsage[] {
  return scanPropertyKeyUsage(app).result;
}

export function getCachedPropertyKeyUsage(app: App): PropertyKeyUsage[] {
  let cached = propertyKeyUsageCache.get(app);
  if (!cached) {
    cached = scanPropertyKeyUsage(app);
    propertyKeyUsageCache.set(app, cached);
  }
  return cached.result;
}

export function invalidatePropertyKeyUsage(app: App, change?: UsageChange): boolean {
  const cached = propertyKeyUsageCache.get(app);
  if (isDetailedChange(change)) {
    keyEventBatches.add(app);
    if (cached && sameFileValues(cached.files, change.file,
      Object.keys(change.metadata?.frontmatter ?? {}))) return false;
  } else {
    const detailed = keyEventBatches.delete(app);
    if (change === "resolved" && detailed && !cached?.incomplete) return false;
  }
  propertyKeyUsageCache.delete(app);
  return true;
}

function valuesForKey(
  metadata: CachedMetadata | null,
  key: string,
  matchingNames: Map<string, boolean>,
): string[] {
  const frontmatter = metadata?.frontmatter;
  if (frontmatter == null) return [];
  const values = new Set<string>();
  for (const name of Object.keys(frontmatter)) {
    let matches = matchingNames.get(name);
    if (matches === undefined) {
      matches = normalizePropertyKeyIdentity(name) === key;
      matchingNames.set(name, matches);
    }
    if (matches) addPrimitiveFrontmatterValues(values, frontmatter[name]);
  }
  return [...values];
}

function scanPropertyValueUsage(app: App, key: string): UsageSnapshot<PropertyValueUsage> {
  const files: FileValues = new Map();
  const counts = new Map<string, number>();
  // Authored spellings repeat across notes. Resolve each once for this scan.
  const matchingNames = new Map<string, boolean>();
  let incomplete = false;
  if (key.length) {
    for (const file of app.vault.getMarkdownFiles()) {
      const cache = app.metadataCache.getFileCache(file);
      if (cache == null) incomplete = true;
      const values = valuesForKey(cache, key, matchingNames);
      if (values.length) files.set(fileIdentity(file), values);
      for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return { files, incomplete, result: Array.from(counts, ([value, count]) => ({ value, count })) };
}

export function getPropertyValueUsage(app: App, propertyKey: string): PropertyValueUsage[] {
  return scanPropertyValueUsage(app, normalizePropertyKeyIdentity(propertyKey)).result;
}

export function getCachedPropertyValueUsage(app: App, propertyKey: string): PropertyValueUsage[] {
  const key = normalizePropertyKeyIdentity(propertyKey);
  let cache = propertyValueUsageCache.get(app);
  if (!cache) {
    cache = new Map();
    propertyValueUsageCache.set(app, cache);
  }
  let snapshot = cache.get(key);
  if (!snapshot) {
    snapshot = scanPropertyValueUsage(app, key);
    cache.set(key, snapshot);
  }
  return snapshot.result;
}

export function getCachedPropertyValueVocabulary(
  app: App,
  propertyKey: string,
): string[] {
  return getCachedPropertyValueUsage(app, propertyKey).map((item) => item.value);
}

export function invalidatePropertyValueUsage(app: App, change?: UsageChange): boolean {
  const cache = propertyValueUsageCache.get(app);
  if (isDetailedChange(change)) {
    valueEventBatches.add(app);
    if (!cache?.size) return true;
    // Project one changed file once, regardless of how many properties users have opened.
    const nextValues = new Map<string, Set<string>>();
    for (const [name, raw] of Object.entries(change.metadata?.frontmatter ?? {})) {
      const key = normalizePropertyKeyIdentity(name);
      if (!cache.has(key)) continue;
      const values = nextValues.get(key) ?? new Set<string>();
      addPrimitiveFrontmatterValues(values, raw);
      nextValues.set(key, values);
    }
    let changed = false;
    for (const [key, snapshot] of cache) {
      if (!sameFileValues(snapshot.files, change.file, [...nextValues.get(key) ?? []])) {
        cache.delete(key);
        changed = true;
      }
    }
    return changed;
  }
  const detailed = valueEventBatches.delete(app);
  if (change === "resolved" && detailed) {
    let changed = false;
    for (const [key, snapshot] of cache ?? []) {
      if (snapshot.incomplete) {
        cache!.delete(key);
        changed = true;
      }
    }
    return changed;
  }
  propertyValueUsageCache.delete(app);
  return true;
}

function addPrimitiveFrontmatterValues(target: Set<string>, value: unknown): void {
  const values = Array.isArray(value) ? value : [value];

  for (const item of values) {
    if (
      typeof item !== "string" &&
      typeof item !== "number" &&
      typeof item !== "boolean"
    ) {
      continue;
    }

    const normalizedValue = String(item);

    if (normalizedValue.length > 0) {
      target.add(normalizedValue);
    }
  }
}
