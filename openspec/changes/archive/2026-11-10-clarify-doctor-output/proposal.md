# Proposal

## Why

doctor 已找到并实际启动系统 Edge 时，仍同时输出 `chromium: false`、Chrome 未安装的错误和 `npx playwright install chromium`，使成功结果看起来像缺少依赖。用户需要直接看懂最终结论、正在使用什么浏览器、是否必须采取操作，并已明确选择默认文本摘要、通过 `--json` 获取机器可读结果。

## What Changes

- **BREAKING**：`ruyi-design doctor` 默认输出人类可读文本；`doctor --json` 提供结构化诊断，现有 JSON 调用方需要显式增加该参数，不根据 TTY 自动切换格式。
- 默认摘要首先显示整体成功/失败，再展示工作区、桥接资源和最终选中浏览器的检查结果；浏览器使用 Microsoft Edge、Google Chrome 等可辨认名称，并显示版本与来源。
- 成功找到浏览器时明确说明无需额外安装浏览器，默认隐藏未选中候选的失败链；`--verbose` 和 JSON 提供完整诊断依据。
- JSON 新增明确的 `status`、`summary` 和结构化 `recommendations`，保留既有 `chromium` 布尔和 `browser` 字段的语义。**BREAKING**：`browserInstall` 改为仅在安装 Chromium 确实属于可选修复建议时出现，不能再假设此字段始终存在。
- 失败建议对应真实原因：配置冲突先修配置、资源缺失先修资源；可用的 Edge 不因 Chrome 或 Playwright Chromium 缺失而变成警告或错误。
- 将可预期的 doctor 检查错误纳入一致报告，保持状态与退出码相符；更新文档、机器调用方和有代表性的诊断用例。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `package-and-mcp`：doctor 的默认文本、显式 JSON、详细输出、退出状态和自动化迁移契约。
- `browser-discovery`：最终浏览器结论与原始候选诊断的展示边界、旧字段含义和按需修复建议。

## Impact

- `src/cli/index.ts`，拟新增 `src/cli/doctor.ts` 的报告组装与纯格式化逻辑；复用 `src/core/browser/index.ts` 返回的现有诊断，不改变浏览器选择策略。
- `tests/unit/` 下新增 doctor 报告/渲染用例及构建后执行的 `tests/integration/doctor-output.mjs`；`tests/integration/browser-discovery.mjs` 与 `tests/package/install.mjs` 的 JSON 调用改为显式 `--json`。
- `README.md`、`README.zh-CN.md`、`docs/getting-started.md`、`docs/mcp.md` 和相关兼容说明。
- 不增加依赖、不新增 MCP 工具、不改动设计稿发布验证，也不重新把浏览器检查加入 npm 发布工作流。当前仅创建规划材料，不实施、提交或发布产品代码。
