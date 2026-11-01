# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

控制 Obsidian 属性面板中的候选和值列表。

- **[属性名候选](#属性名候选)**：新增属性时，置顶、隐藏、分组和排序 `status`、`owner` 等名称。
- **[属性值候选](#属性值候选)**：按属性设置值候选的显示方式，也可添加 `todo`、`doing`、`done` 等预设值。
- **[列表值重排与移动](#列表值重排与移动)**：通过拖动或命令面板重排列表项目，或在同一篇笔记的受支持属性之间移动值。

这三项功能彼此独立。Property Order 管理输入候选和列表值，不会重新排列笔记中的属性字段本身。需要 Obsidian 1.12.7 或更高版本，支持桌面端和移动端。

## 属性名候选

让常用属性名在 Obsidian 原生的**添加属性**候选中更容易找到。

1. 打开**设置 → Property Order → 属性名候选**。
2. 置顶常用名称，把偶尔使用的名称置底，并用精确名称或通配符规则隐藏不需要的名称。
3. 选择按名称、最近使用或笔记数排序。可选的**属性类型分组**会按 Obsidian 类型分组普通候选，同时保留置顶名称在前、置底名称在后。

例如，置顶 `status` 和 `owner`，再隐藏 `legacy_code`。在笔记中打开**添加属性**即可查看效果。这些规则只整理 Obsidian 已有的名称候选；置顶名称不会创建新候选，也不会移动笔记中的字段。

应用规则前的原生属性名候选：

![自定义前的原生属性名候选](../assets/property-order-key-suggestions-before.png)

同一组候选，置顶常用名称并隐藏不需要的名称后：

![置顶 status 和 owner 并隐藏 legacy_code 后的属性名候选](../assets/property-order-key-suggestions-after.png)

最近使用按已确认添加的先后排序，悬停和浏览不计入。按名称和最近使用排序不会扫描 Vault；按笔记数排序使用缓存元数据，统计包含各属性的 Markdown 笔记数。

## 属性值候选

选择属性后，设置其值候选，例如 `status` 的 `todo` 和 `done`。此功能**默认关闭**，与属性名候选相互独立。

1. 打开**设置 → Property Order → 属性值候选**，启用**调整属性值候选**。
2. 为未单独配置的属性设置默认行为，或按精确属性名分配原生顺序、按名称、按选择次数、按笔记数、不提供候选或自定义候选。
3. 要为 `status` 设置可重复使用的候选列表，添加一张**自定义候选**规则卡片，加入 `status`，再通过**添加预设候选**依次添加 `todo`、`doing` 和 `done`。

![编辑属性值时显示自定义的 status 预设候选](../assets/property-order-value-suggestions.png)

自定义候选分为置顶、普通和置底三段。明确配置的预设值即使尚未出现在任何笔记中，也能继续作为候选，并按输入文字筛选。**↔（移到普通）**会取消预设值的固定位置，同时保留该候选；从设置中移除预设值不会删除笔记内容。

选择次数只在 Obsidian 确认值已写入后计数。笔记数统计包含该值的 Markdown 笔记，而不是你选择它的次数。**不提供候选**仍允许手动输入。仅更改候选规则不会修改笔记。

## 列表值重排与移动

直接在属性面板中重排受支持的顶层 YAML 文本列表值，或把值移到同一篇笔记的另一个列表属性。跨属性拖拽默认开启，可在**属性值排序**中关闭。

![在属性之间移动值](../assets/property-order-cross-property-drag.gif)

- **桌面端：**把值拖到新位置，或拖到另一个受支持的列表属性。
- **移动端：**长按属性值，在 Obsidian 原生菜单中选择**重排**或**重排或移动**，再拖动该值。如果宿主菜单无法扩展，原生编辑仍可使用，插件不会创建仿制菜单。
- **键盘：**在命令面板运行 **Property Order: 重排属性值**。选择源属性和值，再上移、下移、移至从 1 开始的指定位置、首位或末位，或移至另一个属性的末尾。此命令没有默认快捷键。关闭拖拽时仍可使用；跨属性拖拽开关只影响指针拖拽。

每次完成的重排或移动只产生一次可撤销的编辑。尚未开始更新时，按 **Escape** 或**取消**不会修改笔记；开始更新后请等待完成，需要还原时在编辑器中撤销。拖拽支持换行排列、从右向左书写的界面、受支持面板边缘的滚动，以及屏幕阅读器状态播报。

**重排前请核对值类型：**受支持文本列表中的非文本值可能转为字符串，例如 `true` 变为 `"true"`，`123` 变为 `"123"`。这会改变值类型；如依赖数值或布尔类型，请核对结果。

**列表格式默认保留原格式。** 可在**属性值排序**中选择中括号列表或每行一项的列表。切换为中括号格式时，可能丢失项目注释或空行；这些内容重要时请保留原格式。展开**重排后的列表格式**旁的**格式示例**，可比较各选项。

## 安装

### 社区插件（推荐）

在 Obsidian 中进入**设置 → 第三方插件 → 浏览**，搜索 **Property Order**，点击**安装**并**启用**。也可打开其[社区插件页面](https://obsidian.md/plugins?id=property-order)。

### 手动安装与升级

从[最新版本](https://github.com/ZHYX91/obsidian-property-order/releases/latest)下载 `property-order-<version>.zip`，解压到 `Vault/.obsidian/plugins/`。压缩包包含 `property-order/` 目录及其中的 `main.js`、`manifest.json` 和 `styles.css`。重新加载 Obsidian 后，在第三方插件中启用 Property Order。

手动升级时，请备份并保留现有的 `data.json`。只替换 `main.js`、`manifest.json` 和 `styles.css`；只有在明确希望重置全部插件偏好时才删除 `data.json`。

## 设置参考

所有受支持的 Obsidian 版本都使用相同的四个设置页签：

| 页签 | 控制内容 |
| --- | --- |
| **常规** | 插件语言和可选诊断提示。**跟随 Obsidian**使用对应语言；不支持时使用英文。 |
| **属性值排序** | 同属性和跨属性拖拽，以及重排后的列表格式。关闭拖拽不会清除单独的跨属性拖拽偏好。 |
| **属性名候选** | 属性名的置顶、置底和隐藏；按名称、最近使用、笔记数排序；可选的属性类型分组；清除最近记录和规则测试框。 |
| **属性值候选** | 需主动启用的默认行为、按属性规则、自定义预设值和选择次数清除。 |

**本页属性排列**只调整规则卡片和自定义编辑器中的属性顺序，不改变笔记中的字段或属性值候选顺序。

界面和 README 支持英文、简体中文、繁体中文、德语、法语、西班牙语、巴西葡萄牙语、俄语、日语、韩语、越南语和阿拉伯语。

## 兼容性与限制

- 属性值拖拽支持 Obsidian 显示为文本列表的普通顶层 YAML 属性行。不支持整段文档写成 `{ ... }` 映射、对象列表、嵌套列表、多行中括号列表、源码模式行拖拽或跨文件移动。
- Obsidian 将属性识别为列表时，空值或单个值也可参与。某些类型不匹配的行，如果各个值清楚可辨，也能使用；含混的混合值行会保守处理，可能只允许追加值。
- 键盘命令要求当前 Markdown 窗格中有可见且受支持的属性面板。对话框打开后，如果文件或值发生变化，请重新打开命令。
- 自定义预设候选只在属性面板中编辑值时显示。如果没有原生候选弹窗，插件可在输入框旁显示预设值。如果无法安全识别编辑器或原生候选界面，仍可正常输入或使用原生候选。
- 属性值排序会在请求 Obsidian 保存前检查 YAML。不支持或存在冲突的内容保持不变。在 Obsidian 中选择或编辑属性可能修改笔记；仅配置候选规则不会。

## 隐私与安全

Property Order 只在本地工作，不要求账号、不上传笔记内容，也不调用远程服务。重排或移动值只修改本次涉及的属性。

按笔记数排序使用缓存的 frontmatter 元数据，不会逐篇读取笔记正文。属性名最近记录（最多 100 个名称）和已确认的属性值选择次数只保存在当前设备、当前 Vault 的本地存储中，与 `data.json` 分离，不会同步，并可从设置中清除。悬停、浏览、取消和未确认编辑都不会更新记录或计数。

## 开发与支持

使用 Node.js 24.19.0 与 npm 11.17.0。安装已记录的依赖版本，再运行仓库检查：

```bash
npm ci
npm run check
```

- 文档：[产品需求](../product-requirements.zh-CN.md)、[UX 规范](../ux-spec.zh-CN.md)、[架构](../architecture.zh-CN.md)和[测试策略](../testing-strategy.zh-CN.md)。
- 项目信息：[变更日志](../../CHANGELOG.md)、[贡献指南](../../CONTRIBUTING.md)和[安全策略](../../SECURITY.md)。
- 讨论：[Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a)、[Ideas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas)和[Show and tell](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell)。
- 可复现缺陷和明确的功能建议请使用结构化的 [GitHub Issue 表单](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose)。安全漏洞请按照[安全策略](https://github.com/ZHYX91/obsidian-property-order/security/policy)私密报告。

公开发布前请移除私人 Vault 路径、笔记内容、YAML 属性值和凭据。

## 许可证

[MIT](../../LICENSE) © ZhengYX
