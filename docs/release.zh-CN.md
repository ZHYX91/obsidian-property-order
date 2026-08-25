---
source_language: zh-CN
translation_status: source
---

# Property Order 发布规范

本文是 Property Order 公共 GitHub Release 的规范流程。它不授权创建标签、发布 Release、部署到
Vault 或重置插件数据；每次执行仍需针对确切版本取得明确授权。自动化门禁、候选包、托管附件、真实
Obsidian 宿主与实际 Vault 部署是彼此独立的证据层，不能相互替代。完整验证边界见
[测试策略](testing-strategy.zh-CN.md)，安全事件另见 [安全策略](../SECURITY.md)。

## 版本决策

- 选择严格递增的 `x.y.z` 版本，不加 `v` 前缀，不使用前导零，并确认远端尚无同名标签或 Release。
- 同步 `manifest.json`、`package.json`、`package-lock.json` 与 `versions.json`；最低 Obsidian 版本只在
  兼容性证据支持时变更。
- 把面向用户的变化从 [变更日志](../CHANGELOG.md) 的 Unreleased 部分归入新版本，并复核发布说明不
  超出已有证据。

## 候选构建

- 候选必须来自远端默认分支当前 HEAD 的干净提交；未提交文件、本地补丁和其他分支不能混入发布。
- 使用仓库固定的 Node.js 24.19.0 与 npm 11.17.0 执行 `npm ci`，然后运行
  `npm run release:check`。发布门会核验 manifest、package、lockfile root 与 `versions.json`，默认使用
  manifest 版本；本地同版本标签不存在时允许继续，若已存在则必须精确解析到 `HEAD`，不能复用其他提交上的标签。
  其中的 `npm run check`、coverage、构建、发布契约和确定性基准都必须通过。
- 构建结果包括 `main.js`、`manifest.json`、`styles.css` 和确定性的
  `property-order-x.y.z.zip`。安装 ZIP 只能包含前三个文件，并且其字节必须与 loose assets 一致。

## 只读预检

- 确认候选提交的 CI 全绿，并完成当前产品范围要求的真实宿主检查；自动化成功不能替代桌面、移动端
  或弹出窗口证据。
- 在远端默认分支当前 HEAD 通过 `workflow_dispatch` 输入候选版本运行 Release workflow。预检只读，
  要求候选标签和同版本 Release 不存在、所有已发布稳定版本都更旧，并验证发布说明基线的可达性。
- 创建标签前人工确认并留证：数字版本标签 ruleset 禁止 update/delete 且发布身份无 bypass；仓库级
  immutable Releases 已启用。workflow 没有管理权限，不能替代这两项外部证据。

## 发布授权与触发

- 只有在候选 commit、版本、CI、真实宿主证据、只读预检和外部设置全部核对后，才请求确切版本的
  发布授权。
- 授权后在已验证 commit 上创建精确 `x.y.z` 标签并推送。标签 push 是创建 Release 的唯一写入触发；
  手工预检、pull request 与本地命令都不发布。
- workflow 的只读 job 重新执行完整门禁并生成候选；写权限 job 不 checkout、不安装 npm 依赖，也不
  执行仓库代码，只消费当前 run 的一次性交接 artifact。

## 哈希与托管字节核对

- 一次性交接必须恰含四个发布附件和 `SHA256SUMS`。哈希清单使用 ASCII、LF、固定顺序，并记录每个
  附件的 SHA-256；Actions artifact 自身的 digest 也必须与下载字节重算结果一致。
- Release 附件清单必须恰为 `main.js`、`manifest.json`、`styles.css` 和
  `property-order-x.y.z.zip`，不得缺失、重复或出现额外文件。
- 创建后必须重新下载 GitHub hosted bytes，与已交接候选逐字节及 SHA-256 比较，并验证每项 provenance
  精确绑定本仓库、Release workflow、标签 ref、事件 commit 和非 self-hosted runner。
- 只有稳定、非 draft、非 prerelease、immutable 的 Release 通过上述核对并再次确认远端标签身份后，
  发布才算成功。
- 失败的 tag workflow 可以安全重跑：既有同 tag Release 只有在四项公共资产与当前候选逐字节一致、
  资产清单精确且每项 provenance 均绑定同一 tag 与 commit 时，才作为成功 no-op 接受；否则失败并
  要求提升版本。校验清单始终只属于交接，不上传到公共 Release。

## 回滚与失败处理

- 创建标签前发现问题时停止发布，修复后以新提交重新执行全部门禁和预检。
- 标签创建后不得移动、删除或重建同名标签，也不得覆盖 immutable Release。保留失败 run、响应和哈希
  证据；若已有公开附件，先按安全策略判断影响，再用递增的新补丁版本修复。
- 用户需要恢复旧版时，只能安装先前已验证 Release 的三个插件文件，并保留现有 `data.json`；这属于
  单独的部署操作，不能由源码或发布流水线结果推定成功。

## 证据记录与边界

- 记录版本、commit、标签对象、CI 与预检 run、授权、外部规则设置、四附件 SHA-256、托管字节比较和
  provenance 结果。
- 分别标注源码检查、候选构建、GitHub 托管状态、真实宿主验收与 Vault 部署；没有取得的层级明确写为
  未验证。
- Release notes 只陈述实际验证过的变化和兼容性。真实设备、性能、可访问性或生产 Vault 结果不得由
  自动化门禁推断。
