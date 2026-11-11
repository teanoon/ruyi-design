# Spec Delta

## ADDED Requirements

### Requirement: Actual package version and live runtime identity
MCP 初始化上报的服务版本 SHALL 来自该运行实例启动时加载的项目包元数据，不使用独立硬编码版本。既有 start_review、get_review_context 和受认证的 HTTP session context 返回 SHALL 以新增 `runtime` 对象提供 `packageVersion`、`instanceId`、`pid` 和 `startedAt`；其中 startedAt SHALL 为 UTC ISO 8601 服务初始化时间，instanceId SHALL 标识本次进程运行实例。同一进程内这些字段 MUST 保持一致，MCP 重启后 MUST 产生新的 instanceId，持久 sessionId、历史评论及修订 MUST 不因诊断元数据改变。运行中的旧进程 MUST 不因磁盘包元数据更新而冒充新版本。读取运行诊断 MUST 不创建批次、不修改评论或触发发布，不新增工具或资源。

#### Scenario: Identify an installed running server
- **WHEN** 客户端连接已安装 tarball 的 MCP 并启动评审、读取 MCP 与 HTTP 上下文
- **THEN** 握手版本与该进程启动时的包版本一致，三处 runtime 的 packageVersion、instanceId、pid 和 startedAt 一致，原有返回字段和九项工具保持可用

#### Scenario: Restart while preserving a review session
- **WHEN** 服务结束后以相同项目与数据目录启动新的 MCP 进程
- **THEN** 新 runtime.instanceId 与上次不同，pid 与启动时间描述本次进程，原 sessionId、评论与已发布修订保留；再次读取同一进程的信息不会改变实例身份

#### Scenario: Package files change without a process restart
- **WHEN** 已运行 MCP 的安装目录被升级，而原进程尚未重启
- **THEN** 原进程仍报告启动时的 packageVersion 与原 instanceId，不将磁盘新版本误报为已加载版本

### Requirement: Doctor version distinguishes local installation from live service
doctor 文本与 JSON SHALL 显示当前 doctor 进程加载的包版本，JSON SHALL 新增 `packageVersion`，保留既有字段、诊断结果、退出码和纯 JSON 输出契约。文档 SHALL 明确 doctor 检查的是本次执行的本地安装，而非已连接 MCP；确认重启 SHALL 比较 MCP 返回的运行实例身份与版本，不以刷新浏览器、复用 sessionId 或单独运行 doctor 为成功证据。无法读取或解析包版本时 MUST 明确报告错误，不静默回退为旧硬编码版本。

#### Scenario: Run doctor after installing an upgrade
- **WHEN** 用户升级后运行 doctor，但客户端仍连接旧 MCP 进程
- **THEN** doctor 输出该命令加载的包版本，操作说明要求另行重连并检查 live runtime，而不据此宣称旧 MCP 已重启

#### Scenario: Preserve doctor machine output
- **WHEN** 自动化调用 doctor --json 或 doctor --json --verbose
- **THEN** 标准输出仍为单个 JSON 对象并新增 packageVersion，既有状态、检查项及退出码语义不变

## MODIFIED Requirements

### Requirement: Guide resources and explicit local skill setup
包 SHALL 通过 `ruyi-design://guides/review`、`ruyi-design://schemas/manifest` 和 `ruyi-design://templates/manifest` 提供工作流指南与资产材料，并提供显式的 Codex 项目技能安装命令。技能名称 SHALL 为 `ruyi-design-review`，安装目录 SHALL 为 `.agents/skills/ruyi-design-review/`；MUST 不将 Resource 读取等同于原生 Skill 激活，不通过 npm 安装脚本修改客户端配置。打包技能、通过 MCP 返回的评审指南、工具说明及当前用户文档 SHALL 准确反映已实现的追加回复行为：用户保存非空追加回复后，非排队/处理中评论自动重开；活动批次输入与状态保持冻结，发布后追加回复留待下一轮。指南 MUST 不要求该正常流程额外手动重开，也不把自动重开等同于自动唤醒 AI、确认解决或归档。

#### Scenario: Client without MCP Skills extension
- **WHEN** 客户端仅支持基础工具和 Resource
- **THEN** 客户端仍可读取指南并执行完整评审流程，不依赖 Skills 扩展

#### Scenario: Preserve user changes during setup
- **WHEN** setup 遇到用户修改过的同名技能文件
- **THEN** 系统拒绝静默覆盖并报告冲突位置

#### Scenario: Existing legacy skill
- **WHEN** 项目已有 `prototype-review` 或 `ruyi-uxai-review` 技能目录
- **THEN** 新技能安装不静默覆盖或删除旧目录的用户定制内容，并明确报告需要停用或迁移的旧技能

#### Scenario: User replies after clarification or review
- **WHEN** 用户按技能或评审指南对非活动批次的评论保存非空追加回复
- **THEN** 指南说明系统自动重开，用户只需随后在对话中要求更新；不再要求额外点击重新打开，原文、历史和结果保留

#### Scenario: User replies while a batch is active
- **WHEN** 用户在评论所在批次排队或处理时追加回复
- **THEN** 技能与文档说明当前固定输入不变，发布后追加回复作为待处理反馈保留，仍须用户下一次明确要求更新
