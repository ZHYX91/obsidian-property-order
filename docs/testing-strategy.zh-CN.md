---
source_language: zh-CN
translation_status: source
---

# Property Order 测试策略

本文定义 Property Order 的当前自动门禁、真实宿主矩阵、发布契约和验证边界。英文版用于同步阅读；若翻译冲突，以本文为准。

## 自动门禁

交付前运行 `npm run check`，顺序执行：

1. 对插件入口与源码执行 Obsidian 官方 `eslint-plugin-obsidianmd` 推荐规则集及已记录的兼容性例外，并对测试、Node 脚本和工具配置执行适合各自环境的静态规则；所有已启用 warning 均阻断；
2. README 导航与全部稳定中英文文档的 frontmatter、标题层级、关键 token、表格形状和相对链接契约；
3. TypeScript 严格类型检查；
4. 当前完整 Vitest suite；
5. production bundle；
6. bundle 可重现性以及静态资产、manifest 和版本契约审计。

Lint 使用当前 Obsidian API typings，兼容性仍以 `manifest.json` 为契约。只有在多窗口支持需要目标 `ownerDocument` 时才保留原生 DOM 创建。设置页采用双路径支持：Obsidian 1.12.x 保留 imperative 三页签 UI，1.13+ 使用原生声明式页面与搜索。自动契约必须证明两套定义覆盖同一组持久化设置、保留自定义规则编辑器，并且声明式搜索索引构建期间不遍历 Vault。

测试按职责分布在 `tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/`、`tests/app/` 和 `tests/scripts/`。固定契约覆盖：

- flow/block/empty、宿主文本列表下 scalar source/target 与全部元素规范化、原始 number/boolean/null token 文本化、重复值保留、重复属性键拒绝、BOM、LF/CRLF/CR、引号、注释、空行和不支持结构 fail closed；
- 桌面 mouse/touch/pen 状态机、移动端原生菜单扩展与单次待拖动状态、四态 drop 解析、空列表与空标量区分、有正面证据的非列表拒绝、经过不提示、松手单次 Notice、noop、取消、内容冲突、pane/file/editor/DOM 身份、未保存编辑内容、以原始文本为统一坐标的单次原子 editor transaction、1.12.x 精确 `"set"` origin 兼容、忽略/抛错/部分应用/divergence 且不自动回滚、只抑制坐标匹配的拖拽尾随 click 而保留无关点击、宿主事件循环后与 `setViewData()` 后的文档身份复核、blur 清理拖拽 UI 后仍保存精确提交、精确核对后才调用 `requestSave()`、保存调度失败的独立结果与 Notice、正常及类型不匹配列表 UI 对账、受守卫 `metadataEditor.synchronize()` 的成功/缺失/抛错/宿主归属错误/同步后文本 divergence、可点击刷新重试的单次性与卸载/换页失效、多个 pane 的恢复操作互不清除，以及不调用原生属性 setter、不 Vault 直写、不手工修改宿主 pill DOM；
- 精确提交后的首次 editor focus、宿主重建丢焦后的受守卫二次恢复、提交前或提交后用户主动转焦时不抢回、noop/拒绝/冲突/事务未生效时不聚焦、保存调度失败但 buffer 已提交时仍可撤销，以及异步对账和手动刷新期间 original/committed undo-redo 状态不误报 divergence；
- Properties 与候选 DOM adapter、可见候选排序、全部隐藏、键盘导航、焦点离开、无菜单时 usage 缓存失效不触发 Vault 扫描和 fail open；
- settings 迁移、即时生效、保存失败、Retry、1.13 之前的页签语义、1.13 声明式页面与搜索、自定义控件存储和窄屏 CSS；
- release 标签、三个官方附件、手动安装 ZIP 和幂等 Release 更新。

`npm run test:coverage` 是独立的诊断命令，使用 V8 coverage 并显式包含 `main.ts` 与 `src/**/*.ts`，使没有被任何测试导入的运行时代码仍以 0% 出现在源清单中。当前不以仓促设置的全局百分比阈值阻断 `npm run check`；覆盖率报告用于发现遗漏文件和指导针对性测试，不能替代真实宿主证据。

可注入的故障路径以自动测试为主证据，包括：设置保存拒绝、宿主 DOM 不匹配、选择同步失败、Escape/blur、组件消失、外部内容冲突和异步乱序。真实宿主用于确认 Obsidian 实际 DOM、输入、视觉和磁盘结果，不重复伪造难以稳定注入的失败。

## 隔离 Vault

真实验收只使用隔离 Vault，不修改生产笔记。夹具命令：

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --initialize-types
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --mode <source|target|unrelated|body> --expected-sha256 <sha256> --delay-ms 55
```

脚本必须验证目标位于允许的临时验收根目录，并具有由初始化流程生成的专用 marker、run ID 与夹具哈希清单；普通或生产 Vault 即使包含 `.obsidian` 也必须拒绝。夹具重置与冲突注入先暂存唯一锁文件，再以 exclusive hard-link 取得 canonical per-Vault 锁，并让它覆盖完整的 marker＋夹具事务；已有锁或旧锁一律 fail closed，必须人工核查后移除。canonical 锁、marker、新建的 `types.json` 和夹具都不得在独立核对后直接删除或覆盖：必须先把当前路径移入同卷私有目录，复核 held 文件的身份与 SHA-256，再用 exclusive hard-link 安装或恢复；夹具回滚也先隔离当前目标再 exclusive 恢复。因此在受守卫的替换或清理边界到达的 pathname writer，只能留在 canonical 目标或错误中报告的保留路径。成功路径清理 staging 时必须再次逐个核对 held inode、禁止递归删除，并保留与报告通过已打开句柄改写的旧夹具；该保证无法阻止非协作进程在最后一次核对之后继续通过旧句柄写入。无法证明回滚或清理安全时，全部唯一备份必须留在 Vault，错误信息必须列出精确路径；marker 已核对提交后的 cleanup 失败只报告保留路径，不得把提交反向解释成未完成。fixtures 与 conflict CLI 都必须在访问 Vault 前拒绝未知、重复或缺值 flag；冲突延迟还只接受 `0` 至 `0x7fffffff` 的 safe integer。六份夹具覆盖 LF/CRLF/CR、普通与空列表、已确认非列表、标量和混合类型不匹配行、注释、引号、重复值、无关内容及所有冲突模式。类型初始化必须显式且独占；已有兼容 `.obsidian/types.json` 保持字节不变，缺键、类型冲突、JSON 损坏、链接或非普通文件都必须在写入笔记前失败。真实 editor 场景从磁盘核对最终 YAML、正文保持、单步撤销/重做，以及部署产物和夹具 SHA-256，并单独记录宿主的换行序列化。

## 真实宿主发布矩阵

桌面 Obsidian 必须验证：

- 插件启用、停用、重载和完整重启；
- 同属性前移/后移/首位/末位/noop，以及跨属性开启和关闭；宿主定义的列表在 YAML 为 `[]`、空值或受支持标量时都可参与移动，真实类型不匹配 DOM 中的单标量 source 可拖出、已对齐标量或无歧义混合 target 可拖入，陈旧、不可读、有歧义或混合 source 都拒绝，所有成功操作按 `preserve`/`flow`/`block` 规范化受影响元素，noop 不格式化，宿主非列表目标拒绝移动；
- 多 leaf、跨文件拒绝、真实内容冲突和 `preserve`/`flow`/`block` 写回；
- 非列表目标在深浅主题下显示警示轮廓与 `not-allowed` 光标、不显示插入线，经过后离开无 Notice，在其上松手只提示一次且不写回；
- 类型不匹配列表行不得出现覆盖警告图标的常驻抓手，警告图标本身也不得显示拖拽光标；同属性拖拽后普通 Properties 必须立即显示新顺序并可再次拖拽。故意阻断自动重建时，Notice 的“刷新属性面板”只能刷新原 pane，多个 pane 的恢复 Notice 互不清除，成功后消失，失败后才提示重开；按钮必须跟随点击时的合法 undo/redo 状态，不得产生第二次 transaction、保存请求或 YAML 变化；
- 每次成功的同属性或跨属性拖拽都无需先点击正文即可立即用一次 `Ctrl+Z` 撤销并用一次 redo 重做，所有受影响属性必须共同恢复，Properties、editor 与磁盘状态一致；还要等待至少 3 秒让延迟保存结束后重复撤销/重做，并在发送第二次历史快捷键之前确认第一次快捷键已经改变可见 Properties。立即撤销后可再次拖拽且不出现不同步提示；对账完成前主动聚焦其他输入、pane 或窗口时插件不得抢回焦点。写回后至少等待 3 秒再核对磁盘 YAML 与 SHA-256，避免把宿主延迟保存误判为未持久化；
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
- 每个候选构建的验收记录必须分层列出：提交与版本身份、三个部署产物及安装 ZIP 的 SHA-256、自动门禁结果、逐宿主/设备的真实验收证据，以及仍未取得的视觉、输入或平台证据。任何一层都不得由另一层推断，Release 说明也不得把未取得的真实宿主或物理设备证据写成已完成。
- 桌面验收使用 Windows 11 下相互隔离的 Obsidian 1.12.7 与当前受支持 1.13.x Vault。两种宿主都必须证明同属性和跨属性无需中间正文点击的立即单步撤销/重做、立即撤销后再次拖拽、主动转焦不被抢回、等待一个宿主事件循环后 editor 与可见 Properties 一致、再等待至少 3 秒后磁盘 YAML 一致、标量不匹配拖拽把手、非列表拒绝及 `preserve`/`flow`/`block` 输出；1.12.7 还覆盖三个旧版设置页签，当前 1.13.x 覆盖原生页面导航、设置搜索、自定义规则编辑器、条件控件、语言重渲染、持久化和 Retry。
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

安装 ZIP 必须固定条目顺序、时间、权限和无关 metadata，使相同输入得到相同字节。仓库必须预先启用匹配发布版本标签的 active tag ruleset，同时限制 update 与 delete，且 release actor 不得具有 bypass；这是阻断“核对与发布之间”竞态的外部发布前提，workflow 不修改该规则。workflow 在查询 Release 前、创建草稿前、发布草稿前和发布后分别解析远端轻量或 annotated 标签的 commit，并要求它与 push 事件的 `GITHUB_SHA` 一致；标签缺失、歧义、移动或无法解析都必须 fail closed。workflow 还使用仅具有仓库 Administration 只读权限的 `RELEASE_IMMUTABILITY_TOKEN` 确认仓库级 immutable Releases 已启用，但不得修改该设置。精确标签 REST 查询只把 HTTP `404` 视为不存在；鉴权、传输、限流、服务器或响应解析失败都必须 fail closed。若同标签 Release 已存在，它必须报告 `immutable: true`；远端附件名称必须无重复并精确等于三个独立文件与当前版本 ZIP，随后四项逐一哈希完全相同才 no-op。旧的可变 Release 或任一附件缺失、不同、重复、多出都必须要求提升版本。缺失的 Release 先以草稿状态附齐全部附件；发布草稿前必须查询并下载远端四项，复核名称唯一、集合精确且 SHA-256 与候选构建一致；发布为 immutable 后必须再次完成同一远端核对，任何差异都以明确的供应链错误失败，不得只凭客户端上传参数或服务器 immutable 标记推断附件正确。推送任何版本标签前必须确认本地工作区干净、版本标签规则已生效、真实宿主矩阵满足当前产品范围、CI 全绿。发布后下载四个附件并核对标签 commit、版本、ZIP 目录结构和文件哈希。
