import type {
  PropertyValueUsage,
  ValueSuggestionMiddleSortMode,
} from "../../shared/types";
import { comparePropertyNames } from "./property-names";

export interface PlannedPropertyValueCandidate {
  isPreset: boolean;
  placement: "bottom" | "middle" | "pinned";
  value: string;
}

export interface CustomPropertyValueCandidateOptions {
  bottomValues: readonly string[];
  frequency: readonly PropertyValueUsage[];
  middleSortMode: ValueSuggestionMiddleSortMode;
  middleValues: readonly string[];
  nativeValues: readonly string[];
  noteCounts: readonly PropertyValueUsage[];
  pinnedValues: readonly string[];
}

export function planCustomPropertyValueCandidates(
  options: CustomPropertyValueCandidateOptions,
): PlannedPropertyValueCandidate[] {
  const presetValues = new Set([
    ...options.pinnedValues,
    ...options.middleValues,
    ...options.bottomValues,
  ]);
  const pinnedValues = dedupeExact(options.pinnedValues);
  const pinnedSet = new Set(pinnedValues);
  const bottomValues = dedupeExact(options.bottomValues).filter(
    (value) => !pinnedSet.has(value),
  );
  const bottomSet = new Set(bottomValues);
  const middleValues = dedupeExact([
    ...options.nativeValues,
    ...options.middleValues,
  ]).filter((value) => !pinnedSet.has(value) && !bottomSet.has(value));

  sortMiddleValues(middleValues, options);

  return [
    ...pinnedValues.map((value) => ({
      isPreset: true,
      placement: "pinned" as const,
      value,
    })),
    ...middleValues.map((value) => ({
      isPreset: presetValues.has(value),
      placement: "middle" as const,
      value,
    })),
    ...bottomValues.map((value) => ({
      isPreset: true,
      placement: "bottom" as const,
      value,
    })),
  ];
}

function sortMiddleValues(
  values: string[],
  options: CustomPropertyValueCandidateOptions,
): void {
  if (options.middleSortMode === "native") {
    return;
  }

  const counts =
    options.middleSortMode === "frequency"
      ? new Map(options.frequency.map((item) => [item.value, item.count]))
      : options.middleSortMode === "note-count"
        ? new Map(options.noteCounts.map((item) => [item.value, item.count]))
        : null;

  values.sort((left, right) => {
    if (counts != null) {
      const countDelta = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);
      if (countDelta !== 0) {
        return countDelta;
      }
    }

    return comparePropertyNames(left, right);
  });
}

function dedupeExact(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
