export type ListWritebackFormat = "preserve" | "flow" | "block";
export type KeySuggestionSortMode = "name" | "recent" | "usage";
export type ValueSuggestionSortMode = "native" | "name" | "recent" | "usage" | "none";
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
export type PluginLanguage = "auto" | "en" | "zh-CN" | "zh-TW";

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

export interface PropertyOrderSettings {
  schemaVersion: number;
  language: PluginLanguage;
  enablePropertyValueDrag: boolean;
  listWritebackFormat: ListWritebackFormat;
  enableCrossPropertyDrag: boolean;
  enableNativeKeySuggestionOrder: boolean;
  keySuggestionSortMode: KeySuggestionSortMode;
  pinnedPropertyKeys: string[];
  bottomPropertyKeys: string[];
  hiddenPropertyKeyPatterns: string[];
  enableNativeValueSuggestionOrder: boolean;
  valueSuggestionSortMode: ValueSuggestionSortMode;
  valueSuggestionSortOverrides: string[];
  pinnedPropertyValues: string[];
  bottomPropertyValues: string[];
  hiddenPropertyValuePatterns: string[];
  valueSuggestionDefaultBehavior: ValueSuggestionDefaultBehavior;
  valueSuggestionPropertyAssignments: PropertyValueBehaviorAssignment[];
  valueSuggestionCustomOrders: PropertyValueCustomOrder[];
  valueSuggestionKeyDisplayOrder: ValueSuggestionKeyDisplayOrder;
  valueSuggestionLegacyMigrationPending: boolean;
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
  hiddenPatterns: string[];
  pinnedKeys: string[];
  recentKeys: string[];
  sortMode: KeySuggestionSortMode;
  usage: PropertyKeyUsage[];
}

export interface PropertyValueUsage {
  value: string;
  count: number;
}

export interface PropertyValueOrderOptions {
  bottomValues: string[];
  hiddenPatterns: string[];
  pinnedValues: string[];
  recentValues: string[];
  sortMode: ValueSuggestionSortMode;
  usage: PropertyValueUsage[];
}
