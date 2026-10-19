export const SUPPORTED_LOCALES = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "ja-JP", label: "日本語" },
  { id: "ko-KR", label: "한국어" },
  { id: "de-DE", label: "Deutsch" },
  { id: "fr-FR", label: "Français" },
  { id: "es-ES", label: "Español" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "ru-RU", label: "Русский" },
  { id: "vi-VN", label: "Tiếng Việt" },
  { id: "ar", label: "العربية" },
] as const;

export type ResolvedPluginLocale = (typeof SUPPORTED_LOCALES)[number]["id"];

export function isSupportedPluginLocale(value: unknown): value is ResolvedPluginLocale {
  return SUPPORTED_LOCALES.some((locale) => locale.id === value);
}
