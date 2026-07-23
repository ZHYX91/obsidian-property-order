# Property Order 测试策略

本文定义 Property Order 0.2.0 的当前自动门禁、真实宿主矩阵、发布契约和证据边界。英文版用于同步阅读；若翻译冲突，以本文为准。

## 自动门禁

交付前运行 `npm run check`，顺序执行：

1. 对插件入口与源码执行 Obsidian 官方 `eslint-plugin-obsidianmd` 推荐规则集及已记录的兼容性例外，所有已启用 warning 均阻断；
2. TypeScript 严格类型检查；
3. 当前完整 Vitest suite；
4. production bundle；
5. release 产物与源码、manifest、版本映射的逐字节一致性审计。

Lint 使用当前 Obsidian API typings，兼容性仍以 `manifest.json` 为契约。只有在多窗口支持需要目标 `ownerDocument` 时才保留原生 DOM 创建。声明式设置定义暂不启用，直到完整的自定义三页签 UI 能在不改变 1.13 之前最低兼容行为的前提下等价表达。

测试按职责分布在 `tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/`、`tests/app/` 和 `tests/scripts/`。固定契约覆盖：

- flow/block/empty、BOM、LF/CRLF/CR、引号、注释、空行、YAML core scalar 类型和不支持结构 fail closed；
- 桌面 mouse/touch/pen 状态机、移动端原生菜单扩展与单次待拖动状态、drop 几何、noop、取消、内容冲突、pane/file 身份和 stale async 防护；
- Properties 与候选 DOM adapter、可见候选排序、全部隐藏、键盘导航、焦点离开和 fail open；
- settings 迁移、即时生效、保存失败、Retry、页签语义与窄屏 CSS；
- release 标签、三个官方附件、手动安装 ZIP 和幂等 Release 更新。

可注入的故障路径以自动测试为主证据，包括：设置保存拒绝、宿主 DOM 不匹配、选择同步失败、Escape/blur、组件消失、外部内容冲突和异步乱序。真实宿主用于确认 Obsidian 实际 DOM、输入、视觉和磁盘结果，不重复伪造难以稳定注入的失败。

## 隔离 Vault

真实验收只使用隔离 Vault，不修改生产笔记。夹具命令：

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --delay-ms 55
```

脚本必须验证目标是 Obsidian Vault、解析真实路径并限制写入范围。每个写回场景从已知夹具开始，并从磁盘核对最终 YAML 与换行字节。

## 真实宿主发布矩阵

桌面 Obsidian 必须验证：

- 插件启用、停用、重载和完整重启；
- 同属性前移/后移/首位/末位/noop，以及跨属性开启和关闭；
- 多 leaf、跨文件拒绝、真实内容冲突和 `preserve`/`flow`/`block` 写回；
- 键候选 pinned/hidden/bottom、name/usage、菜单复用、全部隐藏、hover 后键盘、方向键/Home/End/PageUp/PageDown/Enter/Escape 与焦点离开；
- 设置即时生效、三页签键盘语义、深浅主题和窄窗口布局。

Android 模拟器必须验证：

- 原生“编辑 / 从列表中移除 / 复制”与新增的“重排”或“重排或移动”同时保留；
- 选择新增操作后只把该 pill 置为待拖动状态，下一次同 pill 触摸拖拽可完成重排或移动；点击其他位置、Escape、超时、切后台或停用插件都会干净取消；
- 候选触摸选择、394px 级窄屏设置布局、横竖屏旋转和活动页签显露；
- 前后台恢复、插件停用/重启用，以及无崩溃或 ANR。

## 当前证据边界

- 自动门禁覆盖所有纯规则、可注入故障和发布契约。
- 当前桌面产物已在 Windows 11 / Obsidian 1.12.7 隔离 Vault 中实测：block 与 flow 同属性写回均从磁盘核验；候选 pinned/hidden/bottom 排序、键盘选择与取消、三个设置页签均已覆盖。
- 当前移动产物已在 Android 15 / API 35 独立模拟器 Vault 中实测，production 文件与部署文件的 SHA-256 一致。Obsidian 原生“编辑 / 复制 / 从列表中移除”与“重排或移动”同时存在；真实单指针流程完成同属性重排和跨属性移动，磁盘 YAML 符合预期。点击其他位置会取消待拖动状态且夹具不变，前后台恢复后没有插件错误、崩溃或 ANR。
- 15 秒超时、Escape、宿主菜单不可用时 fail open 以及清理路径由自动测试覆盖，不在常规真实宿主验收中注入。
- 尚无物理 Android 设备证据，因此不声称验证了厂商输入栈、真实触感、物理 pen、系统字体缩放或大 Vault 性能。
- 键盘属性值重排与屏幕阅读器拖拽播报是产品非目标，不列为 0.2.0 发布欠项。
- CR-only 字节保持由自动测试固定；Obsidian 1.12.7 不暴露相应 Properties UI，因此不要求不存在的真实 UI 路径。

## CI 与 Release

CI 在 Node 20 上执行 `npm ci` 和 `npm run check`，并上传 `dist/property-order/`。Release workflow 只接受与 `manifest.json` 完全一致、无 `v` 前缀的 `x.y.z` 标签，重新执行完整门禁后发布：

- `main.js`；
- `manifest.json`；
- `styles.css`；
- `property-order-<version>.zip`，其中只含 `property-order/` 目录与上述三个文件。

首次推送版本标签前必须确认本地工作区干净、真实宿主矩阵满足当前产品范围、CI 全绿。发布后下载四个附件并核对版本、ZIP 目录结构和文件哈希。
