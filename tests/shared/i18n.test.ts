import { moment } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getResolvedLocaleCode,
  getTranslation,
  t,
  TRANSLATIONS,
  type ResolvedPluginLocale,
} from "../../src/shared/i18n";

vi.mock("obsidian", () => ({
  moment: {
    locale: vi.fn(() => "en"),
  },
}));

beforeEach(() => {
  vi.mocked(moment.locale).mockReturnValue("en");
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
    expect(getResolvedLocaleCode("auto", "fr")).toBe("en");
  });
});

describe("translations", () => {
  it("keeps every locale's key set in parity with English", () => {
    const englishKeys = Object.keys(TRANSLATIONS.en).sort();

    for (const locale of Object.keys(TRANSLATIONS) as ResolvedPluginLocale[]) {
      expect(Object.keys(TRANSLATIONS[locale]).sort()).toEqual(englishKeys);
    }
  });

  it("returns the requested locale's translation", () => {
    expect(getTranslation("en", "settings.general.heading")).toBe("General");
    expect(getTranslation("zh-CN", "settings.general.heading")).toBe("常规");
    expect(getTranslation("zh-TW", "settings.general.heading")).toBe("一般");
  });

  it("falls back through the resolved English locale for unsupported Obsidian languages", () => {
    vi.mocked(moment.locale).mockReturnValue("fr");

    expect(t("settings.general.heading")).toBe("General");
  });
});
