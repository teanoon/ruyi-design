# Design

## Context

现有流程从可信 main 解析目标 ref，准备并验收唯一 tarball，再由受保护的 npmjs job 通过 OIDC 上传。先前仅支持 workflow_dispatch；用户已要求并完成标签触发改造。本文件补录实际实现。

## Goals / Non-Goals

**Goals:** 复用现有验收和上传流程，消除标签事件对手动 inputs 的依赖，保留提交来源与版本约束。

**Non-Goals:** 不执行远程发布、不创建标签、不更改外部环境规则或 npm trust，不自动提升版本。

## Decisions

- 工作流同时接受版本标签 push 和 main 上显式确认的手动请求；普通分支 push、PR 和删除标签不进入发布。
- `releaseTarget` 从事件选择版本/ref/渠道，再复用 `releaseRef` 校验包版本与 main 祖先关系。标签解析结果与事件 SHA 剥离得到的提交比较，支持轻量和附注标签，并拒绝已移动的标签目标。
- 使用 GITHUB_OUTPUT 传递 sha/version/tag；prepare 使用解析结果，publish 通过 needs.prepare.outputs.version 选择已验收清单，避免标签事件缺少 inputs 时读取空版本。
- 保留稳定版 latest、预发布 next 的默认映射，手动入口可选择其他预发布渠道。现有 artifact 完整性、OIDC 和 npm 重复版本检查保持有效。
- 发布文档说明 npmjs 环境同时允许 main 分支与 v* 标签；环境审批如已配置仍保留，完全自动化须无强制审批。外部设置不由本次代码改动更改。

## Risks / Trade-offs

- 标签已被移动 → 绑定触发事件提交并要求 main 归属，建议保护发布标签。
- 环境仅允许 main → 文档明确需允许 v* 标签；未配置时由 GitHub 阻止部署。
- 自动发布缺少手动确认输入 → 将授权维护者推送版本标签定义为明确的发布动作，并保留手动入口确认。

## Migration Plan

将工作流及脚本提交并合入 main 后，再对包含改动的目标提交推送匹配版本标签。可通过恢复旧 workflow 关闭后续自动触发；已发布版本仍不能被覆盖。本次收尾只提交代码，未在 GitHub 上执行发布。
