---
source_language: zh-CN
translation_status: source
---

# Property Order 架构

本文是 Property Order 的权威现行架构说明。英文版用于同步阅读；实现、测试或英文文档与本文冲突时，以本文定义的边界和契约为准。

## 目标与非目标

插件只增强 Obsidian Properties 的两类顺序：顶层 YAML 列表属性中的值顺序，以及原生属性键候选顺序。它提供跨平台同属性拖拽、同笔记跨属性移动、三种 YAML 写回格式和原生键候选排序。

不支持嵌套列表、对象列表、多行 flow sequence、源码模式拖拽或跨文件移动；这些结构必须 fail closed，不得修改笔记。模块化重构的目标是隔离解析、交互、DOM 和 Vault 边界，不是扩大产品范围或重写整个插件。

## 分层与依赖方向

依赖从外层指向纯核心：

1. `src/core/`：纯 TypeScript 规则，不导入 Obsidian，也不访问浏览器 DOM。
   - `frontmatter/`：定位 frontmatter、解析顶层 flow/block 列表、诊断和局部重写。
   - `suggestions/`：对候选键进行隐藏、去重、置顶、置底和排序；名称比较器是设置页与原生候选菜单共享的唯一排序实现。
   - `interaction/`：指针拖拽状态转换和文档身份守卫。
2. `src/features/`：功能编排。
   - `value-order/`：把状态机动作、drop 几何、DOM 呈现、pane 上下文和写回组合成一次拖拽事务。
   - `key-order/`：监听候选菜单、应用纯排序规则，把键盘选择桥接到可见候选顺序，并由 recent tracker 与 device-local store 管理已确认属性名称的严格 MRU。
3. `src/obsidian/`：Obsidian 和 DOM 适配边界。
   - `properties-dom.ts`：Properties 容器、pill 和属性名识别。
   - `native-suggest-dom.ts`：原生属性键候选菜单识别。
   - `pane-context.ts`：workspace leaf 与文件解析。
   - `editor-transaction.ts`：公开 editor transaction 的宿主兼容、精确核对、Properties 公开重载和持久化边界。
   - `metadata.ts`：通过公开的 Vault 文件枚举与 Metadata Cache 文件缓存，把 top-level frontmatter 转换为候选键/包含该属性的 Markdown 笔记数；设置页和候选控制器共享同一份可失效缓存。拖拽目标判定中，缓存存储形态只能佐证原生类型证据，不得单独定义属性类型。
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
- `text-list.ts`：把宿主文本列表中的非字符串 token 按原始写法转换成字符串，同时保留项目位置和可附着注释。
- `rewrite.ts`：同属性排序、跨属性移动和目标格式选择。
- `diagnostics.ts`、`types.ts`：可诊断结果与共享模型。

纯写回只替换受影响的 source/target 属性片段，不对整个 YAML 文档 stringify。frontmatter 之外的正文和未受影响属性保持文本不变；`preserve` 模式还应保留受影响列表可保留的引号、注释、空行、项目样式和输入换行。真实拖拽通过 Obsidian editor 提交最小逻辑变更，以未保存正文和撤销历史为准。Obsidian 1.12.7 即使进行普通手动编辑，也会把已编辑的 CRLF/CR 笔记序列化为 LF；Property Order 不为对抗该宿主行为再追加第二次 Vault 写入。

标量解析与 Obsidian 暴露的 YAML core schema 类型保持一致：null、boolean、number（包括 infinity/NaN）和 string 必须彼此区分，Metadata/writeback 冲突快照同时比较标量类型和规范值。通用纯 YAML API 默认保留这些类型；真实拖拽已由 Obsidian 原生多值编辑器确认是文本列表，因此在成功操作中由 `text-list.ts` 把受影响属性的非字符串项目转换成字符串。转换使用原始 token：`0xFF` 变成 `"0xFF"` 而不是 `"255"`，空 block 项变成 `""`；已有字符串 token 在 `preserve` 下保持原写法。

| 当前格式 | `preserve` | `flow` | `block` |
| --- | --- | --- | --- |
| flow | 保留 flow 和原标量表示 | flow，安全规范化标量 | block，安全规范化标量 |
| block | 保留 block、项目样式、注释和空行 | flow；允许丢弃仅 block 可表达的项目注释/空行 | block；安全规范化并保留可附着注释 |
| empty flow | `[]` | `[]` | 空 block 头 |
| empty block | 空 block 头 | `[]` | 空 block 头 |
| scalar | 最小改动的单行 flow；显式 null 为空列表 | flow | block |

属性缺失、不是受支持列表、索引冲突或内容冲突时返回诊断，不写入部分结果。单引号、双引号、带逗号或 `#` 的标量必须安全解析；属性头行尾注释在转换成 flow 时必须保留合法空白分隔。

## 属性值拖拽事务

`core/interaction/pointer-drag.ts` 是纯状态机。它把 mouse/touch/pen 的按下、移动、长按计时、释放和中断转换为 `start`、`cancel`、`finish` 等动作，不访问 DOM。`value-drag-controller.ts` 只编排动作和资源生命周期：

1. 从发起 pill、Properties 容器和 pane 捕获 source 属性、source 索引、精确 pill 节点、文件路径以及该 leaf 的公开 `MarkdownView.editor`。编辑器文本是唯一的内容与冲突基底；可见 pill 顺序必须与 YAML 一致，source 才可参与操作。
2. 由 `drop-targeting.ts` 在同一 pane 内解析一个明确状态：受支持列表、受支持的类型不匹配列表、已确认非列表或未知。正常列表使用 Obsidian 原生多值容器；标量或混合值会被 1.12.7 渲染为单个类型不匹配字段，此时只在原生列表图标和警告同时存在时接受该属性，不读取私有 `types.json`。单标量字段可作为唯一 source 或 target；混合数组字段无法表达具体 source 索引，因此拒绝猜测，只有可读且无歧义的逗号分隔显示与当前 YAML 完全一致时才可作为 append target。只有原生非列表证据并由标量存储形态佐证时才显示非列表 Notice；未知属性行静默取消。
3. 由 `drag-dom.ts` 管理预览、指示器、拒绝目标和 cursor class，但不得移动、删除或复制宿主的属性 pill；取消路径必须完全清理。经过拒绝目标不产生 Notice，只有在其上松手才由 controller 提示。
4. 在 pointer release 和原生输入失焦后，重新验证 leaf、文件、编辑器、属性键、editor kind、精确 source/target 节点、可见值与当前 YAML，再开始规划。同属性重排生成一个精确属性 change；跨属性移动生成两个互不重叠的精确属性 change。所有 change 都以同一份原始编辑器文本为坐标基底，并通过公开 `editor.transaction()` 原子提交一次。`editor-transaction.ts` 把精确 origin `"set"` 隔离为 Obsidian 1.12.x 隐藏 frontmatter 过滤器的兼容细节；功能层不得复制这个字符串或依赖私有 transaction API。等待一个宿主事件循环后，编辑器文本必须与完整规划结果逐字一致。文本不变是安全写入失败；出现第三种内容状态则报告 divergence，且不得自动追加回滚事务。显式 property-level null 视为空列表，对象、重复属性键和复杂结构仍 fail closed。

编辑器仍是内容与冲突判断的唯一基底，因此尚未落盘的正文修改会被保留；同属性或跨属性的一次成功拖拽都只形成一个撤销步骤。controller 在 pointer release 时单次抑制该拖拽产生的尾随 click，并让 source/target 原生输入失焦，避免 Obsidian 的聚焦保护跳过控件重建。只有编辑器 buffer 精确匹配规划结果后，`editor-transaction.ts` 才可调用公开 `MarkdownView.setViewData(committedContent, false)`，以同一份已提交内容重建 Properties，确认该调用没有产生第二次文本变更，再调用公开 `MarkdownView.requestSave()` 安排持久化；在宿主事件循环后以及重建后都必须重新确认原 leaf、文件、view 和 editor 身份。写回返回精确提交后，controller 在第一次 Properties 等待前立即调用公开 `editor.focus()`，使 CodeMirror 接管平台撤销/重做；重建和对账结束后，仅当焦点仍在 `body`、拖拽开始前捕获的旧焦点 owner、已经断开的旧节点或本次受影响的 Properties 行内，且提交后的 pointer/焦点导航/window 用户意图 generation 没有推进时，才受守卫恢复一次。用户主动转焦会使该恢复资格失效；未产生精确提交的路径不得调用它。提交前的 drag/DOM 所有权与提交后的文档身份必须分离：window blur 或插件卸载可以清理拖拽 UI，但不得阻止已经精确提交且仍属于原文档的内容安排保存。`requestSave()` 失败属于独立的持久化调度失败：编辑器内容仍视为已提交并取得撤销焦点，同时提示用户先手动保存，不得误报为内容 divergence。原生属性 setter、Vault 直写和手工移动 pill 都不是写回或恢复手段。

随后 controller 根据当前有效 transaction 状态逐项证明受影响的 Properties 行：buffer 等于 committed content 时继续提交后对账，精确等于本次 transaction 的 original content 时视为合法的立即 undo；再次成为 committed content 可视为 redo。两种状态都只按当前 buffer 对账，不报告 divergence，也不重新应用 transaction；只有第三种内容才是 divergence。初始拖拽收尾结束后，controller 通过公开的 workspace `editor-change` 事件为每个 pane 保留精确的 original/committed 状态对，并只为同一 editor 后续发生的 undo/redo 安排受守卫的纯 UI 对账；该路径不得新建 transaction、重载 view、请求保存或拦截历史快捷键。内容进入第三种状态、pane/file/editor 被复用、DOM 断开、窗口关闭或 controller 卸载都会使状态对失效。若公开视图重建后仍陈旧，`metadata-editor-refresh.ts` 从同一 editor buffer 重新提取 frontmatter，以公开 `parseYaml` 创建全新属性对象，并只在 file、view、editor、document、pane、宿主 owner、宿主容器归属与内容身份全部匹配，且当前 DOM 中仍可解析的受影响列表行已失焦时调用一次隔离的 `metadataEditor.synchronize()` 能力。该适配器只能请求宿主重建 UI，调用前后都验证 editor 文本不变；controller 等待宿主后还必须再次验证 buffer，再对账正常多值编辑器或受支持的类型不匹配编辑器。能力缺失、抛错或对账失败时，每个原 pane 独立保留一个持久 Notice 与“刷新属性面板”操作：每次点击都重新选择当前精确匹配的 original 或 committed buffer 状态，再以该状态重试公开 `setViewData()`，必要时走同一受守卫适配器；操作期间发生合法 undo/redo 时重新开始当前状态的对账，不得误报 divergence。一个 pane 的成功、失败或关闭不得清除另一个 pane 的有效操作，layout 变化会只清理已经断开的 pane。成功后关闭对应提示，失败后才建议重新打开笔记。插件不得自动关闭或重开 leaf。写入不生效、活动 leaf/file/editor 改变、DOM 消失或被复用、`pointercancel`、Escape、window blur、noop drop 或内容冲突都必须安全取消。

移动端的 `PropertyValueOrderController` 监听 Obsidian 原生属性值 `contextmenu`，通过公开的 `Menu.forEvent` 只追加一项操作，不抑制或替换宿主菜单。用户选择后，只把该 pill 置为 15 秒单次待拖动状态；下一次 touch/pen 按下走纯状态机的 `startOnMove` 路径，移动达到鼠标级阈值后开始拖拽，并只消费一次。点击其他位置、Escape、超时、插件卸载、DOM 失效和事务清理都会取消该状态。仅在已经待拖动的按压期间抑制第二次原生菜单和默认触摸移动。若无法取得共享菜单，辅助函数 fail open，不改变宿主行为。

桌面应用中的触屏 Windows 设备保留直接两阶段触摸路径：pill 使用 `touch-action: manipulation`，进入 dragging 后才由临时 capture、non-passive `touchmove` listener 阻止默认动作；capture `contextmenu` listener 只抑制活动桌面触摸拖拽产生的原生菜单，普通鼠标右键不受影响。

浮动预览锁定 source pill 的实际渲染宽高，并以单行省略方式显示；定位使用预览自身 document 的 visual viewport，缺失时回退到该 window 的 layout viewport。过大的预览会缩小，每次移动都限制在 viewport 边距内，因此窄桌面窗口和次级窗口不会把预览挤成屏外竖条。

两个多窗口 controller 都以 document 为资源所有者；插件必须在 controller 首次初始化前把幂等 disposer 登记到运行时回滚栈，controller 也必须在首次挂载 observer 或事件 listener 前登记对应 document owner。初始化中途失败、窗口关闭或插件卸载时，资源按逆序释放，单项 cleanup 异常不得阻断其余 document 的恢复。

## 属性键候选的 fail-open 契约

所有 Obsidian Properties/候选菜单选择器集中在 `src/obsidian/`。候选排序开启时，`key-suggestion-controller.ts` 通过每个 document 的 MutationObserver 收集变化，并在一个 animation frame 内合并增强。桌面端初始化时扫描当前 document，以兼容插件启用前已经打开的菜单；Android 启动期不执行整页首扫，只观察之后实际挂载的候选菜单，避免在 WebView 增量装载工作区时占用主线程。功能关闭时 observer 会断开；重新开启时先观察再显式扫描当前 document。只有 adapter 同时确认 Properties 上下文、支持的菜单容器以及候选项共同父节点时，controller 才能排序。

增强复用原节点，并记录原生顺序和可见性。键盘桥只在已增强菜单对应的属性名编辑器仍持有焦点时工作，按可见 DOM 顺序处理 ArrowUp/Down、Home/End、PageUp/PageDown 和 macOS/iOS 的 Ctrl+P/N。桥接直接维护可见 DOM 项的原生 `is-selected` class，不派发合成 mousemove，也不读取或修改 Obsidian 私有数组；Enter 直接激活当前可见 DOM 项，全部隐藏时会被阻止。

设置禁用、菜单复用、窗口关闭或插件卸载时必须恢复原生状态并清理 observer、键盘 listener 和活动菜单引用。如果宿主选择状态无法同步，controller 立即恢复该菜单；菜单无法识别、DOM 结构不匹配或候选文本不可读时不修改任何节点。上述路径都以保留 Obsidian 原生输入、选择和关闭行为为 fail-open 结果。

recent tracker 只捕获已增强属性名候选上的主指针按下、键盘 Enter/Tab 候选激活，以及属性名编辑器的 Enter、Tab、change 和 focusout 提交意图；普通 `input` 事件不会更新历史，因此输入过程中的中间草稿不算提交。hover、方向键浏览和单纯聚焦也不会直接写历史。与候选或显式按键 action 处于同一浏览器 task 的伴随 change/focusout 信号会被抑制，既避免把半成品草稿变成第二个 action，也不会遮蔽后续独立的 focusout 提交。每次意图都会重新解析所属 pane 和文件，从 Metadata Cache 快照当前提交前键集合，再等待该精确文件的 `changed` 事件。桥接后的 Tab 会携带精确的 `KeyboardEvent` 身份，document listener 因此不会再创建第二个 typed action；同一次 keydown 分发结束后的两个 microtask hop 还会快照编辑器最终解析出的值，让宿主安排的 microtask 先稳定下来，从而兼容原生候选索引滞后，同时不会接受无关缓存增量。只有新缓存确认精确属性名称已从不存在变为存在时，store 才把该名称移动到 MRU 首位。每个 document 保留最多十项短期待确认队列，使不同 pane 的快速连续提交不会互相覆盖；队列只保留弱 editor 身份，不强引用 DOM 节点。删除、超时、文件或 document 身份丢失、设置禁用、清除历史、插件卸载和未确认提交都会丢弃待确认项。短期 age guard 只存在内存，不写入历史。

## 设置与即时生效

`src/shared/settings.ts` 当前 schema 版本为 4。加载过程按版本逐步迁移旧键，再归一化未知或非法值；schema 3 到 4 只建立新增 `recent` 枚举的版本边界，不改变已有 `name` 或 `usage` 值。默认数组和每次归一化结果都使用独立引用。键候选排序模式只接受 `name`、`recent` 和 `usage`：`name` 依次排列数字、拉丁字母、按拼音排列的中文和其他字符；`recent` 使用严格 MRU，并让未记录候选回退到名称排序；`usage` 按包含该属性的缓存 Markdown 笔记数降序排列，并以同一名称比较器处理平局。`usage` 保留为兼容的持久化枚举名称，不表示交互次数。旧 `alphabetical` 值没有别名或迁移路径，会作为非法值回落到默认 `name`。迁移后的结果由插件持久化。

设置页与实际 Properties 候选菜单必须调用 `src/core/suggestions/property-names.ts` 的同一比较器。`order-keys.ts` 先应用隐藏规则，再按配置顺序展开置顶规则；普通区在 `recent` 下依次放置历史中仍存在的名称并以名称顺序排列未记录项，在 `usage` 下按笔记数与名称平局规则排列；置底规则最后应用。同文件导出的纯 `explainPropertyKeyRules()` 复用精确相同的通配匹配器，返回每类首个匹配规则与按“隐藏 > 置顶 > 置底”计算的最终位置，供设置页解释冲突。设置页的置顶、置底和隐藏列表复用一个具体的属性名称建议组件；该组件只负责过滤、排除已配置项和选择回调，不复制排序规则，也不扩展成与当前业务无关的通用框架。

属性笔记数由设置页与候选控制器共享惰性缓存。Metadata Cache 的 `changed`、`deleted` 或 `resolved` 事件只使缓存失效；若已有连接中的增强菜单，只定向刷新这些菜单，不扫描整个 document。没有菜单打开时不安排 animation frame，也不遍历 Vault；只有 `usage` 排序真正显示菜单或设置页请求属性名时才重新遍历 Markdown 文件缓存。`name` 和 `recent` 排序不请求该计数，因此不会为排序遍历 Vault。

recent store 使用 Obsidian 公开的 `App.loadLocalStorage()` / `App.saveLocalStorage()`，以 namespaced key 在当前 Vault、当前设备保存一个版本化的精确字符串数组。数组顺序本身就是严格 MRU，最多 100 项，不保存时间戳；重复确认只把精确同名项移到首位，当前候选中不存在的陈旧项被排序器忽略。读取失败、未知版本或畸形数据按空历史 fail open；后台 MRU 写入失败时保留本次会话的内存顺序，不影响原生属性编辑。只有 Metadata Cache 确认成功提交且顺序实际变化时才写入这一小数组；该状态不进入 `data.json`，不参与 Obsidian Sync。“清除最近使用历史”先取消待确认意图，再清除当前 Vault、当前设备的内存历史并立即刷新候选，不修改设置、笔记或其他 Vault；如果 local-storage 删除失败，界面会提示旧的已保存历史可能在重启后恢复。

Obsidian 1.12.x 保留自定义 General、Value drag、Key order 三个选项卡，并提供 `tablist`/`tab`/`tabpanel`、本地化标签栏名称、`aria-selected`、roving `tabindex`、左右方向键、Home/End 和重渲染后的焦点保持。选项卡在窄宽度下保持单行横向滚动，活动标签在初次布局和 viewport resize 后自动进入可视区，纵向溢出被隐藏；桌面精细指针下高度为 34px，粗指针下为 44px。Obsidian 1.13+ 改用三个原生声明式设置页面，使所有简单控件进入设置搜索；这些控件覆盖默认绑定并读写 `propertyOrderSettings`，三个属性规则编辑器、“清除最近使用历史”和规则测试框则通过声明式 `render` 定义保留自定义行为。定义构造阶段不得遍历 Vault，已有属性名称只在规则编辑器实际渲染时惰性读取。清除按钮只读取 store 是否为空并执行本地删除，不触发 Vault 枚举；规则测试值只存在于当前设置 surface，既不保存也不读取属性笔记数。宽度不超过 480px 时，两条路径中的属性规则文本框、已有属性输入框与规则测试框都改为纵向占满控制区。

设置保存失败时，设置页保留当前内存快照，显示本地化 Notice 和带 `role="alert"` 的未保存状态，并提供重试按钮。重试必须保留失败批次是否需要刷新键候选的语义；成功后清除未保存状态。

controller 不缓存会影响后续交互的旧设置：value drag 在下一次指针事件读取当前设置；key-order 设置变化后立即重新增强或恢复菜单，无需重载插件。

## 验证与发布边界

- 自动回归覆盖：`tests/core/`、`tests/features/`、`tests/obsidian/`、`tests/shared/` 和 `tests/app/`。
- 产品边界：[`product-requirements.zh-CN.md`](product-requirements.zh-CN.md)。
- UX 契约：[`ux-spec.zh-CN.md`](ux-spec.zh-CN.md)。
- 自动门禁、真实宿主矩阵与验证边界：[`testing-strategy.zh-CN.md`](testing-strategy.zh-CN.md)。
- 发布前必须通过 `npm run check`；该命令依次执行 Obsidian 官方 ESLint、README 与稳定双语文档门禁、`npm run typecheck`、`npm test`、`npm run build` 和 `npm run check:release`。
- 插件语言设为“自动”时，通过 `getLanguage()` 跟随 Obsidian 当前界面语言；用户显式选择的插件语言始终优先。最低支持的 Obsidian 版本为 1.12.7，所有已发布版本的兼容关系继续以 `versions.json` 为准。
- 生产构建把 `main.js`、`manifest.json` 和 `styles.css` 直接生成到 `dist/` 顶层，使源码构建审查与本地发布检查使用同一套标准路径。`.node-version`、`package.json` 的 `engines.node`/`packageManager` 与运行时门禁共同固定 Node.js 24.18.0 和 npm 11.16.0；CI 与 Release workflow 都先执行该精确契约，再锁定安装和运行完整门禁。独立 Release workflow 以仓库级固定 concurrency group 串行化所有候选版本且不取消在途发布。手工 `workflow_dispatch` 只执行发布前预检：版本必须是与 manifest 一致的 `x.y.z`、所选 ref 必须是远端默认分支当前 HEAD、候选远端标签必须不存在，并在身份核对前完成与标签发布相同的门禁和确定性归档。标签事件还要求 event commit 可从远端默认分支到达，并持续把远端轻量或 annotated 标签解析到该 commit；任何缺失、歧义或移动都 fail closed。门禁通过后发布三个独立文件，并通过固定条目顺序、时间、权限和 metadata 的确定性归档器组装 `property-order-<version>.zip`。压缩包只包含一个 `property-order/` 目录及其中的上述三个文件；四个最终附件都生成构建证明。仓库必须另行启用匹配发布版本标签的 active tag ruleset，禁止更新和删除，并且发布 actor 不得具有旁路权；workflow 不修改、也不尝试从任意继承条件中推断该外部规则。准备新建 Release 时，生成说明的起点来自所有已发布、非 draft、非 prerelease、精确 SemVer 的真实 Releases 中低于候选版本的最高版本；若存在同版或更高版真实 Release，或者起点标签不是候选 commit 的祖先，新建发布失败。workflow 不持有仓库 Administration 凭据，也不读取或修改 immutable Releases 设置；只有 REST 明确返回 `404` 才表示同标签 Release 不存在，其他查询失败一律阻断。已有同标签 Release 必须是非 draft、非 prerelease 并报告 `immutable: true`，远端资产名集合也必须无重复且精确等于三个独立文件与当前版本 ZIP；四个附件哈希全部一致才视为 no-op。旧的可变 Release、附件缺失、不同、重复或多出任一附件都要求提升版本。新 Release 直接附齐四个附件创建，发布即为 immutable，并在发布后确认 `immutable: true`，再下载远端附件与候选构建逐字节核对。

DOM 交互与视觉发布门禁必须取得测试策略规定的真实宿主证据；明确列入产品非目标的能力不作为未完成发布项。
