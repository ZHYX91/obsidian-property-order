---
source_language: zh-CN
translation_status: source
---

# Property Order — 测试策略

本文定义 Property Order 的当前自动门禁、真实宿主矩阵、发布契约和验证边界。英文版用于同步阅读；若翻译冲突，以本文为准。

## 自动门禁

交付前运行 `npm run check`，顺序执行：

1. 核对当前 Node.js/npm 与 `.node-version`、`engines.node`、`packageManager` 的精确版本契约；
2. 对插件入口与源码执行 Obsidian 官方 `eslint-plugin-obsidianmd` 推荐规则集及已记录的兼容性例外，强制 `src/core/` 禁止导入 Obsidian runtime 和上层模块，并对测试、Node 脚本和工具配置执行适合各自环境的静态规则；所有已启用 warning 均阻断；
3. 源码、文档与配置的确定性 UTF-8/LF 格式契约，禁止 BOM、NUL、尾随空白和缺失末尾换行；
4. README 导航与全部稳定中英文文档的 frontmatter、标题层级、关键 token、表格形状和相对链接契约；
5. TypeScript 严格类型检查；
6. 带 V8 coverage 的当前完整 Vitest suite；
7. production bundle；
8. bundle 可重现性以及静态资产、manifest、lockfile 和版本契约审计。

Lint 使用当前 Obsidian API typings，兼容性仍以 `manifest.json` 为契约。只有在多窗口支持需要目标 `ownerDocument` 时才保留原生 DOM 创建。所有受支持 Obsidian 版本都使用 imperative 四页签设置界面。自动契约必须证明 declarative definitions 保持为空、保留自定义规则编辑器，并且设置界面构造期间不遍历 Vault。

测试按职责分布在 `tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/`、`tests/app/` 和 `tests/scripts/`。自动回归按领域覆盖：

- **Frontmatter 与写回**：flow、block 和空列表；宿主文本列表下的标量 source/target；number、boolean、null 按原 token 文本转换；重复值保留、重复属性键拒绝；BOM、LF/CRLF/CR、引号、注释、空行，以及不支持结构的安全拒绝。
- **拖拽输入与目标判定**：桌面 mouse/touch/pen、移动端原生菜单和单次待拖动状态；受支持列表、类型不匹配列表、已确认非列表和未知目标；经过非列表目标不提示、在其上松手只提示一次；noop、取消、冲突、pane/file/editor/DOM 身份和未保存编辑内容。
- **提交、保存与恢复**：一次原子 editor transaction、1.12.x 的精确 `"set"` origin、提交前后所有权变化、部分应用与 divergence、只抑制本次拖拽产生的尾随 click、`setViewData()` 后再次核对身份、精确验证后才调用 `requestSave()`，以及保存调度失败的独立提示。
- **Properties 对账**：正常列表和类型不匹配列表的 UI 对账；受守卫的 `metadataEditor.synchronize()` 成功、缺失、抛错、宿主归属错误和同步后文本变化；刷新按钮的失效条件；多个 pane 的恢复操作互不干扰。恢复路径不得使用原生属性 setter、Vault 直写或手工修改宿主 pill DOM。
- **撤销与焦点**：精确提交后让 editor 接管撤销/重做；宿主重建丢焦时只在安全条件下恢复；用户主动转焦后不抢回；noop、拒绝、冲突或未生效事务不强制聚焦；保存调度失败但 buffer 已提交时仍可撤销。
- **属性名候选**：Properties/候选 DOM adapter、限定原 pane 的几何回退、隐藏祖先和计算样式下的可见顺序、键盘导航、全部隐藏、菜单复用、置顶/隐藏/置底优先级、属性类型组顺序、只用于显示的组标题、严格 MRU、笔记数平局、停用/卸载后的原生恢复，以及 DOM 不匹配时保留宿主行为。
- **最近使用记录**：点击和键盘/输入提交意图、Metadata Cache 确认、hover/浏览/取消/失败不记录、文件与 document 身份、超时/删除/卸载清理；recent store 的精确大小写、去重前移、100 项上限、无时间戳格式、损坏/读取失败回退、写入失败时继续当前会话、Vault/设备隔离和清除。名称与 recent 模式不得为了排序遍历 Vault。
- **属性值候选**：每个精确 key 只有一个行为、默认回退、跨分组移动、选择次数与笔记数、Custom 的置顶/普通/置底、预设值精确身份、移除预设不修改笔记、原生弹窗注入、无原生弹窗时的回退弹窗、最终可见键盘顺序、`none` 下保留手动输入、生命周期清理和旧规则迁移。
- **设置**：schema 迁移、非法值归一化、即时生效、保存失败与 Retry、外部设置变化的三方合并、跨实例存储串行化、卸载后拒绝新保存、值拖拽偏好保留、规则卡片和选择器状态、焦点/滚动保持、清除入口和窄屏布局。
- **发布工具链**：精确 Node.js/npm 与 lockfile root、发布 job 权限隔离、默认分支与标签身份、Candidate Bundle 只读传输与 SHA-256、ZIP 输入校验、精确源码 checkout、禁止写权限 job 重新安装依赖或构建、发布串行化、Release 版本/说明预检、四个发布资产的字节与 provenance、HTTP 重试分类和幂等发布。

`npm run check` 通过 `npm run test:coverage` 执行完整 Vitest suite，并使用 V8 coverage 显式包含 `main.ts` 与 `src/**/*.ts`，使没有被任何测试导入的运行时代码仍以 0% 出现在源清单中。统一门禁通过 `vitest.config.mts` 强制全局覆盖率下限：statements 86%、branches 83%、functions 88%、lines 86%。报告用于发现遗漏文件和指导针对性测试；达到阈值仍不能替代真实宿主证据。

`npm run bench:usage` 与 `npm run bench:usage:large` 是独立于 `npm run check` 的确定性 Metadata Cache 微基准，分别构造 10,000 与 50,000 篇缓存笔记，并通过真实缓存路径执行 25 次失效后重扫。输出包括 p50、p95、max、缓存命中耗时、扫描次数和 Metadata Cache 读取次数。

10,000 篇 quick 基准进入 CI 与发布核验，p95 上限为 75 ms；可选的 50,000 篇基准上限为 350 ms。普通 Vitest 还会检查扫描次数：每次未缓存快照只能枚举一次 Markdown 文件，每篇笔记只能读取一次 Metadata Cache，缓存命中不能产生额外读取。

这些数字只是回归警戒线，用来发现重复扫描或超线性退化，不是产品延迟承诺，也不能代表真实 Obsidian 主线程、移动设备或内存表现。需要做性能判断时，应同时记录操作系统、CPU、Node.js、npm 和原始输出；只有真实大 Vault 或重复回归数据明显越过预算时，才考虑引入增量索引。

可注入的故障路径以自动测试为主证据，包括：设置保存拒绝、宿主 DOM 不匹配、选择同步失败、Escape/blur、组件消失、外部内容冲突和异步乱序。真实宿主用于确认 Obsidian 实际 DOM、输入、视觉和磁盘结果，不重复伪造难以稳定注入的失败。

## 隔离 Vault

使用安装精确候选包的临时 Vault。仓库提供 `acceptance/fixtures/Property Order.md`、`Key Suggestions.md`、`Key Type Vocabulary.md` 和 `acceptance/product-scenarios.json`；核对它们与候选绑定的哈希，安装三个候选资产，并仅启用 Property Order。普通或生产 Vault 永远不是合法目标。

这个仓库刻意不提供夹具安装、Vault 重置或冲突注入 CLI。对于场景契约中的受守卫写入冲突步骤，验收控制器先记录临时夹具身份，启动产品操作，执行指定的外部编辑，再记录两个结果字节流及可见的拒绝行为。自动化单元测试仍是注入竞态边界的主要证据；真实宿主证据覆盖 Obsidian DOM、交互、持久化、撤销/重做和可见的 fail-closed 结果。

## 可选宿主回归

按改动选择相关场景。未执行、跳过或失败的宿主检查不阻止明确获授权的发布。

桌面 Obsidian 验证：

- 插件启用、停用、重载和完整重启；
- 同属性前移/后移/首位/末位/noop，以及跨属性开启和关闭；宿主定义的列表在 YAML 为 `[]`、空值或受支持标量时都可参与移动，真实类型不匹配 DOM 中的单标量 source 可拖出、已对齐标量或无歧义混合 target 可拖入，陈旧、不可读、有歧义或混合 source 都拒绝，所有成功操作按 `preserve`/`flow`/`block` 规范化受影响元素，noop 不格式化，宿主非列表目标拒绝移动；
- 多 leaf、跨文件拒绝、真实内容冲突和 `preserve`/`flow`/`block` 写回；
- 非列表目标在深浅主题下显示警示轮廓与 `not-allowed` 光标、不显示插入线，经过后离开无 Notice，在其上松手只提示一次且不写回；
- 类型不匹配列表行不得出现覆盖警告图标的常驻抓手，警告图标本身也不得显示拖拽光标；同属性拖拽后普通 Properties 必须立即显示新顺序并可再次拖拽。故意阻断自动重建时，Notice 的“刷新属性面板”只能刷新原 pane，多个 pane 的恢复 Notice 互不清除，成功后消失，失败后才提示重开；按钮必须跟随点击时的合法 undo/redo 状态，不得产生第二次 transaction、保存请求或 YAML 变化；
- 每次成功的同属性或跨属性拖拽都无需先点击正文即可立即用一次 `Ctrl+Z` 撤销并用一次 redo 重做，所有受影响属性必须共同恢复，Properties、editor 与磁盘状态一致；还要等待至少 3 秒让延迟保存结束后重复撤销/重做，并在发送第二次历史快捷键之前确认第一次快捷键已经改变可见 Properties。立即撤销后可再次拖拽且不出现不同步提示；对账完成前主动聚焦其他输入、pane 或窗口时插件不得抢回焦点。写回后至少等待 3 秒再核对磁盘 YAML 与 SHA-256，避免把宿主延迟保存误判为未持久化；
- wiki link 契约夹具必须在调整任何 alias 规范化规则前记录精确 alias、首尾空白及 NFC/NFD target 与 alias 对应的 `data-href`、`.internal-link` 位置、`.multi-select-pill-content`、原始 `textContent` 码点和是否可拖动；
- 键候选 pinned/hidden/bottom、name/recent/笔记数、菜单复用、全部隐藏、hover 后键盘、方向键/Home/End/PageUp/PageDown/Enter/Escape 与焦点离开；启用类型分组时，最低与当前受支持桌面宿主都必须验证文本/列表/数字/复选框/日期/日期与时间/标签/自动未指定分组、故意未登记类型的 `key_automatic`、不会增加候选停靠点的视觉组标题、只在组内排序，以及停用或卸载后的精确原生恢复；recent 必须分别验证鼠标点击、Enter 和手工输入的成功提交，证明只在 Metadata Cache 确认后推进严格 MRU，hover、浏览、取消或失败不记录，未记录项按名称排序，usage 数值确实等于包含属性的 Markdown 笔记数；
- 最近历史在重载和完整重启后仍保持当前 Vault、当前设备的顺序，另一个 Vault 不继承；清除入口立即恢复名称回退且不修改 `data.json` 或笔记。设置即时生效，并覆盖最低与当前受支持宿主上的四页签界面、深浅主题和窄窗口布局。
- 属性值候选真实宿主验收覆盖全部分组行为及其边界：精确 key 在互斥分组间移动、手动输入与已有 key 选择、默认回退、选择次数与笔记数严格区分、自定义置顶/普通/置底、一个所有夹具笔记都未出现过的预设值、向原生弹窗注入预设与无原生弹窗时的回退弹窗、鼠标/Enter/Tab 选择、Metadata Cache 确认后才增加次数、Escape/转焦/停用/重载 cleanup，以及旧规则迁移的显式确认。既有 `none` 检查仍必须证明手动输入可用，且未修改的 Enter/Tab 不会提交被抑制的候选。

Android 模拟器必须验证：

- 原生“编辑 / 从列表中移除 / 复制”与新增的“重排”或“重排或移动”同时保留；
- 选择新增操作后只把该 pill 置为待拖动状态，下一次同 pill 触摸拖拽可完成重排或移动；点击其他位置、Escape、超时、切后台或停用插件都会干净取消；
- 拖到非列表目标显示拒绝态，在其上松手只提示一次且不写回，离开目标后提示和样式都不残留；
- wiki link 契约夹具必须取得与桌面端相同的原始 target、文本、结构和拖动证据，不能先推断移动端会采用同一规范化行为；
- 候选触摸选择及其成功提交后的 recent 更新、类型分组键候选且视觉组标题不得成为触摸目标、停用增强后的原生恢复、最近历史清除、394px 级窄屏设置布局、横竖屏旋转和活动页签显露；
- 前后台恢复、插件停用/重启用，以及无崩溃或 ANR。

## 验证边界

- 自动门禁覆盖所有纯规则、可注入故障和发布契约。
- 每个候选构建的验收记录必须分层列出：提交与版本身份、三个部署产物及安装 ZIP 的 SHA-256、自动门禁结果、逐宿主/设备的真实验收证据，以及仍未取得的视觉、输入或平台证据。任何一层都不得由另一层推断。
- 桌面验收使用 Windows 11 下相互隔离的 Obsidian 1.12.7 与当前受支持 1.13.x Vault。两种宿主都必须证明同属性和跨属性无需中间正文点击的立即单步撤销/重做、立即撤销后再次拖拽、主动转焦不被抢回、等待一个宿主事件循环后 editor 与可见 Properties 一致、再等待至少 3 秒后磁盘 YAML 一致、标量不匹配拖拽把手、非列表拒绝、`preserve`/`flow`/`block` 输出和 wiki link 宿主契约，并验证 strict MRU 的提交确认、重启持久化、每 Vault 隔离、100 项无时间戳边界与清除。两种宿主还必须覆盖属性类型分组键候选及停用/卸载后的精确原生恢复、四个顶部页签、自定义规则编辑器、条件控件、语言重渲染、持久化和 Retry。
- 全新 CRLF 夹具仅打开时必须保持 CRLF；Property Order editor transaction 与普通正文手动编辑在 Obsidian 1.12.7 下都可能把笔记序列化为 LF。验收应把它归入宿主边界，并验证逻辑正文与单步撤销，而不是追加不可撤销的第二次 Vault 写入。
- Android 验收使用 Android 15 / API 35 独立模拟器 Vault，以 SHA-256 核对部署的生产文件，确认原生“编辑 / 复制 / 从列表中移除”与“重排或移动”共存，验证同属性重排、跨属性移动的磁盘结果、触摸属性名称提交后的 recent 更新与清除，以及取消和前后台恢复期间无插件错误、崩溃或 ANR。
- 桌面端加模拟器矩阵定义完整宿主回归覆盖范围，不构成公开发布门禁。Android 真机和 iOS 不在范围内。
- 15 秒拖拽超时、recent 待确认超时、local storage 读取/写入失败、Escape、宿主菜单不可用时 fail open、RTL 换行目标、有界边缘滚动、拖拽状态清理以及其他清理路径由自动测试覆盖，不在常规真实宿主验收中注入。
- Value suggestions 命中 `none` 时，桌面真实宿主验收必须确认手动输入仍可用，且未修改的 Enter/Tab 不会提交已抑制的原生候选。
- 厂商输入栈、真实触感、物理 pen 等真机专属行为不属于本项目的验收声明。
- 键盘属性值重排继续作为明确的产品非目标。自动 DOM 覆盖验证 polite 拖拽状态节点的创建与清理；只有真实宿主验收记录后才声明辅助技术的实际播报质量。
- 语言契约必须证明“自动”通过公开的 `getLanguage()` API 读取 Obsidian 当前界面语言。最低支持的 Obsidian 版本为 1.12.7，已发布版本的兼容关系以 `versions.json` 为准。
- CR-only 字节保持由自动测试固定；Obsidian 1.12.7 不暴露相应 Properties UI，因此不要求不存在的真实 UI 路径。

## CI 与 Release

CI 与 Release workflow 都从 `.node-version` 使用 Node.js 24.19.0，并通过 `packageManager` 要求 npm 11.17.0；在 `npm ci` 前先核对精确运行时，随后执行 `npm run check`。其中发布产物门会独立重现 bundle，并要求生产 `main.js` 不超过 320,000 B；这是项目回归预算，不是 Obsidian 平台限制。CI 上传 `dist/` 顶层的 `main.js`、`manifest.json` 与 `styles.css`。Release workflow 只接受与 `manifest.json` 完全一致、无 `v` 前缀的 `x.y.z` 版本，重新执行完整门禁后发布：

- `main.js`；
- `manifest.json`；
- `styles.css`；
- `property-order-<version>.zip`，其中只含 `property-order/` 目录与上述三个文件。

安装 ZIP 必须固定条目顺序、时间、权限和无关 metadata，使相同输入得到相同字节。仓库内精确锁定的 release-core 测试执行相同 ZIP 解析与候选校验代码，覆盖必需/可选样式、缺失/额外/非普通项、篡改字节、错误 checksum、越界路径和同版本历史标签冲突。普通 `npm run check` 运行非 tag-aware 校验；`npm run release:check` 才要求干净提交并执行 absent-or-exact 标签门。

仓库内 release-core 3.1.1 runtime 与薄适配器统一管理确定性的 Candidate Bundle 和生成的独立工作流。获授权的稳定版本 tag push 或该 tag 上的手动 publish 派发共用流水线；手动 verify 模式保持只读。CI 安装锁定依赖，执行一次 release:check，验证 Bundle 源码，并固定 artifact ID/digest。写权限发布 job 精确 checkout 标签源码且不持久化凭据，运行其中锁定的仓库发布 adapter，不安装依赖或重新构建。标签中的发布工具属于受信任可执行代码；Candidate Bundle 校验不提供针对恶意发布工具改动的独立隔离。发布核对精确事件、源码、tag、传输字节和 SLSA 构建证明；先下载验证草稿，再发布 immutable Release，最后下载回验。产品验收可选且单独报告，独立克隆无需外部编排。

发布成功后必须从 GitHub 再次读取 immutable 稳定 Release，核对精确四附件、metadata digest、下载字节、ZIP 内外一致性、远端标签和逐项 provenance。同标签仅在全部身份一致时允许 no-op，否则使用更高版本。标签 ruleset 与 immutable Releases 仍需维护者在 workflow 外留证；自动门禁不修改管理员设置。

Actions artifact 的 step output 只接受裸 64 位小写十六进制 SHA-256；REST record 可返回同一裸值或规范 `sha256:` 前缀。下载字节必须重新计算并与固定 output 相同，错误前缀、长度或字节均 fail closed。

工作流合同测试将完整 YAML 与锁定生成器比较，并验证 tag/手动触发、唯一 mode 输入、只读检查、发布权限、固定 Actions、资产传输、构建证明及发布后下载核验。
