# Proposal

## Why

如意设计当前公开分发，但仓库、包元数据和发布流程均保留 `UNLICENSED`，使用方缺少明确的开源授权。维护者已决定采用 Apache License 2.0，需要使源码、npm 产物、说明和发布检查保持一致。

## What Changes

- 在仓库根目录加入未经改写的 Apache-2.0 许可证全文，并明确项目署名；第三方材料保留原有授权。
- 将项目包及 lock 根条目的许可标识改为 `Apache-2.0`，同步中英文 README 与发布文档。
- 将发布校验和 GitHub 手动发布确认改为 Apache-2.0，保留现有发布授权、scope、版本与产物完整性检查。
- 为实际 npm 产物增加许可证和许可元数据验收，检查打包资源是否需要随包保留第三方声明。
- 本变更不上传 npm、不提升版本、不修改已发布版本，也不改变 CLI/MCP 或设计交互。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `package-and-mcp`: 规范 Apache-2.0 的仓库与 npm 分发契约，并替换现有要求保持 UNLICENSED 的发布约束。

## Impact

涉及新增 `LICENSE`、必要的署名/第三方声明，以及 `package.json`、`package-lock.json`、`README.md`、`README.zh-CN.md`、`docs/releasing.md`、`scripts/release.mjs`、`tests/release/release.test.mjs`、`tests/package/install.mjs` 和 `.github/workflows/publish.yml`。沿用现有依赖，不增加运行时功能；历史归档与旧版本记录保留其当时事实。
