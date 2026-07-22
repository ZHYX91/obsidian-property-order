import { moment } from "obsidian";

import type { PluginLanguage } from "./types";

export type ResolvedPluginLocale = "en" | "zh-CN" | "zh-TW";

const EN_TRANSLATIONS = {
  "settings.tabsLabel": "Property Order settings categories",
  "settings.tab.general": "General",
  "settings.tab.valueDrag": "Value drag",
  "settings.tab.keyOrder": "Property name suggestions",
  "settings.general.heading": "General",
  "settings.language.name": "Language",
  "settings.language.desc": "Controls the language used by this plugin.",
  "settings.language.auto": "Follow Obsidian",
  "settings.language.en": "English",
  "settings.language.zhCn": "简体中文",
  "settings.language.zhTw": "繁體中文",
  "settings.valueDrag.heading": "Property value drag",
  "settings.valueDrag.enable.name": "Enable property value drag",
  "settings.valueDrag.enable.desc":
    "On desktop, allows dragging multi-value property pills to reorder values in frontmatter.",
  "settings.valueDrag.disabledHint":
    "Property value drag is currently disabled. The settings below can still be prepared for later.",
  "settings.valueDrag.mobileHint":
    "Property value drag runs on desktop only. These settings are saved for desktop use; Obsidian's native long-press menu remains available on mobile.",
  "settings.writebackFormat.name": "List writeback format",
  "settings.writebackFormat.desc":
    "Controls whether drag writeback preserves each property's list format, or rewrites lists as flow or block lists. Converting bullet lists to bracket lists may drop item comments and blank lines.",
  "settings.writebackFormat.preserve": "Preserve current format",
  "settings.writebackFormat.flow": "Use bracket lists",
  "settings.writebackFormat.block": "Use bullet lists",
  "settings.crossPropertyDrag.name": "Enable cross-property drag",
  "settings.crossPropertyDrag.desc":
    "Allows dragging a value from one supported property list into another property list in the same note.",
  "settings.keyOrder.heading": "Property name suggestion order",
  "settings.keyOrder.enable.name": "Enhance native property name suggestions",
  "settings.keyOrder.enable.desc":
    "Reorders Obsidian's native property name suggestion dropdown when it appears.",
  "settings.keyOrder.disabledHint":
    "Property name suggestions are currently disabled. Rules below will take effect when enabled.",
  "settings.keyOrder.sortMode.name": "Default suggestion sort",
  "settings.keyOrder.sortMode.desc":
    "Name order groups numbers, Latin names, Chinese names by pinyin, then other characters. Usage-count ties use the same name order.",
  "settings.keyOrder.sortMode.nameOption": "Name",
  "settings.keyOrder.sortMode.usage": "Usage count",
  "settings.keyOrder.pinned.name": "Pinned property names",
  "settings.keyOrder.pinned.desc":
    "One property name or pattern per line. Use * as a wildcard. Matched property names are shown first, in this order.",
  "settings.keyOrder.bottom.name": "Bottom property names",
  "settings.keyOrder.bottom.desc":
    "One property name or pattern per line. Use * as a wildcard. Matched property names are shown last, in this order.",
  "settings.keyOrder.hidden.name": "Hidden property name patterns",
  "settings.keyOrder.hidden.desc": "One pattern per line. Use * as a wildcard, for example TQ_*.",
  "settings.keyOrder.addExisting.placeholder": "Add existing property name...",
  "settings.diagnostics.name": "Show diagnostics",
  "settings.diagnostics.desc":
    "Shows extra notices when a property value can't be reordered, which helps troubleshooting.",
  "settings.saveStatus.failed": "Settings could not be saved. Changes are active only for this session.",
  "settings.saveStatus.retry": "Retry save",
  "notice.reorderFailed": "Property Order: failed to reorder property values.",
  "notice.contentChanged": "Property Order: content changed while dragging. Try again.",
  "notice.activeFileChanged": "Property Order: active file changed. Try again.",
  "notice.noFrontmatter": "Property Order: no frontmatter found in the current note.",
  "notice.propertyNotFound": "Property Order: property not found in frontmatter.",
  "notice.unsupportedProperty": "Property Order: unsupported property format.",
  "notice.unsupportedContext":
    "Property Order: can't resolve this property pill. Try updating Obsidian or theme.",
  "notice.settingsSaveFailed": "Property Order: failed to save settings. Try again.",
} as const;

export type TranslationKey = keyof typeof EN_TRANSLATIONS;

type TranslationDictionary = Record<TranslationKey, string>;

export const TRANSLATIONS = {
  en: EN_TRANSLATIONS,
  "zh-CN": {
    "settings.tabsLabel": "Property Order 设置分类",
    "settings.tab.general": "常规",
    "settings.tab.valueDrag": "属性值拖拽",
    "settings.tab.keyOrder": "属性名称候选",
    "settings.general.heading": "常规",
    "settings.language.name": "语言",
    "settings.language.desc": "控制本插件使用的语言。",
    "settings.language.auto": "跟随 Obsidian",
    "settings.language.en": "English",
    "settings.language.zhCn": "简体中文",
    "settings.language.zhTw": "繁體中文",
    "settings.valueDrag.heading": "属性值拖拽",
    "settings.valueDrag.enable.name": "启用属性值拖拽",
    "settings.valueDrag.enable.desc": "在桌面端允许拖拽多值属性胶囊，并将新的顺序写回 frontmatter。",
    "settings.valueDrag.disabledHint": "属性值拖拽当前未启用。下方设置仍可预先配置，启用后生效。",
    "settings.valueDrag.mobileHint":
      "属性值拖拽目前仅在桌面端运行。下方设置会保存供桌面端使用；移动端保留 Obsidian 原生长按菜单。",
    "settings.writebackFormat.name": "列表写回格式",
    "settings.writebackFormat.desc":
      "控制拖拽写回时保留各属性当前列表格式，还是统一写成中括号列表或无序列表。无序列表转为中括号列表时，列表项注释和空行可能无法保留。",
    "settings.writebackFormat.preserve": "保留当前格式",
    "settings.writebackFormat.flow": "统一为中括号列表",
    "settings.writebackFormat.block": "统一为无序列表",
    "settings.crossPropertyDrag.name": "启用跨属性拖拽",
    "settings.crossPropertyDrag.desc":
      "允许将一个受支持属性列表中的值拖入同一篇笔记的另一个属性列表。",
    "settings.keyOrder.heading": "属性名称候选排序",
    "settings.keyOrder.enable.name": "增强原生属性名称候选",
    "settings.keyOrder.enable.desc": "当 Obsidian 原生属性名称候选下拉框出现时，对其排序和过滤。",
    "settings.keyOrder.disabledHint": "属性名称候选当前未启用。下方规则仍可编辑，启用后生效。",
    "settings.keyOrder.sortMode.name": "默认候选排序",
    "settings.keyOrder.sortMode.desc":
      "名称排序依次显示数字、拉丁字母、按拼音排列的中文和其他字符；使用次数相同时也按此规则排序。",
    "settings.keyOrder.sortMode.nameOption": "按名称排序",
    "settings.keyOrder.sortMode.usage": "按使用次数排序",
    "settings.keyOrder.pinned.name": "置顶属性名称",
    "settings.keyOrder.pinned.desc":
      "每行一个属性名称或规则。可使用 * 作为通配符。匹配到的属性名称会按规则顺序显示在最上方。",
    "settings.keyOrder.bottom.name": "置底属性名称",
    "settings.keyOrder.bottom.desc":
      "每行一个属性名称或规则。可使用 * 作为通配符。匹配到的属性名称会按规则顺序显示在最下方。",
    "settings.keyOrder.hidden.name": "隐藏属性名称规则",
    "settings.keyOrder.hidden.desc": "每行一个规则。可使用 * 作为通配符，例如 TQ_*。",
    "settings.keyOrder.addExisting.placeholder": "添加已有属性名称...",
    "settings.diagnostics.name": "显示诊断提示",
    "settings.diagnostics.desc": "当属性值无法重排时显示额外提示，便于排查原因。",
    "settings.saveStatus.failed": "设置未能保存，当前更改仅在本次会话中生效。",
    "settings.saveStatus.retry": "重试保存",
    "notice.reorderFailed": "Property Order：写回失败，未能重排属性值。",
    "notice.contentChanged": "Property Order：拖拽期间内容发生变化，请重试。",
    "notice.activeFileChanged": "Property Order：当前笔记已切换，请重试。",
    "notice.noFrontmatter": "Property Order：当前笔记未找到 frontmatter。",
    "notice.propertyNotFound": "Property Order：frontmatter 中未找到该属性。",
    "notice.unsupportedProperty": "Property Order：该属性格式暂不支持重排。",
    "notice.unsupportedContext": "Property Order：无法识别该属性值组件，建议更新 Obsidian 或主题。",
    "notice.settingsSaveFailed": "Property Order：设置保存失败，请重试。",
  },
  "zh-TW": {
    "settings.tabsLabel": "Property Order 設定分類",
    "settings.tab.general": "一般",
    "settings.tab.valueDrag": "屬性值拖曳",
    "settings.tab.keyOrder": "屬性名稱候選",
    "settings.general.heading": "一般",
    "settings.language.name": "語言",
    "settings.language.desc": "控制本外掛使用的語言。",
    "settings.language.auto": "跟隨 Obsidian",
    "settings.language.en": "English",
    "settings.language.zhCn": "简体中文",
    "settings.language.zhTw": "繁體中文",
    "settings.valueDrag.heading": "屬性值拖曳",
    "settings.valueDrag.enable.name": "啟用屬性值拖曳",
    "settings.valueDrag.enable.desc": "在桌面端允許拖曳多值屬性膠囊，並將新的順序寫回 frontmatter。",
    "settings.valueDrag.disabledHint": "屬性值拖曳目前未啟用。下方設定仍可預先設定，啟用後生效。",
    "settings.valueDrag.mobileHint":
      "屬性值拖曳目前僅在桌面端運作。下方設定會儲存供桌面端使用；行動端保留 Obsidian 原生長按選單。",
    "settings.writebackFormat.name": "清單寫回格式",
    "settings.writebackFormat.desc":
      "控制拖曳寫回時保留各屬性目前的清單格式，還是統一寫成中括號清單或無序清單。無序清單轉為中括號清單時，清單項目註解和空行可能無法保留。",
    "settings.writebackFormat.preserve": "保留目前格式",
    "settings.writebackFormat.flow": "統一為中括號清單",
    "settings.writebackFormat.block": "統一為無序清單",
    "settings.crossPropertyDrag.name": "啟用跨屬性拖曳",
    "settings.crossPropertyDrag.desc":
      "允許將一個受支援屬性清單中的值拖入同一篇筆記的另一個屬性清單。",
    "settings.keyOrder.heading": "屬性名稱候選排序",
    "settings.keyOrder.enable.name": "增強原生屬性名稱候選",
    "settings.keyOrder.enable.desc": "當 Obsidian 原生屬性名稱候選下拉選單出現時，對其排序和過濾。",
    "settings.keyOrder.disabledHint": "屬性名稱候選目前未啟用。下方規則仍可編輯，啟用後生效。",
    "settings.keyOrder.sortMode.name": "預設候選排序",
    "settings.keyOrder.sortMode.desc":
      "名稱排序依次顯示數字、拉丁字母、按拼音排列的中文和其他字元；使用次數相同時也按此規則排序。",
    "settings.keyOrder.sortMode.nameOption": "按名稱排序",
    "settings.keyOrder.sortMode.usage": "按使用次數排序",
    "settings.keyOrder.pinned.name": "置頂屬性名稱",
    "settings.keyOrder.pinned.desc":
      "每行一個屬性名稱或規則。可使用 * 作為萬用字元。匹配到的屬性名稱會按規則順序顯示在最上方。",
    "settings.keyOrder.bottom.name": "置底屬性名稱",
    "settings.keyOrder.bottom.desc":
      "每行一個屬性名稱或規則。可使用 * 作為萬用字元。匹配到的屬性名稱會按規則順序顯示在最下方。",
    "settings.keyOrder.hidden.name": "隱藏屬性名稱規則",
    "settings.keyOrder.hidden.desc": "每行一個規則。可使用 * 作為萬用字元，例如 TQ_*。",
    "settings.keyOrder.addExisting.placeholder": "新增既有屬性名稱...",
    "settings.diagnostics.name": "顯示診斷提示",
    "settings.diagnostics.desc": "當屬性值無法重排時顯示額外提示，便於排查原因。",
    "settings.saveStatus.failed": "設定未能儲存，目前變更僅在本次工作階段中生效。",
    "settings.saveStatus.retry": "重試儲存",
    "notice.reorderFailed": "Property Order：寫回失敗，未能重排屬性值。",
    "notice.contentChanged": "Property Order：拖曳期間內容發生變化，請重試。",
    "notice.activeFileChanged": "Property Order：目前筆記已切換，請重試。",
    "notice.noFrontmatter": "Property Order：目前筆記未找到 frontmatter。",
    "notice.propertyNotFound": "Property Order：frontmatter 中未找到該屬性。",
    "notice.unsupportedProperty": "Property Order：該屬性格式暫不支援重排。",
    "notice.unsupportedContext": "Property Order：無法識別該屬性值元件，建議更新 Obsidian 或佈景主題。",
    "notice.settingsSaveFailed": "Property Order：設定儲存失敗，請重試。",
  },
} as const satisfies Record<ResolvedPluginLocale, TranslationDictionary>;

export function getResolvedLocaleCode(
  language: PluginLanguage = "auto",
  obsidianLanguage = getCurrentLanguage(),
): ResolvedPluginLocale {
  if (language === "en" || language === "zh-CN" || language === "zh-TW") {
    return language;
  }

  return resolveLanguageCode(obsidianLanguage);
}

function resolveLanguageCode(languageCode: string): ResolvedPluginLocale {
  const candidate = languageCode.trim().toLowerCase();

  if (
    candidate === "zh-tw" ||
    candidate === "zh-hant" ||
    candidate.startsWith("zh-tw") ||
    candidate.startsWith("zh-hk") ||
    candidate.startsWith("zh-mo") ||
    candidate.startsWith("zh-hant")
  ) {
    return "zh-TW";
  }

  if (candidate === "zh-cn" || candidate === "zh-hans" || candidate.startsWith("zh-cn")) {
    return "zh-CN";
  }

  if (candidate.startsWith("zh")) {
    return "zh-CN";
  }

  return "en";
}

function getCurrentLanguage(): string {
  return moment.locale();
}

export function getTranslation(locale: ResolvedPluginLocale, key: TranslationKey): string {
  return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;
}

export function t(key: TranslationKey, language: PluginLanguage = "auto"): string {
  return getTranslation(getResolvedLocaleCode(language), key);
}
