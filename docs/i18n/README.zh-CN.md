# Property Order

[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md)

Property Order 用于安全地重排 Obsidian Properties 中的列表值，并按规则调整原生属性名称候选。

## 演示

在桌面端的受支持顶层 YAML 列表属性之间移动值：

![在属性之间移动值](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

跨属性拖拽默认开启，可在“值拖拽”设置中关闭。

配置原生属性名称候选排序：

![属性名称候选设置](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-settings.png)

截图展示的是 Obsidian 1.12.x 使用的自定义页签设置界面；Obsidian 1.13+ 会把同一组“常规、值拖拽、属性键顺序”设置显示为支持搜索的原生声明式页面。

## 功能特性

- 重排顶层 YAML 列表属性中的值；
- 在同一篇笔记的受支持属性之间移动值，并可在设置中关闭；
- 当 Obsidian 原生 Properties UI 将属性定义为列表时，把 YAML 空值或标量作为文本列表处理，允许安全拖入和拖出，并按原 token 文本规范化所有受影响的非字符串元素；
- 默认保留当前列表格式，也可将所有受影响属性写成中括号列表或无序列表；同属性重排与跨属性移动都通过一次经核对的 editor transaction 提交；
- 置顶、置底或隐藏原生属性名称候选；
- 按混合语言名称或属性使用次数排序候选；
- 键盘导航始终遵循最终可见的候选顺序；
- 不支持的 YAML 会安全拒绝写回，无法识别 Obsidian 候选 DOM 时保留原生行为。

## 开始使用

1. 在**设置 → 第三方插件**中启用 Property Order；
2. 打开一篇含顶层 YAML 列表属性的笔记，并显示 Obsidian Properties；
3. 桌面端直接拖动属性值；移动端长按属性值，选择“重排”或“重排或移动”，再拖动该值；
4. 按需配置置顶、置底和隐藏属性名称规则。

## 限制

- 移动端从 Obsidian 原生长按菜单选择“重排”或“重排或移动”后，再拖动同一个值；“编辑 / 从列表中移除 / 复制”仍保留，单次待拖动状态会自动过期；
- 只支持被 Obsidian 识别为文本列表的顶层 YAML 属性；普通列表使用原生 pill，受守卫的空值或标量不匹配行可作为 source/target，能与当前 YAML 无歧义对齐的混合不匹配行只能接收 append；
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

架构与测试细节见[开发者文档](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/architecture.zh-CN.md)。

一般问题与使用反馈可在 [GitHub Discussions](https://github.com/ZHYX91/obsidian-property-order/discussions) 中交流；可复现缺陷和明确的功能建议请使用结构化的 [GitHub Issue 表单](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose)；安全漏洞请按照仓库的[安全策略](https://github.com/ZHYX91/obsidian-property-order/security/policy)私密报告。公开发布前请移除 Vault 路径、笔记内容、YAML 属性值和凭据。
