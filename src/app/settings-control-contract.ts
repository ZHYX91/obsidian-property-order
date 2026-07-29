import {
  isKeySuggestionSortMode,
  isListWritebackFormat,
  isPluginLanguage,
} from "../shared/settings";
import type { PropertyOrderSettings } from "../shared/types";

export const PROPERTY_ORDER_CONTROL_KEYS = [
  "enableCrossPropertyDrag",
  "enableNativeKeySuggestionOrder",
  "enablePropertyValueDrag",
  "keySuggestionSortMode",
  "language",
  "listWritebackFormat",
  "showDiagnostics",
] as const;

export type PropertyOrderControlKey = (typeof PROPERTY_ORDER_CONTROL_KEYS)[number];
export type SettingsRefreshMode = "none" | "state" | "structure";

export interface SettingsControlMutation {
  readonly refreshKeySuggestions: boolean;
  readonly refreshMode: SettingsRefreshMode;
}

const CONTROL_MUTATIONS = {
  enableCrossPropertyDrag: {
    refreshKeySuggestions: false,
    refreshMode: "none",
  },
  enableNativeKeySuggestionOrder: {
    refreshKeySuggestions: true,
    refreshMode: "state",
  },
  enablePropertyValueDrag: {
    refreshKeySuggestions: false,
    refreshMode: "state",
  },
  keySuggestionSortMode: {
    refreshKeySuggestions: true,
    refreshMode: "none",
  },
  language: {
    refreshKeySuggestions: false,
    refreshMode: "structure",
  },
  listWritebackFormat: {
    refreshKeySuggestions: false,
    refreshMode: "none",
  },
  showDiagnostics: {
    refreshKeySuggestions: false,
    refreshMode: "none",
  },
} as const satisfies Record<PropertyOrderControlKey, SettingsControlMutation>;

export function isPropertyOrderControlKey(key: string): key is PropertyOrderControlKey {
  return (PROPERTY_ORDER_CONTROL_KEYS as readonly string[]).includes(key);
}

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
      if (!value) {
        settings.enableCrossPropertyDrag = false;
      }
    } else if (key === "enableCrossPropertyDrag") {
      settings.enableCrossPropertyDrag = settings.enablePropertyValueDrag && value;
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
