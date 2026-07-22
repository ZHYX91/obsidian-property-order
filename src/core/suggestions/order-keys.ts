import type { PropertyKeyOrderOptions } from "../../shared/types";
import { comparePropertyNames } from "./property-names";

export interface OrderedPropertyKey {
  key: string;
}

export function orderPropertyKeys(
  keys: string[],
  options: PropertyKeyOrderOptions,
): OrderedPropertyKey[] {
  const normalizedKeys = dedupePreservingOrder(keys.map((key) => key.trim()).filter(Boolean));
  const hiddenMatchers = options.hiddenPatterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map(createWildcardMatcher);
  const visibleKeys = normalizedKeys.filter(
    (key) => !hiddenMatchers.some((matcher) => matcher(key)),
  );
  const visibleKeySet = new Set(visibleKeys);
  const pinnedKeys = expandKeyPatterns(options.pinnedKeys, visibleKeys).filter((key) =>
    visibleKeySet.has(key),
  );
  const pinnedKeySet = new Set(pinnedKeys);
  const bottomKeys = expandKeyPatterns(options.bottomKeys, visibleKeys).filter(
    (key) => visibleKeySet.has(key) && !pinnedKeySet.has(key),
  );
  const reservedKeys = new Set([...pinnedKeys, ...bottomKeys]);
  const middleKeys = visibleKeys.filter((key) => !reservedKeys.has(key));
  const usageByKey = new Map(options.usage.map((item) => [item.key, item.count]));

  middleKeys.sort((left, right) => {
    if (options.sortMode === "usage") {
      const usageDelta = (usageByKey.get(right) ?? 0) - (usageByKey.get(left) ?? 0);

      if (usageDelta !== 0) {
        return usageDelta;
      }
    }

    return comparePropertyNames(left, right);
  });

  return [...pinnedKeys, ...middleKeys, ...bottomKeys].map((key) => ({ key }));
}

function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function expandKeyPatterns(patterns: string[], keys: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();

    if (pattern.length === 0) {
      continue;
    }

    const matchedKeys = keys.filter(createWildcardMatcher(pattern));

    for (const key of matchedKeys) {
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

function createWildcardMatcher(pattern: string): (value: string) => boolean {
  const escapedPattern = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*");
  const matcher = new RegExp(`^${escapedPattern}$`, "i");

  return (value: string) => matcher.test(value);
}
