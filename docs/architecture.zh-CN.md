# Property Order 架构

本文是 Property Order 0.1.0 的权威架构说明。英文版用于同步阅读；实现、测试或英文文档与本文冲突时，以本文定义的边界和契约为准。

## 目标与非目标

插件只增强 Obsidian Properties 的两类顺序：顶层 YAML 列表属性中的值顺序，以及原生属性键候选顺序。0.1.0 提供桌面端同属性拖拽、同笔记跨属性移动、三种 YAML 写回格式和跨平台原生键候选排序；移动应用中的属性值手势保留给 Obsidian。

不支持嵌套列表、对象列表、多行 flow sequence、源码模式拖拽或跨文件移动；这些结构必须 fail closed，不得修改笔记。模块化重构的目标是隔离解析、交互、DOM 和 Vault 边界，不是扩大产品范围或重写整个插件。

## 分层与依赖方向

依赖从外层指向纯核心：

1. `src/core/`：纯 TypeScript 规则，不导入 Obsidian，也不访问浏览器 DOM。
   - `frontmatter/`：定位 frontmatter、解析顶层 flow/block 列表、诊断和局部重写。
   - `suggestions/`：对候选键进行隐藏、去重、置顶、置底和排序；名称比较器是设置页与原生候选菜单共享的唯一排序实现。
   - `interaction/`：指针拖拽状态转换和文档身份守卫。
2. `src/features/`：功能编排。
   - `value-order/`：把状态机动作、drop 几何、DOM 呈现、pane 上下文和写回组合成一次拖拽事务。
   - `key-order/`：监听候选菜单、应用纯排序规则，并把键盘选择桥接到可见候选顺序。
3. `src/obsidian/`：Obsidian 和 DOM 适配边界。
   - `properties-dom.ts`：Properties 容器、pill 和属性名识别。
   - `native-suggest-dom.ts`：原生属性键候选菜单识别。
   - `pane-context.ts`：workspace leaf 与文件解析。
   - `metadata.ts`：通过公开的 Vault 文件枚举与 Metadata Cache 文件缓存，把 top-level frontmatter 转换为候选键/使用次数；设置页和候选控制器共享同一份可失效缓存。该模块也会在拖拽激活时同步捕获受支持的顶层列表值。
4. `src/app/`：插件生命周期、设置持久化和设置页；已有属性名称通过 Obsidian 公开的 `AbstractInputSuggest` 呈现和筛选。
5. `src/shared/`：跨层设置 schema、共享类型和 i18n。

当前项目不为文件数量而额外引入抽象端口目录；`writeback.ts`、`pane-context.ts` 和两个 DOM adapter 已分别形成 Vault、pane 与 Properties surface 的可测试边界。若未来增加端口接口，也必须保持上述依赖方向。

## Frontmatter 局部重写契约

`src/core/frontmatter/index.ts` 只暴露稳定的公开 API，职责由以下文件承担：

- `bounds.ts`：BOM、frontmatter 起止边界和 LF/CRLF/CR 换行识别。
- `property-line.ts`：扫描顶层属性头，安全解码带引号的键，并支持键名中的冒号。
- `flow-list.ts`：中括号列表扫描和安全分隔。
- `block-list.ts`：无序列表项目、注释、空行和项目样式识别。
- `scalar.ts`：标量提取、安全引用和行尾注释分隔。
- `rewrite.ts`：同属性排序、跨属性移动和目标格式选择。
- `diagnostics.ts`、`types.ts`：可诊断结果与共享模型。

写回只替换受影响的 source/target 属性片段，不对整个 YAML 文档 stringify。frontmatter 之外的正文和未受影响属性必须逐字保持；`preserve` 模式还应保留受影响列表可保留的引号、注释、空行、项目样式和原换行。

标量解析与 Obsidian 暴露的 YAML core schema 类型保持一致：null、boolean、number（包括 infinity/NaN）和 string 必须彼此区分。`preserve` 保留原 token 表示；强制 `flow` 或 `block` 时只规范化表示，不得把有类型的标量变成字符串，也不得让有歧义的字符串被 YAML 解析为其他类型。Metadata/writeback 冲突快照同时比较标量类型和规范值。

| 当前格式 | `preserve` | `flow` | `block` |
| --- | --- | --- | --- |
| flow | 保留 flow 和原标量表示 | flow，安全规范化标量 | block，安全规范化标量 |
| block | 保留 block、项目样式、注释和空行 | flow；允许丢弃仅 block 可表达的项目注释/空行 | block；安全规范化并保留可附着注释 |
| empty flow | `[]` | `[]` | 空 block 头 |
| empty block | 空 block 头 | `[]` | 空 block 头 |

属性缺失、不是受支持列表、索引冲突或内容冲突时返回诊断，不写入部分结果。单引号、双引号、带逗号或 `#` 的标量必须安全解析；属性头行尾注释在转换成 flow 时必须保留合法空白分隔。

## 属性值拖拽事务

`core/interaction/pointer-drag.ts` 是纯状态机。它把 mouse/touch/pen 的按下、移动、长按计时、释放和中断转换为 `start`、`cancel`、`finish` 等动作，不访问 DOM。`value-drag-controller.ts` 只编排动作和资源生命周期：

1. 从发起 pill、Properties 容器和 pane 捕获 source 属性、source 索引与文件路径；同时从公开 Metadata Cache 同步捕获受支持的顶层列表值，避免晚返回的异步读取把外部编辑误认为拖拽起点。
2. 由 `drop-targeting.ts` 计算同一 pane 内的目标容器和插入槽；是否允许跨属性在每次事件时读取当前设置。
3. 由 `drag-dom.ts` 管理预览、指示器、cursor class 和乐观 DOM；取消路径必须完全清理。
4. 由 `writeback.ts` 在 `vault.process` 回调内读取最新内容，再验证拖拽开始时捕获的 source/target 值。只有身份和内容守卫都通过才调用纯 frontmatter 重写。

拖拽开始前的异步读取只是补充冲突快照，不能替代激活时的同步 Metadata Cache 快照，也不能作为最终写入基底。活动 leaf/file 改变、source DOM 消失、`pointercancel`、Escape、window blur、noop drop 或内容冲突都必须安全取消，不得把旧状态写入当前文件或其他文件。

`PropertyValueOrderController` 在移动应用中不注册任何 document listener，插件也不添加可拖拽 pill 的 body class，因此 Obsidian 原生属性值长按菜单保持可用。在桌面应用中，触屏 Windows 设备仍使用两阶段触摸处理：pill 保持 `touch-action: manipulation`，进入 dragging 后才由临时 capture、non-passive `touchmove` listener 阻止默认动作；capture `contextmenu` listener 只抑制这类桌面触摸拖拽产生的原生菜单，普通鼠标右键不受影响。

浮动预览锁定 source pill 的实际渲染宽高，并以单行省略方式显示；定位使用预览自身 document 的 visual viewport，缺失时回退到该 window 的 layout viewport。过大的预览会缩小，每次移动都限制在 viewport 边距内，因此窄桌面窗口和次级窗口不会把预览挤成屏外竖条。

## 属性键候选的 fail-open 契约

所有 Obsidian Properties/候选菜单选择器集中在 `src/obsidian/`。候选排序开启时，`key-suggestion-controller.ts` 通过每个 document 的 MutationObserver 收集变化，并在一个 animation frame 内合并增强。桌面端初始化时扫描当前 document，以兼容插件启用前已经打开的菜单；Android 启动期不执行整页首扫，只观察之后实际挂载的候选菜单，避免在 WebView 增量装载工作区时占用主线程。功能关闭时 observer 会断开；重新开启时先观察再显式扫描当前 document。只有 adapter 同时确认 Properties 上下文、支持的菜单容器以及候选项共同父节点时，controller 才能排序。

增强复用原节点，并记录原生顺序和可见性。键盘桥只在已增强菜单对应的属性名编辑器仍持有焦点时工作，按可见 DOM 顺序处理 ArrowUp/Down、Home/End、PageUp/PageDown 和 macOS/iOS 的 Ctrl+P/N。桥接直接维护可见 DOM 项的原生 `is-selected` class，不派发合成 mousemove，也不读取或修改 Obsidian 私有数组；Enter 直接激活当前可见 DOM 项，全部隐藏时会被阻止。

设置禁用、菜单复用、窗口关闭或插件卸载时必须恢复原生状态并清理 observer、键盘 listener 和活动菜单引用。如果宿主选择状态无法同步，controller 立即恢复该菜单；菜单无法识别、DOM 结构不匹配或候选文本不可读时不修改任何节点。上述路径都以保留 Obsidian 原生输入、选择和关闭行为为 fail-open 结果。

## 设置与即时生效

`src/shared/settings.ts` 当前 schema 版本为 3。加载过程按版本逐步迁移旧键，再归一化未知或非法值；默认数组和每次归一化结果都使用独立引用。键候选排序模式只接受 `name` 和 `usage`：`name` 依次排列数字、拉丁字母、按拼音排列的中文和其他字符，`usage` 按使用次数降序并以同一名称比较器处理平局。旧 `alphabetical` 值没有别名或迁移路径，会作为非法值回落到默认 `name`。迁移后的结果由插件持久化。

设置页与实际 Properties 候选菜单必须调用 `src/core/suggestions/property-names.ts` 的同一比较器。设置页的置顶、置底和隐藏列表复用一个具体的属性名称建议组件；该组件只负责过滤、排除已配置项和选择回调，不复制排序规则，也不扩展成与当前业务无关的通用框架。

属性使用次数由设置页与候选控制器共享惰性缓存。Metadata Cache 的 `changed`、`deleted` 或 `resolved` 事件只使缓存失效；只有 usage 排序真正需要数据时才重新遍历 Markdown 文件缓存。

设置页保留 General、Value drag、Key order 三个选项卡，并提供 `tablist`/`tab`/`tabpanel`、本地化标签栏名称、`aria-selected`、roving `tabindex`、左右方向键、Home/End 和重渲染后的焦点保持。选项卡在窄宽度下保持单行横向滚动，活动标签在初次布局和 viewport resize 后自动进入可视区，纵向溢出被隐藏；桌面精细指针下高度为 34px，粗指针下为 44px。宽度不超过 480px 时，属性规则文本框与已有属性输入框改为纵向占满控制区。

设置保存失败时，设置页保留当前内存快照，显示本地化 Notice 和带 `role="alert"` 的未保存状态，并提供重试按钮。重试必须保留失败批次是否需要刷新键候选的语义；成功后清除未保存状态。

controller 不缓存会影响后续交互的旧设置：value drag 在下一次指针事件读取当前设置；key-order 设置变化后立即重新增强或恢复菜单，无需重载插件。

## 验证与发布边界

- 自动回归覆盖：`tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/` 和 `tests/app/`。
- 产品边界：[`product-requirements.zh-CN.md`](product-requirements.zh-CN.md)。
- UX 契约：[`ux-spec.zh-CN.md`](ux-spec.zh-CN.md)。
- 自动门禁、真实宿主矩阵与当前证据边界：[`testing-strategy.zh-CN.md`](testing-strategy.zh-CN.md)。
- 发布前必须通过 `npm run check`；该命令依次执行 `npm run typecheck`、`npm test`、`npm run build` 和 `npm run check:release`。
- CI 在 Node 20 上执行锁定安装与完整门禁，并上传 `dist/property-order/`。独立 Release workflow 只接受与 `manifest.json` 完全一致、无 `v` 前缀的 `x.y.z` 标签；门禁通过后发布官方安装所需的独立 `main.js`、`manifest.json`、`styles.css`，并额外发布 `property-order-<version>.zip`。压缩包只包含一个 `property-order/` 目录及其中的上述三个文件；同一标签重新运行时替换附件，不重复创建 Release。

DOM 交互与视觉发布门禁必须取得测试策略规定的真实宿主证据；明确列入产品非目标的能力不作为未完成发布项。
