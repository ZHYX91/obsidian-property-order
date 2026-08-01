import type { PropertyKeyOrderOptions } from "../../shared/types";
import { comparePropertyNames } from "./property-names";

export interface OrderedPropertyKey {
  key: string;
}

export type PropertyKeyRulePlacement = "bottom" | "hidden" | "normal" | "pinned";

export interface PropertyKeyRuleExplanation {
  bottomPattern: string | null;
  hiddenPattern: string | null;
  key: string;
  pinnedPattern: string | null;
  placement: PropertyKeyRulePlacement;
}

type PropertyKeyRules = Pick<
  PropertyKeyOrderOptions,
  "bottomKeys" | "hiddenPatterns" | "pinnedKeys"
>;

export function explainPropertyKeyRules(
  rawKey: string,
  rules: PropertyKeyRules,
): PropertyKeyRuleExplanation {
  const key = rawKey.trim();
  const hiddenPattern = findMatchingPattern(rules.hiddenPatterns, key);
  const pinnedPattern = findMatchingPattern(rules.pinnedKeys, key);
  const bottomPattern = findMatchingPattern(rules.bottomKeys, key);
  const placement = hiddenPattern != null
    ? "hidden"
    : pinnedPattern != null
      ? "pinned"
      : bottomPattern != null
        ? "bottom"
        : "normal";

  return {
    bottomPattern,
    hiddenPattern,
    key,
    pinnedPattern,
    placement,
  };
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
  const recentRankByKey = new Map(
    options.recentKeys.map((key, index) => [key, index]),
  );
  const usageByKey = new Map(options.usage.map((item) => [item.key, item.count]));

  middleKeys.sort((left, right) => {
    if (options.sortMode === "recent") {
      const leftRank = recentRankByKey.get(left);
      const rightRank = recentRankByKey.get(right);

      if (leftRank != null || rightRank != null) {
        if (leftRank == null) {
          return 1;
        }

        if (rightRank == null) {
          return -1;
        }

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
      }
    }

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

function findMatchingPattern(patterns: string[], key: string): string | null {
  if (key.length === 0) {
    return null;
  }

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();
    if (pattern.length > 0 && createWildcardMatcher(pattern)(key)) {
      return pattern;
    }
  }

  return null;
}

function createWildcardMatcher(pattern: string): (value: string) => boolean {
  const escapedPattern = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*");
  const matcher = new RegExp(`^${escapedPattern}$`, "i");

  return (value: string) => matcher.test(value);
}
