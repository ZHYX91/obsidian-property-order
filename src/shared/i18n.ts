import { getLanguage } from "obsidian";

import type { PluginLanguage } from "./types";

export type ResolvedPluginLocale = "en" | "zh-CN" | "zh-TW";

const EN_TRANSLATIONS = {
  "settings.tabsLabel": "Property Order settings categories",
  "settings.tab.general": "General",
  "settings.tab.valueDrag": "Value drag",
  "settings.tab.keyOrder": "Property name suggestions",
  "settings.general.heading": "General",
  "settings.language.name": "Interface language",
  "settings.language.desc": "Choose Follow Obsidian to use Obsidian's interface language.",
  "settings.language.auto": "Follow Obsidian",
  "settings.language.en": "English",
  "settings.language.zhCn": "简体中文",
  "settings.language.zhTw": "繁體中文",
  "settings.valueDrag.heading": "Property value drag",
  "settings.valueDrag.enable.name": "Enable property value drag",
  "settings.valueDrag.enable.desc":
    "Allows dragging multi-value property pills to reorder values in frontmatter. On mobile, first choose the reorder action from the native long-press menu.",
  "settings.valueDrag.disabledHint":
    "Property value drag is currently disabled. The settings below can still be prepared for later.",
  "settings.valueDrag.mobileHint":
    "Long-press a property value and choose Reorder or move. The next touch-drag starts immediately; Obsidian's Edit, Remove from list, and Copy actions remain available.",
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
    "Name order groups numbers, Latin names, Chinese names by pinyin, then other characters. Note count is the number of notes containing the property; ties use name order. Recently used history is stored only on this device, and unrecorded properties use name order.",
  "settings.keyOrder.sortMode.nameOption": "Name",
  "settings.keyOrder.sortMode.recent": "Recently used",
  "settings.keyOrder.sortMode.usage": "Notes containing the property",
  "settings.keyOrder.recentHistory.name": "Recently used history",
  "settings.keyOrder.recentHistory.desc":
    "Clears this vault's device-local property name history used by Recently used sorting. New uses will build the history again.",
  "settings.keyOrder.recentHistory.clear": "Clear history",
  "settings.keyOrder.pinned.name": "Pinned property names",
  "settings.keyOrder.pinned.desc":
    "One property name or pattern per line. Use * as a wildcard. Matched property names are shown first, in this order.",
  "settings.keyOrder.bottom.name": "Bottom property names",
  "settings.keyOrder.bottom.desc":
    "One property name or pattern per line. Use * as a wildcard. Matched property names are shown last, in this order.",
  "settings.keyOrder.hidden.name": "Hidden property name patterns",
  "settings.keyOrder.hidden.desc": "One pattern per line. Use * as a wildcard, for example TQ_*.",
  "settings.keyOrder.ruleDiagnostic.name": "Test property name rules",
  "settings.keyOrder.ruleDiagnostic.desc":
    "Enter one property name to see which hidden, pinned, and bottom rules match and which result wins.",
  "settings.keyOrder.ruleDiagnostic.placeholder": "Property name...",
  "settings.keyOrder.ruleDiagnostic.empty": "Enter a property name to test the current rules.",
  "settings.keyOrder.ruleDiagnostic.hidden": "Result: hidden",
  "settings.keyOrder.ruleDiagnostic.pinned": "Result: pinned",
  "settings.keyOrder.ruleDiagnostic.bottom": "Result: bottom",
  "settings.keyOrder.ruleDiagnostic.normal": "Result: normal; no rule matched",
  "settings.keyOrder.ruleDiagnostic.hiddenMatch": "Hidden rule",
  "settings.keyOrder.ruleDiagnostic.pinnedMatch": "Pinned rule",
  "settings.keyOrder.ruleDiagnostic.bottomMatch": "Bottom rule",
  "settings.keyOrder.ruleDiagnostic.priority": "Priority: hidden > pinned > bottom",
  "settings.keyOrder.addExisting.placeholder": "Add existing property name...",
  "menu.reorder": "Reorder",
  "menu.reorderOrMove": "Reorder or move",
  "settings.diagnostics.name": "Show diagnostics",
  "settings.diagnostics.desc":
    "Shows extra notices when a property value can't be reordered, which helps troubleshooting.",
  "settings.saveStatus.failed": "Settings could not be saved. Changes are active only for this session.",
  "settings.saveStatus.retry": "Retry save",
  "notice.reorderFailed": "Property Order: failed to reorder property values.",
  "notice.writebackDiverged":
    "Property Order: the editor returned an unexpected result. Check the note in Source mode before continuing.",
  "notice.persistenceFailed":
    "Property Order: values changed in the editor, but saving could not be scheduled. Save the note manually before continuing.",
  "notice.propertiesRefreshNeeded":
    "Property Order: values were written, but Properties did not refresh.",
  "notice.propertiesRefreshAction": "Refresh Properties",
  "notice.propertiesRefreshSucceeded": "Property Order: Properties refreshed.",
  "notice.propertiesRefreshFailed":
    "Property Order: Properties still could not refresh. Reopen the note before dragging again.",
  "notice.propertiesOutOfSync":
    "Property Order: Properties is out of sync with the note. Reopen the note before dragging again.",
  "notice.contentChanged": "Property Order: content changed while dragging. Try again.",
  "notice.activeFileChanged": "Property Order: active file changed. Try again.",
  "notice.noFrontmatter": "Property Order: no frontmatter found in the current note.",
  "notice.propertyNotFound": "Property Order: property not found in frontmatter.",
  "notice.unsupportedProperty": "Property Order: unsupported property format.",
  "notice.targetNotList":
    "Property Order: can't move the value to “{property}”: the target is not a list property.",
  "notice.unsupportedContext":
    "Property Order: can't resolve this property pill. Try updating Obsidian or theme.",
  "notice.settingsSaveFailed": "Property Order: failed to save settings. Try again.",
  "notice.recentHistoryCleared": "Property Order: recent property history cleared.",
  "notice.recentHistoryClearFailed":
    "Property Order: saved recent history could not be cleared. It is cleared for this session but may return after restart.",
  "notice.mobileReorderArmed":
    "Property Order: drag the selected value now. Tap elsewhere or wait to cancel.",
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
    "settings.language.name": "界面语言",
    "settings.language.desc": "选择“跟随 Obsidian”可使用 Obsidian 的界面语言。",
    "settings.language.auto": "跟随 Obsidian",
    "settings.language.en": "English",
    "settings.language.zhCn": "简体中文",
    "settings.language.zhTw": "繁體中文",
    "settings.valueDrag.heading": "属性值拖拽",
    "settings.valueDrag.enable.name": "启用属性值拖拽",
    "settings.valueDrag.enable.desc":
      "允许拖拽多值属性胶囊并将新顺序写回 frontmatter；移动端需先从原生长按菜单选择重排操作。",
    "settings.valueDrag.disabledHint": "属性值拖拽当前未启用。下方设置仍可预先配置，启用后生效。",
    "settings.valueDrag.mobileHint":
      "长按属性值并选择“重排或移动”，下一次触摸拖动会立即开始；Obsidian 原生的编辑、从列表中移除和复制操作仍然保留。",
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
      "名称排序依次显示数字、拉丁字母、按拼音排列的中文和其他字符；笔记数是包含该属性的笔记数量，相同时按名称排序；最近使用记录仅保存在本设备，未记录的属性按名称排序。",
    "settings.keyOrder.sortMode.nameOption": "按名称排序",
    "settings.keyOrder.sortMode.recent": "按最近使用排序",
    "settings.keyOrder.sortMode.usage": "按包含该属性的笔记数排序",
    "settings.keyOrder.recentHistory.name": "最近使用记录",
    "settings.keyOrder.recentHistory.desc":
      "清除当前 Vault 中仅保存在本设备、供最近使用排序使用的属性名称记录。之后会从新的使用重新积累。",
    "settings.keyOrder.recentHistory.clear": "清除记录",
    "settings.keyOrder.pinned.name": "置顶属性名称",
    "settings.keyOrder.pinned.desc":
      "每行一个属性名称或规则。可使用 * 作为通配符。匹配到的属性名称会按规则顺序显示在最上方。",
    "settings.keyOrder.bottom.name": "置底属性名称",
    "settings.keyOrder.bottom.desc":
      "每行一个属性名称或规则。可使用 * 作为通配符。匹配到的属性名称会按规则顺序显示在最下方。",
    "settings.keyOrder.hidden.name": "隐藏属性名称规则",
    "settings.keyOrder.hidden.desc": "每行一个规则。可使用 * 作为通配符，例如 TQ_*。",
    "settings.keyOrder.ruleDiagnostic.name": "测试属性名称规则",
    "settings.keyOrder.ruleDiagnostic.desc":
      "输入一个属性名称，查看命中的隐藏、置顶与置底规则，以及最终生效结果。",
    "settings.keyOrder.ruleDiagnostic.placeholder": "属性名称…",
    "settings.keyOrder.ruleDiagnostic.empty": "输入属性名称以测试当前规则。",
    "settings.keyOrder.ruleDiagnostic.hidden": "结果：隐藏",
    "settings.keyOrder.ruleDiagnostic.pinned": "结果：置顶",
    "settings.keyOrder.ruleDiagnostic.bottom": "结果：置底",
    "settings.keyOrder.ruleDiagnostic.normal": "结果：普通；未命中规则",
    "settings.keyOrder.ruleDiagnostic.hiddenMatch": "隐藏规则",
    "settings.keyOrder.ruleDiagnostic.pinnedMatch": "置顶规则",
    "settings.keyOrder.ruleDiagnostic.bottomMatch": "置底规则",
    "settings.keyOrder.ruleDiagnostic.priority": "优先级：隐藏 > 置顶 > 置底",
    "settings.keyOrder.addExisting.placeholder": "添加已有属性名称...",
    "menu.reorder": "重排",
    "menu.reorderOrMove": "重排或移动",
    "settings.diagnostics.name": "显示诊断提示",
    "settings.diagnostics.desc": "当属性值无法重排时显示额外提示，便于排查原因。",
    "settings.saveStatus.failed": "设置未能保存，当前更改仅在本次会话中生效。",
    "settings.saveStatus.retry": "重试保存",
    "notice.reorderFailed": "Property Order：写回失败，未能重排属性值。",
    "notice.writebackDiverged":
      "Property Order：编辑器返回了非预期结果，请先在源码模式检查笔记再继续操作。",
    "notice.persistenceFailed":
      "Property Order：属性值已在编辑器中更新，但无法安排保存。继续操作前请手动保存笔记。",
    "notice.propertiesRefreshNeeded":
      "Property Order：值已写入，但属性面板尚未刷新。",
    "notice.propertiesRefreshAction": "刷新属性面板",
    "notice.propertiesRefreshSucceeded": "Property Order：属性面板已刷新。",
    "notice.propertiesRefreshFailed":
      "Property Order：仍无法刷新属性面板，请重新打开笔记后再拖拽。",
    "notice.propertiesOutOfSync":
      "Property Order：属性面板与笔记内容不同步，请重新打开笔记后再拖拽。",
    "notice.contentChanged": "Property Order：拖拽期间内容发生变化，请重试。",
    "notice.activeFileChanged": "Property Order：当前笔记已切换，请重试。",
    "notice.noFrontmatter": "Property Order：当前笔记未找到 frontmatter。",
    "notice.propertyNotFound": "Property Order：frontmatter 中未找到该属性。",
    "notice.unsupportedProperty": "Property Order：该属性格式暂不支持重排。",
    "notice.targetNotList": "Property Order：无法将值移动到“{property}”：目标不是列表属性。",
    "notice.unsupportedContext": "Property Order：无法识别该属性值组件，建议更新 Obsidian 或主题。",
    "notice.settingsSaveFailed": "Property Order：设置保存失败，请重试。",
    "notice.recentHistoryCleared": "Property Order：最近使用记录已清除。",
    "notice.recentHistoryClearFailed":
      "Property Order：无法清除已保存的最近使用记录。本次会话中已清除，但重启后可能恢复。",
    "notice.mobileReorderArmed":
      "Property Order：现在拖动已选中的值；点击其他位置或等待即可取消。",
  },
  "zh-TW": {
    "settings.tabsLabel": "Property Order 設定分類",
    "settings.tab.general": "一般",
    "settings.tab.valueDrag": "屬性值拖曳",
    "settings.tab.keyOrder": "屬性名稱候選",
    "settings.general.heading": "一般",
    "settings.language.name": "介面語言",
    "settings.language.desc": "選擇「跟隨 Obsidian」可使用 Obsidian 的介面語言。",
    "settings.language.auto": "跟隨 Obsidian",
    "settings.language.en": "English",
    "settings.language.zhCn": "简体中文",
    "settings.language.zhTw": "繁體中文",
    "settings.valueDrag.heading": "屬性值拖曳",
    "settings.valueDrag.enable.name": "啟用屬性值拖曳",
    "settings.valueDrag.enable.desc":
      "允許拖曳多值屬性膠囊並將新順序寫回 frontmatter；行動端需先從原生長按選單選擇重排操作。",
    "settings.valueDrag.disabledHint": "屬性值拖曳目前未啟用。下方設定仍可預先設定，啟用後生效。",
    "settings.valueDrag.mobileHint":
      "長按屬性值並選擇「重排或移動」，下一次觸控拖曳會立即開始；Obsidian 原生的編輯、從清單移除和複製操作仍然保留。",
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
      "名稱排序依次顯示數字、拉丁字母、按拼音排列的中文和其他字元；筆記數是包含該屬性的筆記數量，相同時按名稱排序；最近使用記錄僅儲存在本裝置，未記錄的屬性按名稱排序。",
    "settings.keyOrder.sortMode.nameOption": "按名稱排序",
    "settings.keyOrder.sortMode.recent": "按最近使用排序",
    "settings.keyOrder.sortMode.usage": "按包含該屬性的筆記數排序",
    "settings.keyOrder.recentHistory.name": "最近使用記錄",
    "settings.keyOrder.recentHistory.desc":
      "清除目前 Vault 中僅儲存在本裝置、供最近使用排序使用的屬性名稱記錄。之後會從新的使用重新累積。",
    "settings.keyOrder.recentHistory.clear": "清除記錄",
    "settings.keyOrder.pinned.name": "置頂屬性名稱",
    "settings.keyOrder.pinned.desc":
      "每行一個屬性名稱或規則。可使用 * 作為萬用字元。匹配到的屬性名稱會按規則順序顯示在最上方。",
    "settings.keyOrder.bottom.name": "置底屬性名稱",
    "settings.keyOrder.bottom.desc":
      "每行一個屬性名稱或規則。可使用 * 作為萬用字元。匹配到的屬性名稱會按規則順序顯示在最下方。",
    "settings.keyOrder.hidden.name": "隱藏屬性名稱規則",
    "settings.keyOrder.hidden.desc": "每行一個規則。可使用 * 作為萬用字元，例如 TQ_*。",
    "settings.keyOrder.ruleDiagnostic.name": "測試屬性名稱規則",
    "settings.keyOrder.ruleDiagnostic.desc":
      "輸入一個屬性名稱，查看符合的隱藏、置頂與置底規則，以及最終生效結果。",
    "settings.keyOrder.ruleDiagnostic.placeholder": "屬性名稱…",
    "settings.keyOrder.ruleDiagnostic.empty": "輸入屬性名稱以測試目前規則。",
    "settings.keyOrder.ruleDiagnostic.hidden": "結果：隱藏",
    "settings.keyOrder.ruleDiagnostic.pinned": "結果：置頂",
    "settings.keyOrder.ruleDiagnostic.bottom": "結果：置底",
    "settings.keyOrder.ruleDiagnostic.normal": "結果：一般；未符合規則",
    "settings.keyOrder.ruleDiagnostic.hiddenMatch": "隱藏規則",
    "settings.keyOrder.ruleDiagnostic.pinnedMatch": "置頂規則",
    "settings.keyOrder.ruleDiagnostic.bottomMatch": "置底規則",
    "settings.keyOrder.ruleDiagnostic.priority": "優先順序：隱藏 > 置頂 > 置底",
    "settings.keyOrder.addExisting.placeholder": "新增既有屬性名稱...",
    "menu.reorder": "重排",
    "menu.reorderOrMove": "重排或移動",
    "settings.diagnostics.name": "顯示診斷提示",
    "settings.diagnostics.desc": "當屬性值無法重排時顯示額外提示，便於排查原因。",
    "settings.saveStatus.failed": "設定未能儲存，目前變更僅在本次工作階段中生效。",
    "settings.saveStatus.retry": "重試儲存",
    "notice.reorderFailed": "Property Order：寫回失敗，未能重排屬性值。",
    "notice.writebackDiverged":
      "Property Order：編輯器傳回非預期結果，請先在原始碼模式檢查筆記再繼續操作。",
    "notice.persistenceFailed":
      "Property Order：屬性值已在編輯器中更新，但無法安排儲存。繼續操作前請手動儲存筆記。",
    "notice.propertiesRefreshNeeded":
      "Property Order：值已寫入，但屬性面板尚未重新整理。",
    "notice.propertiesRefreshAction": "重新整理屬性面板",
    "notice.propertiesRefreshSucceeded": "Property Order：屬性面板已重新整理。",
    "notice.propertiesRefreshFailed":
      "Property Order：仍無法重新整理屬性面板，請重新開啟筆記後再拖曳。",
    "notice.propertiesOutOfSync":
      "Property Order：屬性面板與筆記內容不同步，請重新開啟筆記後再拖曳。",
    "notice.contentChanged": "Property Order：拖曳期間內容發生變化，請重試。",
    "notice.activeFileChanged": "Property Order：目前筆記已切換，請重試。",
    "notice.noFrontmatter": "Property Order：目前筆記未找到 frontmatter。",
    "notice.propertyNotFound": "Property Order：frontmatter 中未找到該屬性。",
    "notice.unsupportedProperty": "Property Order：該屬性格式暫不支援重排。",
    "notice.targetNotList": "Property Order：無法將值移動到「{property}」：目標不是清單屬性。",
    "notice.unsupportedContext": "Property Order：無法識別該屬性值元件，建議更新 Obsidian 或佈景主題。",
    "notice.settingsSaveFailed": "Property Order：設定儲存失敗，請重試。",
    "notice.recentHistoryCleared": "Property Order：最近使用記錄已清除。",
    "notice.recentHistoryClearFailed":
      "Property Order：無法清除已儲存的最近使用記錄。本次工作階段中已清除，但重新啟動後可能恢復。",
    "notice.mobileReorderArmed":
      "Property Order：現在拖曳已選取的值；點擊其他位置或等待即可取消。",
  },
} as const satisfies Record<ResolvedPluginLocale, TranslationDictionary>;

export function getResolvedLocaleCode(
  language: PluginLanguage = "auto",
  obsidianLanguage = getLanguage(),
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

export function getTranslation(locale: ResolvedPluginLocale, key: TranslationKey): string {
  return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;
}

export function t(key: TranslationKey, language: PluginLanguage = "auto"): string {
  return getTranslation(getResolvedLocaleCode(language), key);
}
