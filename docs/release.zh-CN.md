---
source_language: zh-CN
translation_status: source
---

# Property Order — 发布流程

本文定义 Property Order 公共 GitHub Release 的可重复流程。源码门禁、固定候选、真实 Obsidian
验收、GitHub 发布和正式 Vault 部署是独立证据；任何一个步骤都不会隐含授权另一个步骤。标签、
Release 与正式 Vault 只有在精确目标得到单独授权时才可变更。

## 版本决策

- 使用无 `v` 前缀、无前导零的严格递增 `x.y.z`，并同步 `manifest.json`、`package.json`、
  `package-lock.json` 与 `versions.json`。
- 发布工具固定为仓库内 `scripts/vendor/obsidian-release-core.mjs`。相邻 lock 记录精确
  release-core `1.0.0` 版本和 SHA-256；`scripts/release.mjs` 只声明插件身份、资产策略和远端仓库。
- 升级核心时必须从规范 release-core 重新生成 runtime 与 lock，同时提交适配器测试和完整门禁；
  禁止手工只改版本、哈希或其中一个副本。

## 候选构建

- 在干净、已提交的精确候选上执行固定 Node.js 24.19.0、npm 11.17.0 的 `npm ci` 和
  `npm run release:check`。普通 `npm run check` 验证任务内质量；tag-aware 发布门另行报告复用已发布
  版本的既有冲突。
- `node scripts/release.mjs candidate --output-dir <空目录>` 生成确定性交接：三个 loose assets、
  `property-order-x.y.z.zip`、`SHA256SUMS` 与 `candidate.json`。`candidate.json` 绑定 commit、tree、
  目标 tag 名称/提交、核心版本/哈希和全部资产哈希；不包含时间戳或本机路径。tag 从不存在到指向
  同一提交不会改变候选字节，实际 absent-or-exact 状态由 tag-aware 门禁另行验证。
- 当前插件声明 `styles.css` 为必需，因此公共 Release 恰有四个附件。核心也支持未来插件明确声明
  可选样式；ZIP 始终只有一个插件 ID 顶层目录，内部字节与 loose assets 一致。

## 只读预检

- workspace 从实时活跃清单生成 `plan.json`，在隔离 clone 中用仓库自身命令重建并核对候选；公开仓库
  不依赖该私有 workspace，独立 clone 仍可安装、测试、构建和验证交接。
- 候选进入一次性隔离 Vault 后，桌面及当前 manifest 要求的 Android 场景必须形成与同一
  commit/tree/资产哈希绑定的产品证据。自动化、模拟器、实机与截图仍分别记录。
- `acceptance-closure.json` 只表示门禁通过，并固定 `authorizesPublication: false`；它不能创建标签、
  dispatch workflow 或发布 Release。

## 发布授权与触发

- closure 之后必须另建绑定确切仓库、版本、commit、tree、candidate digest 与 closure digest 的
  `authorization.json`。授权记录本身不执行远端操作。
- 标签创建和推送是独立动作。发布要求精确 `x.y.z` 标签已指向候选 commit；不得移动、删除或重打
  既有标签来消除冲突。
- 只有再次给出显式 publish 确认后，workspace 编排器才以该版本标签为 ref 调用
  `workflow_dispatch`，传递便携 closure、候选摘要和授权绑定。workflow 默认 `verify` 模式只读；
  只有明确 `publish` 模式可进入下游写权限 job。普通 tag push 不发布。

## 哈希与托管字节核对

- 只读 job 从精确 commit 重跑 `release:check`，生成确定性交接，并按当前 run 的 artifact ID 与 digest
  固定上传。写权限 job 先重新验证交接、closure、授权、标签和 commit/tree，再执行只读 GitHub 预检：
  已有 Release 必须预先满足 immutable、精确字节与 provenance 后才以零写入 no-op 继续；任何冲突在首次
  attestation 前失败。只有明确不存在时才证明资产并创建 Release，创建命令仍重复全部边界以防竞态。
- 公共附件恰为 `main.js`、`manifest.json`、`styles.css` 与版本 ZIP；`SHA256SUMS` 和
  `candidate.json` 只留在私有交接。发布附件都需要与精确 workflow/ref/commit 绑定的 provenance。
- 发布后必须从 GitHub 重新读取稳定、非 draft、非 prerelease、immutable 的 Release，核对精确附件
  清单、metadata digest、下载字节和远端标签目标。既有同 tag Release 只有全部一致时才是安全 no-op。

## 回滚与失败处理

- 触发前失败：修复源码或证据后，从新 commit 重新执行 plan、candidate 与 acceptance；旧授权不得复用。
- dispatch 状态不确定：按稳定 release run ID 查询恢复，禁止盲目重复触发。发布后核验失败时保留证据，
  不移动标签、不替换 immutable Release，以递增补丁版本恢复。
- 用户回退只可安装先前已验证 Release 的生产资产，并保留 `data.json`；正式 Vault 部署仍需对精确
  Vault 另行授权、备份和安装后哈希核对。

## 证据记录与边界

- 保存 plan、candidate、closure、authorization、trigger 与 post-verify 的摘要和 SHA-256，记录 CI、
  桌面/Android 验收、外部 tag ruleset/immutable Release 设置及四项托管附件哈希。
- 新增插件时，先在其独立仓库提供固定工具链、薄适配器、核心 lock、生产资产策略和完整门禁，再由
  workspace 清单登记预期 remote 与验收适配器；不能从私有 workspace 建立运行时依赖。
- 本任务不会更改版本、创建或移动标签、创建 GitHub Release、发布插件或部署正式 Vault。
