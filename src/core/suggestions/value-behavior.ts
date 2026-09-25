import type {
  PropertyValueBehaviorAssignment,
  ValueSuggestionBehavior,
  ValueSuggestionKeyDisplayOrder,
} from "../../shared/types";
import { comparePropertyNames } from "./property-names";

export interface PropertyValueBehaviorGroup {
  behavior: ValueSuggestionBehavior;
  propertyKeys: string[];
}

export interface PropertyValueBehaviorMove {
  changed: boolean;
  fromBehavior: ValueSuggestionBehavior | null;
  nextAssignments: PropertyValueBehaviorAssignment[];
  propertyKey: string;
  toBehavior: ValueSuggestionBehavior;
}

export function getPropertyValueBehavior(
  assignments: readonly PropertyValueBehaviorAssignment[],
  rawPropertyKey: string,
): ValueSuggestionBehavior | null {
  const identity = normalizePropertyKeyIdentity(rawPropertyKey);
  if (identity.length === 0) {
    return null;
  }

  return assignments.find(
    (assignment) => normalizePropertyKeyIdentity(assignment.propertyKey) === identity,
  )?.behavior ?? null;
}

export function movePropertyValueBehavior(
  assignments: readonly PropertyValueBehaviorAssignment[],
  rawPropertyKey: string,
  toBehavior: ValueSuggestionBehavior,
): PropertyValueBehaviorMove {
  const propertyKey = rawPropertyKey.trim();
  const identity = normalizePropertyKeyIdentity(propertyKey);
  const existing = assignments.find(
    (assignment) => normalizePropertyKeyIdentity(assignment.propertyKey) === identity,
  ) ?? null;

  if (identity.length === 0) {
    return {
      changed: false,
      fromBehavior: null,
      nextAssignments: assignments.map((assignment) => ({ ...assignment })),
      propertyKey: "",
      toBehavior,
    };
  }

  if (existing?.behavior === toBehavior && existing.propertyKey === propertyKey) {
    return {
      changed: false,
      fromBehavior: existing.behavior,
      nextAssignments: assignments.map((assignment) => ({ ...assignment })),
      propertyKey,
      toBehavior,
    };
  }

  const nextAssignments = assignments
    .filter((assignment) => normalizePropertyKeyIdentity(assignment.propertyKey) !== identity)
    .map((assignment) => ({ ...assignment }));
  nextAssignments.push({ behavior: toBehavior, propertyKey });

  return {
    changed: true,
    fromBehavior: existing?.behavior ?? null,
    nextAssignments,
    propertyKey,
    toBehavior,
  };
}

export function removePropertyValueBehavior(
  assignments: readonly PropertyValueBehaviorAssignment[],
  rawPropertyKey: string,
): PropertyValueBehaviorAssignment[] {
  const identity = normalizePropertyKeyIdentity(rawPropertyKey);
  return assignments
    .filter((assignment) => normalizePropertyKeyIdentity(assignment.propertyKey) !== identity)
    .map((assignment) => ({ ...assignment }));
}

export function groupPropertyValueBehaviors(
  assignments: readonly PropertyValueBehaviorAssignment[],
  displayOrder: ValueSuggestionKeyDisplayOrder,
): PropertyValueBehaviorGroup[] {
  const behaviorOrder: ValueSuggestionBehavior[] = [
    "name",
    "frequency",
    "note-count",
    "native",
    "none",
    "custom",
  ];
  const assignmentIndexByIdentity = new Map(
    assignments.map((assignment, index) => [
      normalizePropertyKeyIdentity(assignment.propertyKey),
      index,
    ]),
  );

  return behaviorOrder.map((behavior) => {
    const propertyKeys = assignments
      .filter((assignment) => assignment.behavior === behavior)
      .map((assignment) => assignment.propertyKey);

    propertyKeys.sort((left, right) => {
      if (displayOrder === "name") {
        return comparePropertyNames(left, right);
      }

      const leftIndex = assignmentIndexByIdentity.get(normalizePropertyKeyIdentity(left)) ?? -1;
      const rightIndex = assignmentIndexByIdentity.get(normalizePropertyKeyIdentity(right)) ?? -1;
      return rightIndex - leftIndex;
    });

    return { behavior, propertyKeys };
  });
}

export function mergePropertyValueKeyCandidates(
  availableKeys: readonly string[],
  assignments: readonly PropertyValueBehaviorAssignment[],
  customOrderKeys: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawKey of [
    ...availableKeys,
    ...assignments.map((assignment) => assignment.propertyKey),
    ...customOrderKeys,
  ]) {
    const propertyKey = rawKey.trim();
    const identity = normalizePropertyKeyIdentity(propertyKey);
    if (identity.length === 0 || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(propertyKey);
  }

  return result.sort(comparePropertyNames);
}

function normalizePropertyKeyIdentity(propertyKey: string): string {
  return propertyKey.trim().toLocaleLowerCase();
}
