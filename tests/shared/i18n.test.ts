import { getLanguage } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getResolvedLocaleCode,
  getTranslation,
  t,
  TRANSLATIONS,
  type ResolvedPluginLocale,
} from "../../src/shared/i18n";
import { SUPPORTED_LOCALES } from "../../src/shared/locale-catalog";
import { normalizeSettings, prepareSettingsForStorage } from "../../src/shared/settings";

vi.mock("obsidian", () => ({
  getLanguage: vi.fn(() => "en"),
}));

beforeEach(() => {
  vi.mocked(getLanguage).mockReturnValue("en");
});

describe("getResolvedLocaleCode", () => {
  it("uses explicit plugin language before Obsidian language", () => {
    expect(getResolvedLocaleCode("zh-TW", "en")).toBe("zh-TW");
    expect(getResolvedLocaleCode("en", "zh-CN")).toBe("en");
  });

  it("resolves Obsidian Chinese language codes", () => {
    expect(getResolvedLocaleCode("auto", "zh")).toBe("zh-CN");
    expect(getResolvedLocaleCode("auto", "zh-CN")).toBe("zh-CN");
    expect(getResolvedLocaleCode("auto", "zh-Hans")).toBe("zh-CN");
    expect(getResolvedLocaleCode("auto", "zh-TW")).toBe("zh-TW");
    expect(getResolvedLocaleCode("auto", "zh-HK")).toBe("zh-TW");
    expect(getResolvedLocaleCode("auto", "zh-Hant")).toBe("zh-TW");
  });

  it("falls back to English for unsupported language codes", () => {
    expect(getResolvedLocaleCode("auto", "it")).toBe("en");
    expect(getResolvedLocaleCode("auto", "constructor")).toBe("en");
    expect(getResolvedLocaleCode("auto", "zhbogus")).toBe("en");
  });

  it.each([
    ["en_US", "en"],
    ["de", "de-DE"],
    ["de-AT", "de-DE"],
    ["fr", "fr-FR"],
    ["fr-CA", "fr-FR"],
    ["es", "es-ES"],
    ["es-MX", "es-ES"],
    ["pt", "pt-BR"],
    ["pt_BR", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["ru", "ru-RU"],
    ["ja", "ja-JP"],
    ["ko", "ko-KR"],
    ["vi", "vi-VN"],
    ["ar", "ar"],
    ["ar_SA", "ar"],
    ["ar-EG", "ar"],
    ["zh_HK", "zh-TW"],
    ["zh-MO", "zh-TW"],
    ["zh-Hant-CN", "zh-TW"],
    ["zh-Hans-TW", "zh-CN"],
    ["zh-CN-x-hant", "zh-CN"],
    ["zh-TW-x-hans", "zh-TW"],
  ])("uses the supported translation for Obsidian %s", (hostLanguage, expected) => {
    expect(getResolvedLocaleCode("auto", hostLanguage)).toBe(expected);
  });

  it.each(SUPPORTED_LOCALES)("retains explicit $id through settings persistence", ({ id }) => {
    const baseline = normalizeSettings({ language: "auto" });
    const edited = normalizeSettings({ ...baseline, language: id });
    const stored = prepareSettingsForStorage(edited, baseline, baseline);
    expect(normalizeSettings(stored).language).toBe(id);
    expect(getResolvedLocaleCode(id, "zh-CN")).toBe(id);
  });

  it("uses Obsidian's configured interface language in Auto", () => {
    vi.mocked(getLanguage).mockReturnValue("zh-TW");

    expect(getResolvedLocaleCode("auto")).toBe("zh-TW");
  });
});

describe("translations", () => {
  it("keeps every locale's key set in parity with English", () => {
    const englishKeys = Object.keys(TRANSLATIONS.en).sort();

    for (const locale of Object.keys(TRANSLATIONS) as ResolvedPluginLocale[]) {
      expect(Object.keys(TRANSLATIONS[locale]).sort()).toEqual(englishKeys);
      for (const key of englishKeys as Array<keyof typeof TRANSLATIONS.en>) {
        const translation = TRANSLATIONS[locale][key];
        expect(translation.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
        expect(translation.match(/\{[^{}]*\}/gu)?.sort() ?? [], `${locale}: ${key}`)
          .toEqual(TRANSLATIONS.en[key].match(/\{[^{}]*\}/gu)?.sort() ?? []);
      }
    }
    expect(Object.keys(TRANSLATIONS).sort()).toEqual(SUPPORTED_LOCALES.map(({ id }) => id).sort());
  });

  it("returns the requested locale's translation", () => {
    expect(getTranslation("en", "settings.general.heading")).toBe("General");
    expect(getTranslation("zh-CN", "settings.general.heading")).toBe("常规");
    expect(getTranslation("zh-TW", "settings.general.heading")).toBe("一般");
  });

  it("falls back through the resolved English locale for unsupported Obsidian languages", () => {
    vi.mocked(getLanguage).mockReturnValue("it");

    expect(t("settings.general.heading")).toBe("General");
  });
});
