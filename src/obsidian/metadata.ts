import type { App, TFile } from "obsidian";

import type { FrontmatterScalar } from "../core/frontmatter";
import type { PropertyKeyUsage } from "../shared/types";

const FRONTMATTER_CACHE_METADATA_KEYS = new Set(["position"]);
const propertyKeyUsageCache = new WeakMap<App, PropertyKeyUsage[]>();

export function getCachedFrontmatterListProperties(
  app: App,
  file: TFile,
): ReadonlyMap<string, readonly FrontmatterScalar[]> | null {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  if (frontmatter == null) {
    return null;
  }

  const properties = new Map<string, readonly FrontmatterScalar[]>();

  for (const [key, value] of Object.entries(frontmatter)) {
    if (FRONTMATTER_CACHE_METADATA_KEYS.has(key)) {
      continue;
    }

    const normalizedValues = normalizeCachedListValues(value);

    if (normalizedValues != null) {
      properties.set(key, normalizedValues);
    }
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

function normalizeCachedListValues(value: unknown): FrontmatterScalar[] | null {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedValues: FrontmatterScalar[] = [];

  for (const item of value) {
    if (item == null) {
      normalizedValues.push({ kind: "null", value: "null" });
      continue;
    }

    if (typeof item === "string") {
      normalizedValues.push({ kind: "string", value: item });
      continue;
    }

    if (typeof item === "number") {
      normalizedValues.push({ kind: "number", value: String(item) });
      continue;
    }

    if (typeof item === "boolean") {
      normalizedValues.push({ kind: "boolean", value: String(item) });
      continue;
    }

    return null;
  }

  return normalizedValues;
}
