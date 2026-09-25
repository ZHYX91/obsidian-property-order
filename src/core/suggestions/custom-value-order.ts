import type {
  PropertyValueCustomOrder,
  ValueSuggestionMiddleSortMode,
} from "../../shared/types";

export type CustomCandidatePlacement = "pinned" | "middle" | "bottom";

export function createEmptyPropertyValueCustomOrder(
  propertyKey: string,
): PropertyValueCustomOrder {
  return {
    bottomValues: [],
    middleSortMode: "native",
    middleValues: [],
    pinnedValues: [],
    propertyKey: propertyKey.trim(),
  };
}

export function moveCustomCandidate(
  order: PropertyValueCustomOrder,
  value: string,
  placement: CustomCandidatePlacement,
): PropertyValueCustomOrder {
  if (value.length === 0) {
    return cloneOrder(order);
  }

  const next = removeConfiguredValue(order, value);

  if (placement === "pinned") {
    next.pinnedValues.push(value);
  } else if (placement === "bottom") {
    next.bottomValues.push(value);
  } else {
    // Returning a configured value to the middle keeps it as preset vocabulary
    // even when the Vault no longer contains that value.
    next.middleValues.push(value);
  }

  return next;
}

export function removeCustomPreset(
  order: PropertyValueCustomOrder,
  value: string,
): PropertyValueCustomOrder {
  return removeConfiguredValue(order, value);
}

export function reorderCustomCandidate(
  order: PropertyValueCustomOrder,
  placement: Exclude<CustomCandidatePlacement, "middle">,
  value: string,
  direction: -1 | 1,
): PropertyValueCustomOrder {
  const next = cloneOrder(order);
  const values = placement === "pinned" ? next.pinnedValues : next.bottomValues;
  const index = values.indexOf(value);
  if (index < 0) {
    return next;
  }

  const targetIndex = Math.min(Math.max(index + direction, 0), values.length - 1);
  if (targetIndex === index) {
    return next;
  }

  const [moved] = values.splice(index, 1);
  if (moved != null) {
    values.splice(targetIndex, 0, moved);
  }

  return next;
}

export function setCustomMiddleSortMode(
  order: PropertyValueCustomOrder,
  middleSortMode: ValueSuggestionMiddleSortMode,
): PropertyValueCustomOrder {
  return { ...cloneOrder(order), middleSortMode };
}

export function upsertPropertyValueCustomOrder(
  orders: readonly PropertyValueCustomOrder[],
  order: PropertyValueCustomOrder,
): PropertyValueCustomOrder[] {
  const identity = normalizeKey(order.propertyKey);
  const next = orders
    .filter((candidate) => normalizeKey(candidate.propertyKey) !== identity)
    .map(cloneOrder);
  next.push(cloneOrder(order));
  return next;
}

export function getPropertyValueCustomOrder(
  orders: readonly PropertyValueCustomOrder[],
  propertyKey: string,
): PropertyValueCustomOrder {
  const identity = normalizeKey(propertyKey);
  const existing = orders.find((candidate) => normalizeKey(candidate.propertyKey) === identity);
  return existing == null
    ? createEmptyPropertyValueCustomOrder(propertyKey)
    : cloneOrder(existing);
}

function removeConfiguredValue(
  order: PropertyValueCustomOrder,
  value: string,
): PropertyValueCustomOrder {
  const next = cloneOrder(order);
  next.pinnedValues = next.pinnedValues.filter((candidate) => candidate !== value);
  next.middleValues = next.middleValues.filter((candidate) => candidate !== value);
  next.bottomValues = next.bottomValues.filter((candidate) => candidate !== value);
  return next;
}

function cloneOrder(order: PropertyValueCustomOrder): PropertyValueCustomOrder {
  return {
    ...order,
    bottomValues: [...order.bottomValues],
    middleValues: [...order.middleValues],
    pinnedValues: [...order.pinnedValues],
  };
}

function normalizeKey(propertyKey: string): string {
  return propertyKey.trim().toLocaleLowerCase();
}
