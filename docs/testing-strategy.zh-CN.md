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

Lint 使用当前 Obsidian API typings，兼容性仍以 `manifest.json` 为契约。只有在多窗口支持需要目标 `ownerDocument` 时才保留原生 DOM 创建。所有受支持 Obsidian 版本都使用 imperative 三页签设置界面。自动契约必须证明 declarative definitions 保持为空、保留自定义规则编辑器，并且设置界面构造期间不遍历 Vault。

测试按职责分布在 `tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/`、`tests/app/` 和 `tests/scripts/`。固定契约覆盖：

- flow/block/empty、宿主文本列表下 scalar source/target 与全部元素规范化、原始 number/boolean/null token 文本化、重复值保留、重复属性键拒绝、BOM、LF/CRLF/CR、引号、注释、空行和不支持结构 fail closed；
- 桌面 mouse/touch/pen 状态机、移动端原生菜单扩展与单次待拖动状态、四态 drop 解析、空列表与空标量区分、有正面证据的非列表拒绝、经过不提示、松手单次 Notice、noop、取消、内容冲突、pane/file/editor/DOM 身份、未保存编辑内容、以原始文本为统一坐标的单次原子 editor transaction、1.12.x 精确 `"set"` origin 兼容、事务前所有权失效时内容不变、事务后精确内容已应用时归类为未安排持久化、忽略/抛错/部分应用/divergence 且不自动回滚、只抑制坐标匹配的拖拽尾随 click 而保留无关点击、宿主事件循环后与 `setViewData()` 后的文档身份复核、blur 清理拖拽 UI 后仍保存精确提交、精确核对后才调用 `requestSave()`、保存调度失败的独立结果与 Notice、正常及类型不匹配列表 UI 对账、受守卫 `metadataEditor.synchronize()` 的成功/缺失/抛错/宿主归属错误/同步后文本 divergence、可点击刷新重试的单次性与卸载/换页失效、多个 pane 的恢复操作互不清除，以及不调用原生属性 setter、不 Vault 直写、不手工修改宿主 pill DOM；
- 精确提交后的首次 editor focus、宿主重建丢焦后的受守卫二次恢复、提交前或提交后用户主动转焦时不抢回、noop/拒绝/冲突/事务未生效时不聚焦、保存调度失败但 buffer 已提交时仍可撤销，以及异步对账和手动刷新期间 original/committed undo-redo 状态不误报 divergence；
- Properties 与候选 DOM adapter、限定原 pane 的点几何回退、包含隐藏祖先及计算 display/visibility 的可见候选排序、仅候选菜单文本观察且不启用全 document character-data 观察、全部隐藏、键盘导航、焦点离开、置顶/隐藏/置底优先级、严格 MRU 与未记录项名称回退、笔记数平局、菜单复用，以及 DOM 不匹配时 fail open；
- recent tracker 的点击与键盘/输入提交意图、Metadata Cache 成功确认、hover/浏览/取消/失败不记录、文件与 document 身份、超时/删除/卸载清理；recent store 的精确大小写、去重前移、100 项上限、无时间戳版本化格式、畸形或读取失败回退、写入失败 fail open、当前 Vault/设备隔离和清除；名称与 recent 模式零 Vault 遍历，无菜单时 usage 缓存失效也不触发扫描；
- schema 3 到 4 的 settings 迁移、`recent` 合法值、即时生效、保存失败、Retry、公开外部设置回调的三方合并与实时 surface 刷新、跨实例存储串行化、卸载后新保存拒绝、关闭值拖拽时保留跨属性偏好、所有受支持宿主的 imperative 页签都包含三种排序、清除入口与不持久化的规则测试框、自定义控件存储、诊断 cleanup、零 Vault 遍历和窄屏 CSS；
- 精确 Node.js/npm 与 lockfile root 契约、发布 job 读写权限隔离、仓库代码执行前的默认分支与标签身份核对、只读 Candidate Bundle artifact 传输与 SHA-256、裸 action digest 与 REST 前缀兼容、外层/内层恶意 ZIP fail closed、写权限 job 零 checkout/npm/仓库脚本、仓库级发布串行化、真实 Release 版本与说明基线预检、existing no-op 与新发布四资产的字节及精确 signer/repo/ref/commit provenance、发布后 HTTP 重试分类、三个官方附件、手动安装 ZIP 和幂等 Release 更新。

`npm run check` 通过 `npm run test:coverage` 执行完整 Vitest suite，并使用 V8 coverage 显式包含 `main.ts` 与 `src/**/*.ts`，使没有被任何测试导入的运行时代码仍以 0% 出现在源清单中。当前不设置仓促选择的全局百分比阈值；统一门禁仍会生成覆盖率报告，用于发现遗漏文件和指导针对性测试，但不能替代真实宿主证据。

`npm run bench:usage` 与 `npm run bench:usage:large` 是不进入 `npm run check` 的确定性 Metadata Cache 微基准，分别构造 10,000 与 50,000 篇缓存笔记，对真实 `getPropertyKeyUsage()` 预热后采样 25 次并报告 p50、p95、max 与缓存命中耗时。每次性能判断都应把操作系统、CPU、Node.js 与 npm 版本连同原始输出记录在交付证据中。该合成结果尚不足以证明真实 Obsidian 主线程、移动设备或内存表现，也不单独作为定时门禁；只有真实大 Vault 或重复回归数据越过产品预算时，才据此重新评估增量索引。

可注入的故障路径以自动测试为主证据，包括：设置保存拒绝、宿主 DOM 不匹配、选择同步失败、Escape/blur、组件消失、外部内容冲突和异步乱序。真实宿主用于确认 Obsidian 实际 DOM、输入、视觉和磁盘结果，不重复伪造难以稳定注入的失败。

## 隔离 Vault

真实验收只使用隔离 Vault，不修改生产笔记。夹具命令：

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --initialize-types
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --mode <source|target|unrelated|body> --expected-sha256 <sha256> --delay-ms 55
```

脚本必须验证目标位于允许的临时验收根目录，并具有由初始化流程生成的专用 marker、run ID 与夹具哈希清单；普通或生产 Vault 即使包含 `.obsidian` 也必须拒绝。夹具重置与冲突注入先暂存唯一锁文件，再以 exclusive hard-link 取得 canonical per-Vault 锁，并让它覆盖完整的 marker＋夹具事务；已有锁或旧锁一律 fail closed，必须人工核查后移除。canonical 锁、marker、新建的 `types.json` 和夹具都不得在独立核对后直接删除或覆盖：必须先把当前路径移入同卷私有目录，复核 held 文件的身份与 SHA-256，再用 exclusive hard-link 安装或恢复；夹具回滚也先隔离当前目标再 exclusive 恢复。因此在受守卫的替换或清理边界到达的 pathname writer，只能留在 canonical 目标或错误中报告的保留路径。成功路径清理 staging 时必须再次逐个核对 held inode、禁止递归删除，并保留与报告通过已打开句柄改写的旧夹具；该保证无法阻止非协作进程在最后一次核对之后继续通过旧句柄写入。无法证明回滚或清理安全时，全部唯一备份必须留在 Vault，错误信息必须列出精确路径；marker 已核对提交后的 cleanup 失败只报告保留路径，不得把提交反向解释成未完成。fixtures 与 conflict CLI 都必须在访问 Vault 前拒绝未知、重复或缺值 flag；冲突延迟还只接受 `0` 至 `0x7fffffff` 的 safe integer。七份夹具覆盖 LF/CRLF/CR、普通与空列表、已确认非列表、标量和混合类型不匹配行、注释、引号、重复值、无关内容、所有冲突模式，以及精确保留 alias 空白和 Unicode 组合/分解 target 与 alias 的 wiki link。类型初始化必须显式且独占；已有兼容 `.obsidian/types.json` 保持字节不变，缺键、类型冲突、JSON 损坏、链接或非普通文件都必须在写入笔记前失败。真实 editor 场景从磁盘核对最终 YAML、正文保持、单步撤销/重做，以及部署产物和夹具 SHA-256，并单独记录宿主的换行序列化。

## 真实宿主发布矩阵

桌面 Obsidian 必须验证：

- 插件启用、停用、重载和完整重启；
- 同属性前移/后移/首位/末位/noop，以及跨属性开启和关闭；宿主定义的列表在 YAML 为 `[]`、空值或受支持标量时都可参与移动，真实类型不匹配 DOM 中的单标量 source 可拖出、已对齐标量或无歧义混合 target 可拖入，陈旧、不可读、有歧义或混合 source 都拒绝，所有成功操作按 `preserve`/`flow`/`block` 规范化受影响元素，noop 不格式化，宿主非列表目标拒绝移动；
- 多 leaf、跨文件拒绝、真实内容冲突和 `preserve`/`flow`/`block` 写回；
- 非列表目标在深浅主题下显示警示轮廓与 `not-allowed` 光标、不显示插入线，经过后离开无 Notice，在其上松手只提示一次且不写回；
- 类型不匹配列表行不得出现覆盖警告图标的常驻抓手，警告图标本身也不得显示拖拽光标；同属性拖拽后普通 Properties 必须立即显示新顺序并可再次拖拽。故意阻断自动重建时，Notice 的“刷新属性面板”只能刷新原 pane，多个 pane 的恢复 Notice 互不清除，成功后消失，失败后才提示重开；按钮必须跟随点击时的合法 undo/redo 状态，不得产生第二次 transaction、保存请求或 YAML 变化；
- 每次成功的同属性或跨属性拖拽都无需先点击正文即可立即用一次 `Ctrl+Z` 撤销并用一次 redo 重做，所有受影响属性必须共同恢复，Properties、editor 与磁盘状态一致；还要等待至少 3 秒让延迟保存结束后重复撤销/重做，并在发送第二次历史快捷键之前确认第一次快捷键已经改变可见 Properties。立即撤销后可再次拖拽且不出现不同步提示；对账完成前主动聚焦其他输入、pane 或窗口时插件不得抢回焦点。写回后至少等待 3 秒再核对磁盘 YAML 与 SHA-256，避免把宿主延迟保存误判为未持久化；
- wiki link 契约夹具必须在调整任何 alias 规范化规则前记录精确 alias、首尾空白及 NFC/NFD target 与 alias 对应的 `data-href`、`.internal-link` 位置、`.multi-select-pill-content`、原始 `textContent` 码点和是否可拖动；
- 键候选 pinned/hidden/bottom、name/recent/笔记数、菜单复用、全部隐藏、hover 后键盘、方向键/Home/End/PageUp/PageDown/Enter/Escape 与焦点离开；recent 必须分别验证鼠标点击、Enter 和手工输入的成功提交，证明只在 Metadata Cache 确认后推进严格 MRU，hover、浏览、取消或失败不记录，未记录项按名称排序，usage 数值确实等于包含属性的 Markdown 笔记数；
- 最近历史在重载和完整重启后仍保持当前 Vault、当前设备的顺序，另一个 Vault 不继承；清除入口立即恢复名称回退且不修改 `data.json` 或笔记。设置即时生效，并覆盖最低与当前受支持宿主上的三页签界面、深浅主题和窄窗口布局。

Android 模拟器必须验证：

- 原生“编辑 / 从列表中移除 / 复制”与新增的“重排”或“重排或移动”同时保留；
- 选择新增操作后只把该 pill 置为待拖动状态，下一次同 pill 触摸拖拽可完成重排或移动；点击其他位置、Escape、超时、切后台或停用插件都会干净取消；
- 拖到非列表目标显示拒绝态，在其上松手只提示一次且不写回，离开目标后提示和样式都不残留；
- wiki link 契约夹具必须取得与桌面端相同的原始 target、文本、结构和拖动证据，不能先推断移动端会采用同一规范化行为；
- 候选触摸选择及其成功提交后的 recent 更新、最近历史清除、394px 级窄屏设置布局、横竖屏旋转和活动页签显露；
- 前后台恢复、插件停用/重启用，以及无崩溃或 ANR。

## 验证边界

- 自动门禁覆盖所有纯规则、可注入故障和发布契约。
- 每个候选构建的验收记录必须分层列出：提交与版本身份、三个部署产物及安装 ZIP 的 SHA-256、自动门禁结果、逐宿主/设备的真实验收证据，以及仍未取得的视觉、输入或平台证据。任何一层都不得由另一层推断。
- 桌面验收使用 Windows 11 下相互隔离的 Obsidian 1.12.7 与当前受支持 1.13.x Vault。两种宿主都必须证明同属性和跨属性无需中间正文点击的立即单步撤销/重做、立即撤销后再次拖拽、主动转焦不被抢回、等待一个宿主事件循环后 editor 与可见 Properties 一致、再等待至少 3 秒后磁盘 YAML 一致、标量不匹配拖拽把手、非列表拒绝、`preserve`/`flow`/`block` 输出和 wiki link 宿主契约，并验证 strict MRU 的提交确认、重启持久化、每 Vault 隔离、100 项无时间戳边界与清除。两种宿主还必须覆盖三个顶部页签、自定义规则编辑器、条件控件、语言重渲染、持久化和 Retry。
- 全新 CRLF 夹具仅打开时必须保持 CRLF；Property Order editor transaction 与普通正文手动编辑在 Obsidian 1.12.7 下都可能把笔记序列化为 LF。验收应把它归入宿主边界，并验证逻辑正文与单步撤销，而不是追加不可撤销的第二次 Vault 写入。
- Android 验收使用 Android 15 / API 35 独立模拟器 Vault，以 SHA-256 核对部署的生产文件，确认原生“编辑 / 复制 / 从列表中移除”与“重排或移动”共存，验证同属性重排、跨属性移动的磁盘结果、触摸属性名称提交后的 recent 更新与清除，以及取消和前后台恢复期间无插件错误、崩溃或 ANR。
- 桌面端加模拟器矩阵是完整的统一移动发布门禁。Android 真机和 iOS 不在范围内。
- 15 秒拖拽超时、recent 待确认超时、local storage 读取/写入失败、Escape、宿主菜单不可用时 fail open 以及清理路径由自动测试覆盖，不在常规真实宿主验收中注入。
- 厂商输入栈、真实触感、物理 pen 等真机专属行为不属于本项目的验收声明。
- 键盘属性值重排与屏幕阅读器拖拽播报继续作为明确的产品非目标。
- 语言契约必须证明“自动”通过公开的 `getLanguage()` API 读取 Obsidian 当前界面语言。最低支持的 Obsidian 版本为 1.12.7，已发布版本的兼容关系以 `versions.json` 为准。
- CR-only 字节保持由自动测试固定；Obsidian 1.12.7 不暴露相应 Properties UI，因此不要求不存在的真实 UI 路径。

## CI 与 Release

CI 与 Release workflow 都从 `.node-version` 使用 Node.js 24.19.0，并通过 `packageManager` 要求 npm 11.17.0；在 `npm ci` 前先核对精确运行时，随后执行 `npm run check`。其中发布产物门会独立重现 bundle，并要求生产 `main.js` 不超过 320,000 B；这是项目回归预算，不是 Obsidian 平台限制。CI 上传 `dist/` 顶层的 `main.js`、`manifest.json` 与 `styles.css`。Release workflow 只接受与 `manifest.json` 完全一致、无 `v` 前缀的 `x.y.z` 版本，重新执行完整门禁后发布：

- `main.js`；
- `manifest.json`；
- `styles.css`；
- `property-order-<version>.zip`，其中只含 `property-order/` 目录与上述三个文件。

安装 ZIP 必须固定条目顺序、时间、权限和无关 metadata，使相同输入得到相同字节。仓库内精确锁定的 release-core 测试执行相同 ZIP 解析与候选校验代码，覆盖必需/可选样式、缺失/额外/非普通项、篡改字节、错误 checksum、越界路径和同版本历史标签冲突。普通 `npm run check` 运行非 tag-aware 校验；`npm run release:check` 才要求干净提交并执行 absent-or-exact 标签门。

一个仓库级固定 concurrency group 串行化所有版本且不取消在途运行。Release workflow 只响应显式 `workflow_dispatch`，`mode` 默认 `verify`；普通标签 push 不发布。只读 job 在精确版本标签上执行一次独立安装和一次完整 `release:check`，生成含 loose assets、版本 ZIP、`SHA256SUMS` 与 `candidate-bundle.json` 的 Candidate Bundle v3，source-verify 后固定上传当前 run 的 artifact ID 与 server digest。写权限 job 仅在明确 `publish` 时运行，下载后只做 transport verification，并在首次 mutation 前验证标签/commit/tree、便携 acceptance closure、独立 authorization 以及相互绑定的 SHA-256；任何交换、重放、私有路径、字段漂移或候选摘要替代都 fail closed。

发布成功后必须从 GitHub 再次读取 immutable 稳定 Release，核对精确四附件、metadata digest、下载字节、ZIP 内外一致性、远端标签和逐项 provenance。同标签仅在全部身份一致时允许 no-op，否则使用更高版本。标签 ruleset 与 immutable Releases 仍需维护者在 workflow 外留证；自动门禁不修改管理员设置。

Actions artifact 的 step output 只接受裸 64 位小写十六进制 SHA-256；REST record 可返回同一裸值或规范 `sha256:` 前缀。下载字节必须重新计算并与固定 output 相同，错误前缀、长度或字节均 fail closed。

workflow 不再复制发布实现；Bundle 生成、ZIP 解析、source/transport verification、发布边界和发布后核验都调用同一锁定 core。workflow 合同测试另外固定触发条件、精确九个 inputs、权限分层、action commit pin、artifact ID/digest 传输和 publish-only 写 job，防止 YAML 绕过核心边界。
