---
source_language: zh-CN
translation_status: source
---

# Property Order — 发布流程

本文定义 Property Order 的可重复发布流程。源码检查、Candidate Bundle、真实 Obsidian 验收、
GitHub 发布与正式 Vault 部署是独立证据和授权边界。

## 边界

普通 tag push 不触发发布。commit、push、tag、workflow dispatch、GitHub Release 与正式 Vault
部署分别授权；任何本地门禁都不隐含远端写入。

## 版本与源码

`manifest.json`、`package.json`、`package-lock.json` 与 `versions.json` 必须绑定同一规范版本和精确
commit/tree。干净工作树必须通过 `npm run release:check`，包括 usage benchmark 与 tag identity
门禁。

## Candidate Bundle v3

vendored release-core `2.0.0` 与薄 adapter 创建唯一 Candidate Bundle v3，包含 `main.js`、
`manifest.json`、`styles.css`、`property-order-x.y.z.zip`、`SHA256SUMS` 与
`candidate-bundle.json`。Bundle 绑定工具链、core/config/workflow、产品 payload、场景合同及
fixture 哈希，不存在第二候选对象或过渡双栈。

## 产品验收

同一 Bundle 必须通过桌面与 Android 模拟器验收，覆盖同属性重排、跨属性移动、持久化、一步
Undo/Redo、touch 输入、冲突 fail-closed，以及 YAML 注释、flow/block 风格、`[]`、换行与正文
保持。Android 真机和 iOS 不在范围内。

## 独立工作流

生成并签入的 standalone workflow 只接受显式 `workflow_dispatch`。只读 verify job 在精确
commit 上执行一次独立安装与一次完整 `release:check`，重建并 source-verify Bundle；publish
job 下载固定 artifact 后只做 transport verification，不恢复 `dist`。

## 发布与核验

acceptance closure 不授权发布；单独 authorization 绑定同一 Bundle 与 closure。首次 mutation
前 workflow 深度验证记录、标签和只读 preflight。公共 Release 恰好包含三个 loose assets 与
版本 ZIP；`SHA256SUMS` 和 `candidate-bundle.json` 仅属于私有 Bundle。发布后回读托管字节与
provenance。

## 失败、回退与部署

既有同 tag Release 只有完全一致时才是零写 no-op；任何差异都失败且不得覆盖，修复使用新版本。
正式 Vault 部署需对精确 Vault 单独授权并保留 `data.json`；候选、宿主、发布与部署分别报告。
