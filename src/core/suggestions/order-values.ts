import type {
  PropertyValueOrderOptions,
  ValueSuggestionSortMode,
} from "../../shared/types";
import { comparePropertyNames } from "./property-names";

export interface OrderedPropertyValue {
  value: string;
}

export interface PropertyValueRuleConfig {
  bottomRules: readonly string[];
  defaultSortMode: ValueSuggestionSortMode;
  hiddenRules: readonly string[];
  pinnedRules: readonly string[];
  sortOverrides: readonly string[];
}

export interface ResolvedPropertyValueRules {
  bottomValues: string[];
  hiddenPatterns: string[];
  pinnedValues: string[];
  sortMode: ValueSuggestionSortMode;
}

export function resolvePropertyValueRules(
  rawPropertyKey: string,
  config: PropertyValueRuleConfig,
): ResolvedPropertyValueRules {
  const propertyKey = rawPropertyKey.trim();

  return {
    bottomValues: collectScopedRules(config.bottomRules, propertyKey),
    hiddenPatterns: collectScopedRules(config.hiddenRules, propertyKey),
    pinnedValues: collectScopedRules(config.pinnedRules, propertyKey),
    sortMode: resolveSortOverride(
      config.sortOverrides,
      propertyKey,
      config.defaultSortMode,
    ),
  };
}

export function orderPropertyValues(
  values: string[],
  options: PropertyValueOrderOptions,
): OrderedPropertyValue[] {
  const normalizedValues = dedupePreservingOrder(
    values.map((value) => value.trim()).filter(Boolean),
  );
  const hiddenMatchers = options.hiddenPatterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map(createWildcardMatcher);
  const visibleValues = normalizedValues.filter(
    (value) => !hiddenMatchers.some((matcher) => matcher(value)),
  );
  const visibleValueSet = new Set(visibleValues);
  const pinnedValues = expandPatterns(options.pinnedValues, visibleValues).filter(
    (value) => visibleValueSet.has(value),
  );
  const pinnedValueSet = new Set(pinnedValues);
  const bottomValues = expandPatterns(options.bottomValues, visibleValues).filter(
    (value) => visibleValueSet.has(value) && !pinnedValueSet.has(value),
  );
  const reservedValues = new Set([...pinnedValues, ...bottomValues]);
  const middleValues = visibleValues.filter((value) => !reservedValues.has(value));
  const recentRankByValue = new Map(
    options.recentValues.map((value, index) => [value, index]),
  );
  const usageByValue = new Map(options.usage.map((item) => [item.value, item.count]));

  if (options.sortMode !== "native") {
    middleValues.sort((left, right) => {
      if (options.sortMode === "recent") {
        const leftRank = recentRankByValue.get(left);
        const rightRank = recentRankByValue.get(right);

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
        const usageDelta =
          (usageByValue.get(right) ?? 0) - (usageByValue.get(left) ?? 0);

        if (usageDelta !== 0) {
          return usageDelta;
        }
      }

      return comparePropertyNames(left, right);
    });
  }

  return [...pinnedValues, ...middleValues, ...bottomValues].map((value) => ({
    value,
  }));
}

function resolveSortOverride(
  rules: readonly string[],
  propertyKey: string,
  fallback: ValueSuggestionSortMode,
): ValueSuggestionSortMode {
  for (const rule of rules) {
    const assignment = parseScopedAssignment(rule);

    if (
      assignment != null &&
      createWildcardMatcher(assignment.scope)(propertyKey) &&
      isValueSuggestionSortMode(assignment.value)
    ) {
      return assignment.value;
    }
  }

  return fallback;
}

function collectScopedRules(
  rules: readonly string[],
  propertyKey: string,
): string[] {
  const result: string[] = [];

  for (const rule of rules) {
    const assignment = parseScopedAssignment(rule);

    if (
      assignment != null &&
      createWildcardMatcher(assignment.scope)(propertyKey)
    ) {
      result.push(assignment.value);
    }
  }

  return result;
}

function parseScopedAssignment(
  rawRule: string,
): { scope: string; value: string } | null {
  const separatorIndex = rawRule.indexOf("=");

  if (separatorIndex < 0) {
    return null;
  }

  const scope = rawRule.slice(0, separatorIndex).trim();
  const value = rawRule.slice(separatorIndex + 1).trim();

  return scope.length > 0 && value.length > 0 ? { scope, value } : null;
}

function isValueSuggestionSortMode(value: string): value is ValueSuggestionSortMode {
  return value === "native" || value === "name" || value === "recent" || value === "usage";
}

function dedupePreservingOrder(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function expandPatterns(patterns: readonly string[], values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();

    if (pattern.length === 0) {
      continue;
    }

    for (const value of values.filter(createWildcardMatcher(pattern))) {
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
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
