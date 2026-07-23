# Property Order

Property Order 用于安全地重排 Obsidian Properties 中的列表值，并按规则调整原生属性名称候选。

## 演示

在桌面端的兼容列表属性之间移动值：

![在属性之间移动值](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

配置原生属性名称候选排序：

![属性名称候选设置](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-settings.png)

## 功能特性

- 在桌面端重排顶层 YAML 列表属性中的值；
- 可选在同一篇笔记的受支持属性之间移动值；
- 默认保留当前列表格式，也可将受影响的列表写成中括号列表或无序列表；
- 置顶、置底或隐藏原生属性名称候选；
- 按混合语言名称或属性使用次数排序候选；
- 键盘导航始终遵循最终可见的候选顺序；
- 不支持的 YAML 会安全拒绝写回，无法识别 Obsidian 候选 DOM 时保留原生行为。

## 开始使用

1. 在**设置 → 第三方插件**中启用 Property Order；
2. 打开一篇含顶层 YAML 列表属性的笔记，并显示 Obsidian Properties；
3. 拖动属性值进行排序，或在插件设置中启用跨属性拖拽；
4. 按需配置置顶、置底和隐藏属性名称规则。

## 限制

- 属性值拖拽仅支持桌面端；移动端保留 Obsidian 原生长按菜单，属性名称候选排序仍可用；
- 只支持由 Obsidian Properties 渲染为属性 pill 的顶层 YAML 列表；
- 不支持对象列表、嵌套列表、多行 flow sequence、源码模式行拖拽或跨文件移动；
- 将无序列表转换为中括号列表时，可能丢失中括号语法无法表达的项目注释和空行；
- 当前不提供键盘直接重排属性值或屏幕阅读器拖拽播报。

## 手动安装

从[最新版本](https://github.com/ZHYX91/obsidian-property-order/releases/latest)下载 `property-order-<version>.zip`，解压到 `Vault/.obsidian/plugins/`。压缩包已经包含 `property-order/` 目录和三个插件文件。重新加载 Obsidian 后，在第三方插件中启用 Property Order。

## 开发

```bash
npm install
npm run check
```

架构与测试细节见[开发者文档](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/architecture.zh-CN.md)。问题与功能建议可提交到 [GitHub Issues](https://github.com/ZHYX91/obsidian-property-order/issues)。

## English

See the [English README](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md).
