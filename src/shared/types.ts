import type { ResolvedPluginLocale } from "./locale-catalog";

export type ListWritebackFormat = "preserve" | "flow" | "block";
export type KeySuggestionSortMode = "name" | "recent" | "usage";
export type PropertyType =
  | "text"
  | "list"
  | "number"
  | "checkbox"
  | "date"
  | "datetime"
  | "tags"
  | "unknown";
export type ValueSuggestionBehavior =
  | "native"
  | "name"
  | "frequency"
  | "note-count"
  | "none"
  | "custom";
export type ValueSuggestionDefaultBehavior = Exclude<ValueSuggestionBehavior, "custom">;
export type ValueSuggestionMiddleSortMode = Exclude<
  ValueSuggestionDefaultBehavior,
  "none"
>;
export type ValueSuggestionKeyDisplayOrder = "name" | "recent";
export type PluginLanguage = "auto" | ResolvedPluginLocale;

export interface PropertyValueBehaviorAssignment {
  behavior: ValueSuggestionBehavior;
  propertyKey: string;
}

export interface PropertyValueCustomOrder {
  bottomValues: string[];
  middleSortMode: ValueSuggestionMiddleSortMode;
  middleValues: string[];
  pinnedValues: string[];
  propertyKey: string;
}

/** Preserved settings for review only; these rules never participate in runtime ordering. */
export interface LegacyValueSuggestionRules {
  sortMode: string;
  sortOverrides: string[];
  pinnedValues: string[];
  bottomValues: string[];
  hiddenPatterns: string[];
}

export interface PropertyOrderSettings {
  schemaVersion: number;
  language: PluginLanguage;
  enablePropertyValueDrag: boolean;
  listWritebackFormat: ListWritebackFormat;
  enableCrossPropertyDrag: boolean;
  enableNativeKeySuggestionOrder: boolean;
  keySuggestionSortMode: KeySuggestionSortMode;
  groupKeySuggestionsByType: boolean;
  pinnedPropertyKeys: string[];
  bottomPropertyKeys: string[];
  hiddenPropertyKeyPatterns: string[];
  enableNativeValueSuggestionOrder: boolean;
  valueSuggestionDefaultBehavior: ValueSuggestionDefaultBehavior;
  valueSuggestionPropertyAssignments: PropertyValueBehaviorAssignment[];
  valueSuggestionCustomOrders: PropertyValueCustomOrder[];
  valueSuggestionKeyDisplayOrder: ValueSuggestionKeyDisplayOrder;
  valueSuggestionLegacyRules: LegacyValueSuggestionRules | null;
  showDiagnostics: boolean;
}

export interface FrontmatterReorderOptions {
  normalizeAsTextList?: boolean;
  propertyKey: string;
  sourceIndex: number;
  targetSlot: number;
  writebackFormat: ListWritebackFormat;
}

export interface FrontmatterMoveOptions {
  normalizeAsTextList?: boolean;
  sourcePropertyKey: string;
  targetPropertyKey: string;
  sourceIndex: number;
  targetSlot: number;
  writebackFormat: ListWritebackFormat;
}

export interface PropertyKeyUsage {
  key: string;
  count: number;
}

export interface PropertyKeyOrderOptions {
  bottomKeys: string[];
  groupByType?: boolean;
  hiddenPatterns: string[];
  pinnedKeys: string[];
  propertyTypes?: ReadonlyMap<string, PropertyType>;
  recentKeys: string[];
  sortMode: KeySuggestionSortMode;
  usage: PropertyKeyUsage[];
}

export interface PropertyValueUsage {
  value: string;
  count: number;
}
