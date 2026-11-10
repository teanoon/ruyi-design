# Proposal

## Why

如意设计已能交付经过独立项目验收的本地 npm 包，但缺少可重复执行的 npmjs 发布流程。发布验证目前固定依赖 Playwright 下载的 Chromium，无法复用使用方已有的 Chrome、Edge 或自定义 Chromium，增加新环境的安装成本。

## What Changes

- 建立 npmjs 发布准备、包检查、同一 tarball 安装验收、dry-run、显式发布和发布后核验流程，产物继续位于 dist/。
- 补齐 public registry、仓库与版本元数据；保留当前 UNLICENSED，不自行选择新许可证；真实发布前要求维护者明确确认许可与 scope 权限。
- 提供本地交互式首发说明，以及后续 GitHub Actions 手动触发、受保护环境控制的 npm OIDC 发布方案；创建/实施本变更不自动执行远程发布。
- 浏览器显式路径或 Chrome/Edge 通道优先；未指定时按确定顺序发现系统浏览器，最终回退到已安装的 Playwright Chromium。默认不下载浏览器。
- doctor 和实际发布共用发现与启动验证，报告可用来源及失败原因，保留现有诊断字段的兼容语义。
- 保持完整浏览器验证和失败保留旧版的发布契约；不在本次引入静态验证降级、CDP 连接或接管日常浏览器会话。

## Capabilities

### New Capabilities

- `browser-discovery`: 显式浏览器配置、跨平台候选发现、启动验证与一致诊断。

### Modified Capabilities

- `package-and-mcp`: 可复现 npmjs 发布、dist tarball 边界、受控远程发布及消费者安装验收。
- `preview-revisions`: 使用所选浏览器执行完整候选验证，保留原子发布与失败回退。

## Impact

- 浏览器共享模块（拟 src/core/browser/）、src/cli/index.ts、src/server/preview/validate.ts，以及相应单元/浏览器/包安装测试。
- package.json、发布准备脚本、tests/package/install.mjs、拟 .github/workflows/publish.yml、docs/releasing.md 与接入说明。
- 基于当前远程仓库 teanoon/ruyi-design；MCP 工具数量、站点工作流、数据格式及历史快照不变。
- 实施范围为仓库内代码、流程及文档；npm 账号/组织权限、Trusted Publisher、GitHub 环境保护和真实首发由维护者在明确授权后操作，不写入凭据。
