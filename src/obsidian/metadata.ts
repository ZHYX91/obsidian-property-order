import type { App, TFile } from "obsidian";

import type { PropertyKeyUsage, PropertyValueUsage } from "../shared/types";

const FRONTMATTER_CACHE_METADATA_KEYS = new Set(["position"]);
const propertyKeyUsageCache = new WeakMap<App, PropertyKeyUsage[]>();
const propertyValueUsageCache = new WeakMap<App, Map<string, PropertyValueUsage[]>>();

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
    if (FRONTMATTER_CACHE_METADATA_KEYS.has(key)) {
      continue;
    }

    properties.set(key, Array.isArray(value) ? "array" : "scalar");
  }

  return properties;
}

export function getPropertyKeyUsage(app: App): PropertyKeyUsage[] {
  const usageByKey = new Map<string, number>();

  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

    if (frontmatter == null) {
      continue;
    }

    for (const key of Object.keys(frontmatter)) {
      if (FRONTMATTER_CACHE_METADATA_KEYS.has(key)) {
        continue;
      }

      usageByKey.set(key, (usageByKey.get(key) ?? 0) + 1);
    }
  }

  return Array.from(usageByKey, ([key, count]) => ({ key, count }));
}

export function getCachedPropertyKeyUsage(app: App): PropertyKeyUsage[] {
  const cachedUsage = propertyKeyUsageCache.get(app);

  if (cachedUsage != null) {
    return cachedUsage;
  }

  const usage = getPropertyKeyUsage(app);
  propertyKeyUsageCache.set(app, usage);
  return usage;
}

export function invalidatePropertyKeyUsage(app: App): void {
  propertyKeyUsageCache.delete(app);
}

export function getPropertyValueUsage(
  app: App,
  propertyKey: string,
): PropertyValueUsage[] {
  const normalizedPropertyKey = normalizePropertyKey(propertyKey);
  const usageByValue = new Map<string, number>();

  if (normalizedPropertyKey.length === 0) {
    return [];
  }

  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

    if (frontmatter == null) {
      continue;
    }

    const matchingEntry = Object.entries(frontmatter).find(
      ([key]) =>
        !FRONTMATTER_CACHE_METADATA_KEYS.has(key) &&
        normalizePropertyKey(key) === normalizedPropertyKey,
    );

    if (matchingEntry == null) {
      continue;
    }

    for (const value of new Set(getPrimitiveFrontmatterValues(matchingEntry[1]))) {
      usageByValue.set(value, (usageByValue.get(value) ?? 0) + 1);
    }
  }

  return Array.from(usageByValue, ([value, count]) => ({ value, count }));
}

export function getCachedPropertyValueUsage(
  app: App,
  propertyKey: string,
): PropertyValueUsage[] {
  const normalizedPropertyKey = normalizePropertyKey(propertyKey);
  let cache = propertyValueUsageCache.get(app);

  if (cache == null) {
    cache = new Map();
    propertyValueUsageCache.set(app, cache);
  }

  const cachedUsage = cache.get(normalizedPropertyKey);

  if (cachedUsage != null) {
    return cachedUsage;
  }

  const usage = getPropertyValueUsage(app, propertyKey);
  cache.set(normalizedPropertyKey, usage);
  return usage;
}

export function invalidatePropertyValueUsage(app: App): void {
  propertyValueUsageCache.delete(app);
}

function getPrimitiveFrontmatterValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const item of values) {
    if (
      typeof item !== "string" &&
      typeof item !== "number" &&
      typeof item !== "boolean"
    ) {
      continue;
    }

    const normalizedValue = String(item).trim();

    if (normalizedValue.length > 0) {
      result.push(normalizedValue);
    }
  }

  return result;
}

function normalizePropertyKey(propertyKey: string): string {
  return propertyKey.trim().toLocaleLowerCase();
}
