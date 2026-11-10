## Purpose

让如意设计在 MCP 所在环境复用已安装的系统浏览器或显式指定的 Chromium，通过确定的选择顺序、实际启动验证和清晰诊断减少重复下载，同时保持完整发布验证及用户日常浏览器会话的独立性。

## ADDED Requirements

### Requirement: Explicit browser selection
系统 SHALL 支持 RUYI_DESIGN_BROWSER_EXECUTABLE 指定绝对可执行路径，或 RUYI_DESIGN_BROWSER_CHANNEL 指定 chrome/msedge 稳定通道；两者同时设置、空配置、非绝对路径或不支持的通道 MUST 明确报错。显式配置无效或无法启动时 MUST 不静默切换其他浏览器。设置 SHALL 从运行 MCP/doctor 的进程环境读取，不从设计稿或评论中读取执行配置。

#### Scenario: Use a custom Chromium
- **WHEN** 用户仅指定可运行的自定义 Chromium 绝对路径
- **THEN** doctor 和发布选择同一显式来源，使用独立无头验证实例，不要求额外下载 Playwright 浏览器

#### Scenario: Invalid explicit selection
- **WHEN** 两种配置冲突或指定浏览器不可用
- **THEN** 报告具体配置和原因，不回退，不下载，不切换活动修订

### Requirement: Deterministic automatic discovery
无显式配置时系统 SHALL 依次尝试系统 Chrome、系统 Edge、平台路径/PATH 中的 Chromium、已有 Playwright Chromium，对重复候选去重。发现 SHALL 使用 MCP 所在操作系统与账户的环境，不把 WSL/容器之外的浏览器视为可直接执行。所有候选不可用时 MUST 汇总失败原因及可选安装/配置指引；自动发现 MUST 不下载浏览器。

#### Scenario: Use an installed system browser
- **WHEN** 无显式配置且系统 Chrome 能满足验证要求
- **THEN** 选用系统 Chrome，并报告来源；不要求安装第二套 Chromium

#### Scenario: Continue after an automatic candidate fails
- **WHEN** 较高优先级的自动候选不存在、无执行权限或无法启动
- **THEN** 按顺序继续尝试后续候选，并保留失败诊断；已有 Playwright Chromium 仍可作为最终后备

### Requirement: Operational browser diagnostics and isolation
doctor 与发布 SHALL 共用候选解析和启动检查，不能只按文件存在判定可用；检查 SHALL 包含有界时间内启动、创建隔离上下文与执行最小页面脚本，并关闭本次创建的资源。诊断 SHALL 包含来源、可用性、版本（可获得时）和尝试结果；已有 chromium 布尔字段 SHALL 保留“默认 Playwright 浏览器文件存在”的语义，整体成功状态 SHALL 按有效验证浏览器决定。系统 MUST 不接管用户现有窗口、配置目录或登录状态，不在 MCP stdout 输出非协议诊断。

#### Scenario: System browser is usable without a bundled browser
- **WHEN** 默认 Playwright 浏览器文件不存在但系统浏览器实际启动检查成功
- **THEN** doctor 整体成功，旧 chromium 字段仍为 false，新诊断明确选用系统来源；发布可使用该来源

#### Scenario: Existing executable is incompatible
- **WHEN** 候选文件存在但启动或最小运行检查失败
- **THEN** 不报告验证可用，清理本次创建的实例，按显式或自动策略处理失败
