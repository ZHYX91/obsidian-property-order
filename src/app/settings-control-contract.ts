import {
  isKeySuggestionSortMode,
  isListWritebackFormat,
  isPluginLanguage,
  type PersistedSettingKey,
} from "../shared/settings";
import type { PropertyOrderSettings } from "../shared/types";
import type { SettingsTabId } from "./settings-tabs";

export const SETTINGS_PANEL = {
  language: "general",
  showDiagnostics: "general",
  enablePropertyValueDrag: "valueDrag",
  listWritebackFormat: "valueDrag",
  enableCrossPropertyDrag: "valueDrag",
  enableNativeKeySuggestionOrder: "keyOrder",
  keySuggestionSortMode: "keyOrder",
  groupKeySuggestionsByType: "keyOrder",
  pinnedPropertyKeys: "keyOrder",
  bottomPropertyKeys: "keyOrder",
  hiddenPropertyKeyPatterns: "keyOrder",
  enableNativeValueSuggestionOrder: "valueSuggestions",
  valueSuggestionDefaultBehavior: "valueSuggestions",
  valueSuggestionPropertyAssignments: "valueSuggestions",
  valueSuggestionCustomOrders: "valueSuggestions",
  valueSuggestionKeyDisplayOrder: "valueSuggestions",
  valueSuggestionLegacyRules: "valueSuggestions",
} as const satisfies Record<PersistedSettingKey, SettingsTabId>;

export type PropertyOrderControlKey =
  | "enableCrossPropertyDrag"
  | "enableNativeKeySuggestionOrder"
  | "enablePropertyValueDrag"
  | "groupKeySuggestionsByType"
  | "keySuggestionSortMode"
  | "language"
  | "listWritebackFormat"
  | "showDiagnostics";

export interface SettingsControlMutation {
  readonly refreshKeySuggestions: boolean;
  readonly rerender: boolean;
}

const CONTROL_MUTATIONS = {
  enableCrossPropertyDrag: {
    refreshKeySuggestions: false,
    rerender: false,
  },
  enableNativeKeySuggestionOrder: {
    refreshKeySuggestions: true,
    rerender: true,
  },
  enablePropertyValueDrag: {
    refreshKeySuggestions: false,
    rerender: true,
  },
  groupKeySuggestionsByType: {
    refreshKeySuggestions: true,
    rerender: false,
  },
  keySuggestionSortMode: {
    refreshKeySuggestions: true,
    rerender: false,
  },
  language: {
    refreshKeySuggestions: true,
    rerender: true,
  },
  listWritebackFormat: {
    refreshKeySuggestions: false,
    rerender: false,
  },
  showDiagnostics: {
    refreshKeySuggestions: false,
    rerender: false,
  },
} as const satisfies Record<PropertyOrderControlKey, SettingsControlMutation>;

export function isPropertyOrderControlValue(
  key: PropertyOrderControlKey,
  value: unknown,
): boolean {
  if (key === "language") {
    return isPluginLanguage(value);
  }

  if (key === "listWritebackFormat") {
    return isListWritebackFormat(value);
  }

  if (key === "keySuggestionSortMode") {
    return isKeySuggestionSortMode(value);
  }

  return typeof value === "boolean";
}

export function applyPropertyOrderControlValue(
  settings: PropertyOrderSettings,
  key: PropertyOrderControlKey,
  value: unknown,
): SettingsControlMutation {
  if (key === "language") {
    if (!isPluginLanguage(value)) {
      throw new TypeError(getInvalidControlValueMessage(key));
    }
    settings.language = value;
  } else if (key === "listWritebackFormat") {
    if (!isListWritebackFormat(value)) {
      throw new TypeError(getInvalidControlValueMessage(key));
    }
    settings.listWritebackFormat = value;
  } else if (key === "keySuggestionSortMode") {
    if (!isKeySuggestionSortMode(value)) {
      throw new TypeError(getInvalidControlValueMessage(key));
    }
    settings.keySuggestionSortMode = value;
  } else {
    if (typeof value !== "boolean") {
      throw new TypeError(getInvalidControlValueMessage(key));
    }

    if (key === "enablePropertyValueDrag") {
      settings.enablePropertyValueDrag = value;
    } else if (key === "enableCrossPropertyDrag") {
      settings.enableCrossPropertyDrag = value;
    } else {
      settings[key] = value;
    }
  }

  return CONTROL_MUTATIONS[key];
}

function getInvalidControlValueMessage(key: PropertyOrderControlKey): string {
  if (key === "language") {
    return "Invalid Property Order language setting.";
  }

  if (key === "listWritebackFormat") {
    return "Invalid Property Order writeback format setting.";
  }

  if (key === "keySuggestionSortMode") {
    return "Invalid Property Order key suggestion sort setting.";
  }

  return `Invalid boolean value for Property Order setting: ${key}`;
}
