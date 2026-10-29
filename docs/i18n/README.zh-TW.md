# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

管理 Obsidian 屬性面板中的候選與清單值。

- **[屬性名稱候選](#屬性名稱候選)**：新增屬性時，置頂、隱藏、分組及排序 `status`、`owner` 等名稱。
- **[屬性值候選](#屬性值候選)**：依屬性設定值候選的顯示方式，也可加入 `todo`、`doing`、`done` 等預設值。
- **[清單值重排與移動](#清單值重排與移動)**：透過拖曳或命令面板重排清單項目，或在同一篇筆記中受支援的屬性之間移動值。

這三項功能彼此獨立。Property Order 管理輸入候選與清單值，不會重新排列筆記中的屬性欄位本身。需要 Obsidian 1.12.7 或更新版本，支援桌面與行動裝置。

## 屬性名稱候選

讓常用屬性名稱更容易在 Obsidian 原生的**新增屬性**候選中找到。

1. 開啟**設定 → Property Order → 屬性名稱候選**。
2. 將常用名稱置頂、偶爾使用的名稱置底，並以完整名稱或萬用字元規則隱藏不需要的名稱。
3. 選擇依名稱、最近使用或筆記數排序。可選的**依屬性類型分組候選**會依 Obsidian 類型分組一般候選，同時保持置頂名稱在前、置底名稱在後。

例如，置頂 `status` 和 `owner`，再隱藏 `legacy_code`。在筆記中開啟**新增屬性**即可查看結果。這些規則只整理 Obsidian 已提供的名稱；置頂名稱不會建立新候選，也不會移動筆記中的欄位。

套用規則前的原生屬性名稱候選：

![自訂前的原生屬性名稱候選](../assets/property-order-key-suggestions-before.png)

同一組候選，將常用名稱置頂並隱藏不需要的名稱後：

![置頂 status 和 owner 並隱藏 legacy_code 後的屬性名稱候選](../assets/property-order-key-suggestions-after.png)

最近使用依已確認新增的先後排序，懸停與瀏覽不計入。依名稱與最近使用排序不會掃描 Vault；依筆記數排序使用快取中繼資料，統計包含各屬性的 Markdown 筆記數。

## 屬性值候選

選擇屬性後，設定其值候選，例如 `status` 的 `todo` 和 `done`。此功能**預設關閉**，與屬性名稱候選彼此獨立。

1. 開啟**設定 → Property Order → 屬性值候選**，啟用**調整屬性值候選**。
2. 為未個別設定的屬性選擇預設行為，或依完整且精確的屬性名稱指定原生順序、按名稱排序、按選擇次數排序、按包含該值的筆記數排序、不提供候選或自訂候選。
3. 若要為 `status` 建立可重複使用的候選清單，新增一張**自訂候選**規則卡片，加入 `status`，再透過**新增預設候選**依序加入 `todo`、`doing` 和 `done`。

![編輯屬性值時顯示自訂的 status 預設候選](../assets/property-order-value-suggestions.png)

自訂候選分為置頂、一般與置底三段。明確設定的預設值即使尚未出現在任何筆記中，仍可作為候選，並依輸入文字篩選。**↔（移到一般）**會取消預設值的固定位置，同時保留該候選；從設定移除預設值不會刪除筆記內容。

選擇次數只在 Obsidian 確認值已寫入後計數。筆記數統計包含該值的 Markdown 筆記，而非你選擇它的次數。**不提供候選**仍允許手動輸入。僅變更候選規則不會修改筆記。

## 清單值重排與移動

直接在屬性面板中重排受支援的頂層 YAML 文字清單值，或將值移到同一篇筆記的另一個清單屬性。跨屬性拖曳預設啟用，可在**屬性值排序**中關閉。

![在屬性之間移動值](../assets/property-order-cross-property-drag.gif)

- **桌面：**將值拖到新位置，或另一個受支援的清單屬性。
- **行動裝置：**長按屬性值，在 Obsidian 原生選單中選擇**重排**或**重排或移動**，再拖曳該值。如果宿主選單無法擴充，原生編輯仍可使用，外掛不會建立仿製選單。
- **鍵盤：**在命令面板執行 **Property Order: 重排屬性值**。選擇來源屬性與值，再上移、下移、移至從 1 開始的指定位置、最前或最後，或移至另一個屬性的末尾。此命令沒有預設快捷鍵。關閉拖曳時仍可使用；跨屬性拖曳開關僅影響指標拖曳。

每次完成的重排或移動只產生一次可復原的編輯。尚未開始更新時，按 **Escape** 或**取消**不會修改筆記；開始更新後請等待完成，需要還原時在編輯器中復原。拖曳支援換行排列、由右至左的介面、受支援面板邊緣的捲動，以及螢幕閱讀器狀態播報。

**重排前請確認值的型別：**受支援文字清單中的非文字值可能轉為字串，例如 `true` 變成 `"true"`，`123` 變成 `"123"`。這會改變值的型別；若依賴數值或布林型別，請檢查結果。

**清單格式預設保留原格式。** 可在**屬性值排序**中選擇中括號清單或每行一項的清單。切換為中括號格式時，可能遺失項目註解或空白行；這些內容重要時請保留原格式。展開**重排後的清單格式**旁的**格式範例**即可比較各選項。

## 安裝

### 社群外掛（建議）

在 Obsidian 中開啟**設定 → 社群外掛 → 瀏覽**，搜尋 **Property Order**，選擇**安裝**並**啟用**。也可開啟其[社群外掛頁面](https://obsidian.md/plugins?id=property-order)。

### 手動安裝與升級

從[最新版本](https://github.com/ZHYX91/obsidian-property-order/releases/latest)下載 `property-order-<version>.zip`，解壓縮至 `Vault/.obsidian/plugins/`。壓縮檔包含 `property-order/` 目錄，以及其中的 `main.js`、`manifest.json` 和 `styles.css`。重新載入 Obsidian 後，在社群外掛中啟用 Property Order。

手動升級時，請備份並保留現有的 `data.json`。只替換 `main.js`、`manifest.json` 和 `styles.css`；僅在明確希望重設全部外掛偏好時才刪除 `data.json`。

## 設定參考

所有受支援的 Obsidian 版本都使用相同的四個設定頁籤：

| 頁籤 | 控制內容 |
| --- | --- |
| **一般** | 外掛語言與選用的診斷提示。**跟隨 Obsidian**使用對應語言；不支援時使用英文。 |
| **屬性值排序** | 同屬性與跨屬性拖曳，以及重排後的清單格式。關閉拖曳不會清除獨立的跨屬性偏好。 |
| **屬性名稱候選** | 名稱的置頂、置底與隱藏；依名稱、最近使用、筆記數排序；可選的屬性類型分組；清除最近記錄與規則測試欄位。 |
| **屬性值候選** | 需主動啟用的預設行為、個別屬性規則、自訂預設值與選擇次數清除。 |

**本頁屬性排列**只調整規則卡片和自訂編輯器中的屬性順序，不改變筆記中的欄位或屬性值候選順序。

介面與 README 支援英文、簡體中文、繁體中文、德文、法文、西班牙文、巴西葡萄牙文、俄文、日文、韓文、越南文與阿拉伯文。

## 相容性與限制

- 屬性值拖曳支援 Obsidian 顯示為文字清單的一般頂層 YAML 屬性行。不支援整份文件寫成 `{ ... }` 映射、物件清單、巢狀清單、多行中括號清單、原始碼模式行拖曳或跨檔案移動。
- Obsidian 將屬性辨識為清單時，空值或單一值也可參與。某些型別不符的列，如果各個值清楚可辨，也能使用；含糊的混合值列會保守處理，可能只允許附加值。
- 鍵盤命令要求目前 Markdown 窗格中有可見且受支援的屬性面板。對話框開啟後，若檔案或值發生變化，請重新開啟命令。
- 自訂預設候選只在屬性面板中編輯值時顯示。若沒有原生候選快顯視窗，外掛可在輸入欄旁顯示預設值。如果無法安全辨識編輯器或原生候選介面，仍可正常輸入或使用原生候選。
- 屬性值排序會在請求 Obsidian 儲存前檢查 YAML。不支援或有衝突的內容保持不變。在 Obsidian 中選擇或編輯屬性可能修改筆記；僅設定候選規則不會。

## 隱私與安全

Property Order 僅在本機運作，不要求帳號、不上傳筆記內容，也不呼叫遠端服務。重排或移動值只修改本次涉及的屬性。

筆記數使用快取的 frontmatter 中繼資料，不會逐篇讀取筆記本文。屬性名稱最近記錄（最多 100 個名稱）與已確認的屬性值選擇次數僅儲存在目前裝置、目前 Vault 的本機儲存空間，與 `data.json` 分開、不會同步，並可從設定中清除。懸停、瀏覽、取消與未確認的編輯都不會更新記錄或計數。

## 開發與支援

使用 Node.js 24.19.0 與 npm 11.17.0。安裝已記錄的相依套件版本，再執行儲存庫檢查：

```bash
npm ci
npm run check
```

- 文件：[產品需求（簡體中文）](../product-requirements.zh-CN.md)、[UX 規範（簡體中文）](../ux-spec.zh-CN.md)、[架構（簡體中文）](../architecture.zh-CN.md)與[測試策略（簡體中文）](../testing-strategy.zh-CN.md)。
- 專案資訊：[變更日誌](../../CHANGELOG.md)、[貢獻指南](../../CONTRIBUTING.md)與[安全政策](../../SECURITY.md)。
- 討論：[Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a)、[Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas)與[Show and tell](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell)。
- 可重現的錯誤與具體功能建議請使用結構化的 [GitHub Issue 表單](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose)。安全漏洞請依[安全政策](https://github.com/ZHYX91/obsidian-property-order/security/policy)私下回報。

公開發文前，請移除私人 Vault 路徑、筆記內容、YAML 屬性值與憑證。

## 授權條款

[MIT](../../LICENSE) © ZhengYX
