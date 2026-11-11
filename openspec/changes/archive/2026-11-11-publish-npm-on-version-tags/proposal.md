# Proposal

## Why

维护者希望通过推送明确的版本标签自动发布 npm，避免每次手动填写版本与渠道。本记录在实现完成后按收尾请求补录，保存已实现的范围、规范和验证依据。

## What Changes

- 推送 `v*` 标签触发发布，保留 main 上的手动发布与许可/scope 确认。
- 校验标签与包版本一致、提交属于 origin/main 且与触发事件一致。
- 稳定版选择 latest，预发布版选择 next；输出版本及渠道供现有验收/上传流程使用。
- 维护 GitHub 环境、OIDC、同一字节产物和重复版本保护，并更新操作说明与回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `package-and-mcp`: 明确版本标签作为发布授权，增加自动标签发布与拒绝无效标签的契约，保留手动发布。

## Impact

涉及 `.github/workflows/publish.yml`、`scripts/release-ref.mjs`、新增 `tests/release/release-target.test.mjs`、发布文档和主规范。版本保持 0.3.0；本次不推送标签、不上传 npm、不修改外部 npm/GitHub 设置。
