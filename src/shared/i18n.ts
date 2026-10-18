import { getLanguage } from "obsidian";

import { isSupportedPluginLocale, type ResolvedPluginLocale } from "./locale-catalog";
import ar from "./locales/ar";
import de from "./locales/de-DE";
import en from "./locales/en";
import es from "./locales/es-ES";
import fr from "./locales/fr-FR";
import ja from "./locales/ja-JP";
import ko from "./locales/ko-KR";
import pt from "./locales/pt-BR";
import ru from "./locales/ru-RU";
import vi from "./locales/vi-VN";
import zhCn from "./locales/zh-CN";
import zhTw from "./locales/zh-TW";
import type { PluginLanguage } from "./types";

export type { ResolvedPluginLocale } from "./locale-catalog";
export type TranslationKey = keyof typeof en;
export type TranslationDictionary = Record<TranslationKey, string>;

export const TRANSLATIONS = {
  en,
  "zh-CN": zhCn,
  "zh-TW": zhTw,
  "de-DE": de,
  "fr-FR": fr,
  "es-ES": es,
  "pt-BR": pt,
  "ru-RU": ru,
  "ja-JP": ja,
  "ko-KR": ko,
  "vi-VN": vi,
  ar,
} satisfies Record<ResolvedPluginLocale, TranslationDictionary>;

export function getResolvedLocaleCode(
  language: PluginLanguage = "auto",
  obsidianLanguage = getLanguage(),
): ResolvedPluginLocale {
  return isSupportedPluginLocale(language) ? language : resolveLanguageCode(obsidianLanguage);
}

function resolveLanguageCode(languageCode: string): ResolvedPluginLocale {
  const [language, ...allSubtags] = languageCode.trim().toLowerCase().replace(/_/gu, "-").split("-");
  const extensionIndex = allSubtags.findIndex((part) => part.length === 1);
  const subtags = extensionIndex < 0 ? allSubtags : allSubtags.slice(0, extensionIndex);

  if (language === "zh") {
    if (subtags.includes("hant")) return "zh-TW";
    if (subtags.includes("hans")) return "zh-CN";
    return subtags.some((part) => part === "tw" || part === "hk" || part === "mo")
      ? "zh-TW"
      : "zh-CN";
  }

  const localeByLanguage: Readonly<Record<string, ResolvedPluginLocale>> = {
    ar: "ar",
    de: "de-DE",
    es: "es-ES",
    fr: "fr-FR",
    ja: "ja-JP",
    ko: "ko-KR",
    pt: "pt-BR",
    ru: "ru-RU",
    vi: "vi-VN",
  };
  return Object.prototype.hasOwnProperty.call(localeByLanguage, language)
    ? localeByLanguage[language]
    : "en";
}

export function getTranslation(locale: ResolvedPluginLocale, key: TranslationKey): string {
  return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;
}

export function t(key: TranslationKey, language: PluginLanguage = "auto"): string {
  return getTranslation(getResolvedLocaleCode(language), key);
}
