export type ListWritebackFormat = "preserve" | "flow" | "block";
export type KeySuggestionSortMode = "name" | "recent" | "usage";
export type PluginLanguage = "auto" | "en" | "zh-CN" | "zh-TW";

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
