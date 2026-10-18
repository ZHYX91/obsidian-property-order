# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Property Order 讓你在 Obsidian 的屬性面板中拖曳清單值，並設定輸入屬性名稱和屬性值時顯示的候選。

## 示範

在桌面版中，把項目從一個清單屬性拖到同一篇筆記的另一個清單屬性：

![在屬性之間移動值](../assets/property-order-cross-property-drag.gif)

跨屬性拖曳預設開啟，可在「屬性值排序」設定中關閉。

## 功能特色

- 在支援的頂層 YAML 清單屬性中拖曳並調整值的順序。
- 在同一篇筆記的清單屬性之間移動值。跨屬性移動預設開啟，也可以單獨關閉。
- 如果 Obsidian 把空值或單一值顯示為清單屬性，Property Order 也能安全地將值拖入或拖出；數字、布林值等非文字內容會依原本的 YAML 寫法轉成文字。
- 保留每個屬性現有的清單格式，或統一寫成中括號清單、每行一項的清單。每次成功拖曳只產生一次可復原的編輯。
- 支援屬性值換行排列和由右至左的介面；拖到邊緣時可捲動屬性面板，並向螢幕閱讀器播報拖曳狀態變化。
- 調整原生屬性名稱候選：置頂、置底、隱藏，依名稱、最近使用或筆記數排序，也可以依屬性類型分組一般候選。
- 依屬性管理屬性值候選：原生順序、依名稱、依已確認的選擇次數、依筆記數、不提供候選，或自訂候選。
- 自訂候選分成置頂、一般和置底三段。明確設定的預設值，即使尚未出現在任何筆記中，也能繼續作為候選。
- 只有 Obsidian 確認編輯成功後，才更新屬性名稱的最近使用記錄和屬性值選擇次數；單純停留、瀏覽、取消或尚未確認的編輯都不會計入。
- 如果外掛無法安全理解 YAML 或 Obsidian 的候選介面，就保持筆記或原生介面不變。

## 使用需求與相容性

- 需要 Obsidian 1.12.7 或更新版本。
- 桌面版支援直接拖曳；行動版需先從 Obsidian 原生長按選單選擇相應操作，再開始拖曳。
- 屬性值拖曳只處理 Obsidian 識別為文字清單的頂層 YAML 屬性。屬性值候選通常調整 Obsidian 既有候選的順序；自訂模式還能透過同一個屬性編輯器，提供使用者明確設定的預設候選。詳細範圍見下方「限制」。

## 安裝

### 社群外掛（建議）

在 Obsidian 中開啟**設定 → 社群外掛 → 瀏覽**，搜尋 **Property Order**，選擇**安裝**並**啟用**。也可以先開啟 [Property Order 社群外掛頁面](https://obsidian.md/plugins?id=property-order)。需要手動安裝時，請依下方 ZIP 步驟操作。

### 手動安裝

從[最新版本](https://github.com/ZHYX91/obsidian-property-order/releases/latest)下載 `property-order-<version>.zip`，解壓縮到 `Vault/.obsidian/plugins/`。壓縮檔內含 `property-order/` 目錄，以及其中的 `main.js`、`manifest.json` 和 `styles.css`。重新載入 Obsidian 後，在社群外掛中啟用 Property Order。

### 更新

如果存在 `Vault/.obsidian/plugins/property-order/data.json`，請先備份並保留。只替換 `main.js`、`manifest.json` 和 `styles.css`；只有確定要重設全部外掛偏好時，才刪除 `data.json`。

## 使用方式

1. 在**設定 → 社群外掛**中啟用 Property Order。
2. 開啟一篇含頂層 YAML 清單屬性的筆記，並顯示 Obsidian 屬性面板。
3. 桌面版直接拖曳屬性值；行動版長按屬性值，選擇「重排」或「重排或移動」，再拖曳該值。
4. 在「屬性名稱候選」中設定新增屬性時的名稱候選；如有需要，再啟用「屬性值候選」，以預設設定和個別屬性規則調整 Obsidian 既有的值候選。

**該選哪個設定？** 新增屬性並輸入**屬性名稱**時，**屬性名稱候選**決定 `status`、`owner` 等名稱的置頂、隱藏和排序。選取 `status` 並編輯它的**屬性值**時，**屬性值候選**才負責 `todo`、`done` 等既有值的排序，也可以提供額外設定的預設值。屬性值候選預設關閉；單純調整候選規則不會修改筆記，選取或編輯值後才會寫入。

**範例：為 `status` 新增常用值。** 開啟「屬性值候選」，啟用「調整屬性值候選」，新增一張「自訂候選」規則卡片，再把 `status` 加入其中。在「置頂候選」輸入 `todo`，點選「新增預設候選」，再以同樣方式加入 `doing`、`done`。之後編輯 `status` 時，這些值會依你輸入的文字出現在候選中。要讓預設值參與一般排序，點選該值旁的 **↔（移到一般）**。

## 設定

所有支援的 Obsidian 版本都使用相同的四個設定分頁：

- **一般**：設定外掛語言和選用的診斷提示。介面和 README 支援英文、簡體中文、繁體中文、德文、法文、西班牙文、巴西葡萄牙文、俄文、日文、韓文、越南文及阿拉伯文。選擇「跟隨 Obsidian」時使用對應語言；不支援的語言使用英文。
- **屬性值排序**：設定拖曳後的清單格式、是否允許跨屬性移動，以及拖曳行為。暫時關閉值拖曳不會清除跨屬性移動的偏好。
- **屬性名稱候選**：設定置頂、置底和隱藏規則，並選擇依名稱、最近使用或筆記數排序。選用的屬性類型分組會把一般候選分成文字、清單、數字、核取方塊、日期、日期與時間、標籤、自動 / 未指定；目前的排序方式仍會套用到各組內。
- **屬性值候選**：預設關閉。未單獨設定的屬性使用預設設定；個別屬性可以選擇依名稱、依選擇次數、依筆記數、原生順序、不提供候選，或自訂候選。
- 自訂候選使用置頂、一般和置底三段。可以直接輸入預設值，因此某個值即使尚未出現在筆記中，也能作為候選。
- **本頁屬性排列**只調整規則卡片和自訂編輯器中的屬性順序，不改變筆記中的屬性或候選值順序。
- 屬性名稱的最近使用記錄最多保留 100 個名稱；屬性值選擇次數也只儲存在目前裝置。兩者都與 `data.json` 分開儲存、不會同步，並可在設定中清除。

## 限制

- 屬性值拖曳只支援 Obsidian 顯示為文字清單的頂層 YAML 屬性。
- 不支援物件清單、巢狀清單、跨多行的中括號清單、原始碼模式中的行拖曳，或跨檔案移動。
- 行動版需先從 Obsidian 原生長按選單選擇「重排」或「重排或移動」，再拖曳該值。「編輯」「從清單中移除」「複製」等原生操作仍然可用。
- 某些顯示「類型不符」的屬性，只要 Obsidian 明確識別為清單，仍可參與拖曳。如果介面把多個值合在同一個輸入欄位中，外掛不會猜測要拖曳哪個值；能夠核對內容時，只允許將新值加到最後。
- 自訂預設候選只會在屬性面板中編輯值時顯示。如果 Obsidian 沒有開啟候選視窗，外掛可以在輸入欄位旁顯示預設值；無法安全識別輸入欄位時，你仍可正常輸入。
- 把每行一項的清單轉成中括號清單時，可能無法保留中括號語法不能表達的項目註解和空白行。
- 目前無法直接以鍵盤重排屬性值；指標拖曳會向螢幕閱讀器播報拖曳狀態變化。

## 隱私與安全

Property Order 完全在本機運作，不需要帳號、不上傳筆記內容，也不呼叫遠端服務。

拖曳只會修改這次涉及的屬性。外掛會檢查結果，再請 Obsidian 儲存筆記；無法安全處理的內容不會寫入。

使用「依筆記數」排序時，外掛會列舉 Markdown 筆記，但只讀取 Obsidian 快取的屬性資料，不會逐篇讀取正文。屬性名稱的最近使用記錄和屬性值選擇次數只儲存在目前裝置、目前儲存庫的本機儲存空間中，與 `data.json` 分開、不會同步，並可在設定中清除。

## 開發

使用 Node.js 24.19.0 與 npm 11.17.0。安裝 `package-lock.json` 中記錄的相依套件版本，再執行專案的全部檢查：

```bash
npm ci
npm run check
```

### 文件

產品、UX、架構與測試文件以簡體中文維護，並提供英文對照。

- [產品需求（簡體中文）](../product-requirements.zh-CN.md)
- [UX 規範（簡體中文）](../ux-spec.zh-CN.md)
- [架構（簡體中文）](../architecture.zh-CN.md)
- [測試策略（簡體中文）](../testing-strategy.zh-CN.md)
- [變更記錄（English）](../../CHANGELOG.md)
- [貢獻指南（English）](../../CONTRIBUTING.md)
- [安全政策（English）](../../SECURITY.md)

## 支援

- [Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a)：使用與設定問題。
- [Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas)：尚待討論的功能和工作流程構想。
- [Show and tell](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell)：技巧、工作流程與參考實作。
- 可重現的錯誤和明確的功能建議，請使用結構化的 [GitHub Issue 表單](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose)。
- 安全漏洞請依儲存庫的[安全政策](https://github.com/ZHYX91/obsidian-property-order/security/policy)私下回報。

公開發文前，請移除私人儲存庫路徑、筆記內容、YAML 屬性值和憑證。

## 授權條款

[MIT](../../LICENSE) © ZhengYX
