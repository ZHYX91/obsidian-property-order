---
source_language: zh-CN
translation_status: source
---

# Property Order 测试策略

本文定义 Property Order 的当前自动门禁、真实宿主矩阵、发布契约和验证边界。英文版用于同步阅读；若翻译冲突，以本文为准。

## 自动门禁

交付前运行 `npm run check`，顺序执行：

1. 对插件入口与源码执行 Obsidian 官方 `eslint-plugin-obsidianmd` 推荐规则集及已记录的兼容性例外，并对测试、Node 脚本和工具配置执行适合各自环境的静态规则；所有已启用 warning 均阻断；
2. TypeScript 严格类型检查；
3. 当前完整 Vitest suite；
4. production bundle；
5. bundle 可重现性以及静态资产、manifest 和版本契约审计。

Lint 使用当前 Obsidian API typings，兼容性仍以 `manifest.json` 为契约。只有在多窗口支持需要目标 `ownerDocument` 时才保留原生 DOM 创建。设置页采用双路径支持：Obsidian 1.12.x 保留 imperative 三页签 UI，1.13+ 使用原生声明式页面与搜索。自动契约必须证明两套定义覆盖同一组持久化设置、保留自定义规则编辑器，并且声明式搜索索引构建期间不遍历 Vault。

测试按职责分布在 `tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/`、`tests/app/` 和 `tests/scripts/`。固定契约覆盖：

- flow/block/empty、宿主文本列表下 scalar source/target 与全部元素规范化、原始 number/boolean/null token 文本化、重复值保留、重复属性键拒绝、BOM、LF/CRLF/CR、引号、注释、空行和不支持结构 fail closed；
- 桌面 mouse/touch/pen 状态机、移动端原生菜单扩展与单次待拖动状态、四态 drop 解析、空列表与空标量区分、有正面证据的非列表拒绝、经过不提示、松手单次 Notice、noop、取消、内容冲突、pane/file/editor/DOM 身份、未保存编辑内容、以原始文本为统一坐标的单次原子 editor transaction、1.12.x 精确 `"set"` origin 兼容、忽略/抛错/部分应用/divergence 且不自动回滚、宿主事件循环后与 `setViewData()` 后的文档身份复核、blur 清理拖拽 UI 后仍保存精确提交、精确核对后才调用 `requestSave()`、保存调度失败的独立结果与 Notice、正常及类型不匹配列表 UI 对账，以及不调用原生属性 setter、不 Vault 直写、不手工修改宿主 pill DOM；
- Properties 与候选 DOM adapter、可见候选排序、全部隐藏、键盘导航、焦点离开、无菜单时 usage 缓存失效不触发 Vault 扫描和 fail open；
- settings 迁移、即时生效、保存失败、Retry、1.13 之前的页签语义、1.13 声明式页面与搜索、自定义控件存储和窄屏 CSS；
- release 标签、三个官方附件、手动安装 ZIP 和幂等 Release 更新。

可注入的故障路径以自动测试为主证据，包括：设置保存拒绝、宿主 DOM 不匹配、选择同步失败、Escape/blur、组件消失、外部内容冲突和异步乱序。真实宿主用于确认 Obsidian 实际 DOM、输入、视觉和磁盘结果，不重复伪造难以稳定注入的失败。

## 隔离 Vault

真实验收只使用隔离 Vault，不修改生产笔记。夹具命令：

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --initialize-types
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --mode <source|target|unrelated|body> --expected-sha256 <sha256> --delay-ms 55
```

脚本必须验证目标是 Obsidian Vault、解析真实路径、拒绝链接与非普通文件，并把写入限制在共享夹具定义中。六份夹具覆盖 LF/CRLF/CR、普通与空列表、已确认非列表、标量和混合类型不匹配行、注释、引号、重复值、无关内容及所有冲突模式。类型初始化必须显式且独占；已有兼容 `.obsidian/types.json` 保持字节不变，缺键、类型冲突、JSON 损坏、链接或非普通文件都必须在写入笔记前失败。真实 editor 场景从磁盘核对最终 YAML、正文保持、单步撤销/重做，以及部署产物和夹具 SHA-256，并单独记录宿主的换行序列化。

## 真实宿主发布矩阵

桌面 Obsidian 必须验证：

- 插件启用、停用、重载和完整重启；
- 同属性前移/后移/首位/末位/noop，以及跨属性开启和关闭；宿主定义的列表在 YAML 为 `[]`、空值或受支持标量时都可参与移动，真实类型不匹配 DOM 中的单标量 source 可拖出、已对齐标量或无歧义混合 target 可拖入，陈旧、不可读、有歧义或混合 source 都拒绝，所有成功操作按 `preserve`/`flow`/`block` 规范化受影响元素，noop 不格式化，宿主非列表目标拒绝移动；
- 多 leaf、跨文件拒绝、真实内容冲突和 `preserve`/`flow`/`block` 写回；
- 非列表目标在深浅主题下显示警示轮廓与 `not-allowed` 光标、不显示插入线，经过后离开无 Notice，在其上松手只提示一次且不写回；
- 每次成功的同属性或跨属性拖拽都可用一次 `Ctrl+Z` 撤销并用一次 redo 重做，所有受影响属性必须共同恢复，且不得覆盖未保存正文；写回后至少等待 3 秒再核对磁盘 YAML 与 SHA-256，避免把宿主延迟保存误判为未持久化；
- 键候选 pinned/hidden/bottom、name/usage、菜单复用、全部隐藏、hover 后键盘、方向键/Home/End/PageUp/PageDown/Enter/Escape 与焦点离开；
- 设置即时生效、三页签键盘语义、深浅主题和窄窗口布局。

Android 模拟器必须验证：

- 原生“编辑 / 从列表中移除 / 复制”与新增的“重排”或“重排或移动”同时保留；
- 选择新增操作后只把该 pill 置为待拖动状态，下一次同 pill 触摸拖拽可完成重排或移动；点击其他位置、Escape、超时、切后台或停用插件都会干净取消；
- 拖到非列表目标显示拒绝态，在其上松手只提示一次且不写回，离开目标后提示和样式都不残留；
- 候选触摸选择、394px 级窄屏设置布局、横竖屏旋转和活动页签显露；
- 前后台恢复、插件停用/重启用，以及无崩溃或 ANR。

## 验证边界

- 自动门禁覆盖所有纯规则、可注入故障和发布契约。
- 桌面验收使用 Windows 11 下相互隔离的 Obsidian 1.12.7 与当前受支持 1.13.x Vault。两种宿主都必须证明同属性和跨属性单步撤销/重做、等待一个宿主事件循环后 editor 与可见 Properties 一致、再等待至少 3 秒后磁盘 YAML 一致、标量不匹配拖拽把手、非列表拒绝及 `preserve`/`flow`/`block` 输出；1.12.7 还覆盖三个旧版设置页签，当前 1.13.x 覆盖原生页面导航、设置搜索、自定义规则编辑器、条件控件、语言重渲染、持久化和 Retry。
- 全新 CRLF 夹具仅打开时必须保持 CRLF；Property Order editor transaction 与普通正文手动编辑在 Obsidian 1.12.7 下都可能把笔记序列化为 LF。验收应把它归入宿主边界，并验证逻辑正文与单步撤销，而不是追加不可撤销的第二次 Vault 写入。
- Android 验收使用 Android 15 / API 35 独立模拟器 Vault，以 SHA-256 核对部署的生产文件，确认原生“编辑 / 复制 / 从列表中移除”与“重排或移动”共存，验证同属性重排、跨属性移动的磁盘结果，以及取消和前后台恢复期间无插件错误、崩溃或 ANR。
- 15 秒超时、Escape、宿主菜单不可用时 fail open 以及清理路径由自动测试覆盖，不在常规真实宿主验收中注入。
- 厂商输入栈、真实触感、物理 pen、系统字体缩放和大 Vault 行为，必须取得物理 Android 证据后才能声称通过。
- 键盘属性值重排与屏幕阅读器拖拽播报继续作为明确的产品非目标。
- 语言契约必须证明“自动”通过公开的 `getLanguage()` API 读取 Obsidian 当前界面语言。最低支持的 Obsidian 版本为 1.12.7，已发布版本的兼容关系以 `versions.json` 为准。
- CR-only 字节保持由自动测试固定；Obsidian 1.12.7 不暴露相应 Properties UI，因此不要求不存在的真实 UI 路径。

## CI 与 Release

CI 在 Node 20 上执行 `npm ci` 和 `npm run check`，并上传 `dist/` 顶层的 `main.js`、`manifest.json` 与 `styles.css`。Release workflow 只接受与 `manifest.json` 完全一致、无 `v` 前缀的 `x.y.z` 标签，重新执行完整门禁后发布：

- `main.js`；
- `manifest.json`；
- `styles.css`；
- `property-order-<version>.zip`，其中只含 `property-order/` 目录与上述三个文件。

推送任何版本标签前必须确认本地工作区干净、真实宿主矩阵满足当前产品范围、CI 全绿。发布后下载四个附件并核对版本、ZIP 目录结构和文件哈希。
