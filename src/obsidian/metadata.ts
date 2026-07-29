import type { App, TFile } from "obsidian";

import type { PropertyKeyUsage } from "../shared/types";

const FRONTMATTER_CACHE_METADATA_KEYS = new Set(["position"]);
const propertyKeyUsageCache = new WeakMap<App, PropertyKeyUsage[]>();

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
