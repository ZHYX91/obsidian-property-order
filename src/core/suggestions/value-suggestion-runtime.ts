import type {
  PropertyOrderSettings,
  PropertyValueUsage,
  ValueSuggestionBehavior,
} from "../../shared/types";
import { getPropertyValueCustomOrder } from "./custom-value-order";
import { resolvePropertyValueBehavior } from "./value-behavior";
import {
  planCustomPropertyValueCandidates,
  type PlannedPropertyValueCandidate,
} from "./value-candidates";

export interface GroupedValueSuggestionPlan {
  behavior: ValueSuggestionBehavior;
  candidates: PlannedPropertyValueCandidate[];
}

export function planGroupedPropertyValueSuggestions(
  settings: Pick<
    PropertyOrderSettings,
    | "valueSuggestionCustomOrders"
    | "valueSuggestionDefaultBehavior"
    | "valueSuggestionPropertyAssignments"
  >,
  propertyKey: string,
  nativeValues: readonly string[],
  frequency: readonly PropertyValueUsage[],
  noteCounts: readonly PropertyValueUsage[],
): GroupedValueSuggestionPlan {
  const behavior = resolvePropertyValueBehavior(
    settings.valueSuggestionPropertyAssignments,
    settings.valueSuggestionDefaultBehavior,
    propertyKey,
  );

  if (behavior === "none") {
    return { behavior, candidates: [] };
  }

  if (behavior === "custom") {
    const order = getPropertyValueCustomOrder(
      settings.valueSuggestionCustomOrders,
      propertyKey,
    );
    return {
      behavior,
      candidates: planCustomPropertyValueCandidates({
        bottomValues: order.bottomValues,
        frequency,
        middleSortMode: order.middleSortMode,
        middleValues: order.middleValues,
        nativeValues,
        noteCounts,
        pinnedValues: order.pinnedValues,
      }),
    };
  }

  return {
    behavior,
    candidates: planCustomPropertyValueCandidates({
      bottomValues: [],
      frequency,
      middleSortMode: behavior,
      middleValues: [],
      nativeValues,
      noteCounts,
      pinnedValues: [],
    }),
  };
}
