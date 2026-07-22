[English](../../README.md) | [简体中文](README.zh-CN.md)

# Property Order

Property Order 用于增强 Obsidian Properties 的排序体验，主要控制两类顺序：

- 属性值顺序：在桌面端的一个属性内拖拽排序，或在受支持的属性之间移动值。
- 属性 key 候选顺序：按规则重排 Obsidian 原生属性 key 候选下拉框。

## 功能特性

- 在桌面端的同一个 Properties 列表内拖拽属性值排序。
- 可选启用同一篇笔记内的跨属性值拖拽。
- 将同属性排序和跨属性移动写回 YAML frontmatter。
- 默认保留每个属性当前的列表格式，也可将受影响的列表统一写成中括号列表或无序列表。
- 增强原生属性 key 候选下拉框，支持置顶、置底、隐藏、按名称排序和使用次数排序规则；键盘导航按最终可见顺序移动。

## 演示

在桌面端的兼容列表属性之间移动值：

![在属性之间移动值](../assets/property-order-cross-property-drag.gif)

配置原生属性名称候选的排序规则：

![属性名称候选设置](../assets/property-order-settings.png)

## 限制

- 只支持 Obsidian Properties 渲染为属性 pill 的顶层 YAML 列表属性。
- 不支持对象列表、嵌套列表、多行 flow sequence、源码模式行拖拽或跨文件移动；这些结构会安全拒绝写回。
- 强制将无序列表转换为中括号列表时，可能丢失列表项注释、空行和其他仅 block 格式可表达的细节。
- 原生 key 候选排序是 soft DOM enhancement。如果 Obsidian 修改候选菜单 DOM，插件应 fail open，保留原生菜单行为。
- 属性值重排目前仅在桌面应用中运行，并依赖指针输入；尚未提供键盘直接重排和屏幕阅读器状态播报。
- 移动端不接管属性值手势，保留 Obsidian 原生长按菜单；属性名称候选排序仍受支持。

## 设置

- 列表写回格式
  - 保留当前格式
  - 统一为中括号列表
  - 统一为无序列表
  - 无序列表转换为中括号列表时，列表项注释和空行可能无法保留。
- 启用跨属性拖拽
  - 默认关闭。
- 增强原生 key 候选
  - 当 Obsidian 原生属性 key 候选下拉框出现时，对其排序和过滤。
- 默认候选排序
  - 按名称排序
  - 使用次数排序
- 置顶 keys / 置底 keys / 隐藏 key 规则
  - 每行一个条目。隐藏规则支持 `*` 通配符，例如 `TQ_*`。

## 手动安装

从[最新版本](https://github.com/ZHYX91/obsidian-property-order/releases/latest)下载 `property-order-<version>.zip`，直接解压到 `Vault/.obsidian/plugins/`。压缩包已经包含 `property-order/` 插件目录及其中的 `main.js`、`manifest.json` 和 `styles.css`；重新加载 Obsidian 后，在社区插件中启用 Property Order。Release 同时保留这三个独立附件，供 Obsidian 自动安装与更新使用。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
npm run check:release
# 或一次执行完整门禁：
npm run check
```

构建产物输出到 `dist/property-order/`。

如需在隔离 Vault 中重复真实 Obsidian 验收，`npm run acceptance:fixtures -- --vault <vault>` 会创建逐字节固定的 LF/CRLF/CR 夹具；`npm run acceptance:conflict -- --vault <vault> --file <fixture>` 会注入定时 source 编辑。两条命令都要求目标是 Obsidian Vault；冲突注入还会解析符号链接、校验 Vault 边界，并只接受 Property Order 生成的夹具文件。覆盖已有夹具需显式传入 `--force`。完整宿主矩阵与证据边界见测试策略。

Property Order 使用版本化设置 schema 和局部 frontmatter 重写。核心解析、排序与指针交互不依赖 Obsidian 或浏览器 DOM。交付改动前应执行 `npm run check`；发布相关改动还必须闭合对应的自动测试和真实 Obsidian 验收项。

## 文档

- 产品需求：[English](../product-requirements.en.md) / [简体中文](../product-requirements.zh-CN.md)
- 架构：[English](../architecture.en.md) / [简体中文](../architecture.zh-CN.md)
- UX 规范：[English](../ux-spec.en.md) / [简体中文](../ux-spec.zh-CN.md)
- 测试策略：[English](../testing-strategy.en.md) / [简体中文](../testing-strategy.zh-CN.md)

中文文档是权威版本。推送与包版本完全一致的 `x.y.z` 标签会触发 Release workflow，发布三个独立的 Obsidian 附件和手动安装压缩包。
