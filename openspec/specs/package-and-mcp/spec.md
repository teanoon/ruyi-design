# package-and-mcp Specification

## Purpose

提供可安装到其他本地项目的单一 npm 工具包，使现有 AI 编程客户端能够通过 MCP 按需启动原型评审、获取操作指南并处理反馈，且不要求使用方构建工具界面或接入自有模型服务。

## Requirements


### Requirement: Installable npm delivery
工具包 SHALL 以 `@littlehobby/ruyi-design` 包含可执行 `ruyi-design` CLI、MCP 服务、本地站点的已构建资源及技能材料；使用方 MUST 无需本项目源码或开发依赖即可启动服务。CLI SHALL 提供 `ruyi-design mcp`、`ruyi-design setup` 和 `ruyi-design doctor`。

#### Scenario: Install an actual package artifact
- **WHEN** 在干净项目中安装发布 tarball 并执行其 `ruyi-design mcp` 命令
- **THEN** 客户端可以完成 MCP 握手并发现评审工具，不要求另外构建工作区

### Requirement: Explicit project binding and lifecycle
MCP 服务 SHALL 按需接受 projectRoot、designRoot、监听地址与端口启动评审，返回会话身份和可用 URL；MUST 不依赖进程 cwd 猜测项目，不混用不同项目数据。

#### Scenario: Start review from a different working directory
- **WHEN** 客户端从其他目录对指定项目调用 `ruyi_design_start_review`
- **THEN** 系统仅加载指定项目的原型并返回该项目的会话与预览地址

#### Scenario: End or restart a session
- **WHEN** 会话被结束或 MCP 进程退出后重新启动
- **THEN** 原 listener 被关闭，持久记录可从原项目恢复

### Requirement: User-initiated feedback tools
MCP SHALL 提供读取已保存评论、`ruyi_design_prepare_update` 固定本轮快照、领取批次、更新处理结果、发布修订、记录删除位置与结束会话的工具；MUST 不提供智能体轮询或持续监控工具。AI SHALL 仅在用户主动要求更新后处理一轮，完成后结束，不自动消费后来新增评论。

#### Scenario: User requests an update
- **WHEN** 用户告知 AI 已保存评论、可以更新
- **THEN** AI 读取上下文、固定并领取本轮快照、修改验证发布，用户无需回到页面提交

#### Scenario: Read without starting work
- **WHEN** 客户端读取上下文但没有准备处理快照
- **THEN** 评论可读取，处理批次和领取状态不变

### Requirement: Guide resources and explicit local skill setup
包 SHALL 通过 `ruyi-design://guides/review`、`ruyi-design://schemas/manifest` 和 `ruyi-design://templates/manifest` 提供工作流指南与资产材料，并提供显式的 Codex 项目技能安装命令。技能名称 SHALL 为 `ruyi-design-review`，安装目录 SHALL 为 `.agents/skills/ruyi-design-review/`；MUST 不将 Resource 读取等同于原生 Skill 激活，不通过 npm 安装脚本修改客户端配置。

#### Scenario: Client without MCP Skills extension
- **WHEN** 客户端仅支持基础工具和 Resource
- **THEN** 客户端仍可读取指南并执行完整评审流程，不依赖 Skills 扩展

#### Scenario: Preserve user changes during setup
- **WHEN** setup 遇到用户修改过的同名技能文件
- **THEN** 系统拒绝静默覆盖并报告冲突位置

#### Scenario: Existing legacy skill
- **WHEN** 项目已有 `prototype-review` 或 `ruyi-uxai-review` 技能目录
- **THEN** 新技能安装不静默覆盖或删除旧目录的用户定制内容，并明确报告需要停用或迁移的旧技能

### Requirement: Protocol output isolation
stdio MCP 服务 MUST 将标准输出专用于协议消息，诊断日志 SHALL 使用其他通道。

#### Scenario: Service reports a startup diagnostic
- **WHEN** MCP 服务输出诊断日志
- **THEN** 客户端接收的标准输出仍可解析为合法 MCP 消息

### Requirement: Canonical MCP identity and tool names
MCP 服务 SHALL 在初始化信息中使用 `ruyi-design-mcp`，分发配置示例 SHALL 默认以 `ruyi_design` 为客户端连接键。客户端连接键 MUST 作为可配置别名，不作为服务协议名称或项目身份。工具发现 SHALL 恰好提供以下 9 个规范名称：`ruyi_design_start_review`、`ruyi_design_get_review_context`、`ruyi_design_prepare_update`、`ruyi_design_claim_batch`、`ruyi_design_get_feedback_context`、`ruyi_design_update_feedback`、`ruyi_design_publish_revision`、`ruyi_design_set_feedback_location`、`ruyi_design_end_review`。

#### Scenario: Discover the rebranded server
- **WHEN** 客户端按新配置连接 `ruyi-design mcp`
- **THEN** 握手上报 `ruyi-design-mcp`，工具使用 `ruyi_design_` 前缀且没有重复的旧命名工具，指南及工具参数一致

#### Scenario: Choose a custom connection key
- **WHEN** 用户把客户端配置键从 `ruyi_design` 改为其他合法名称
- **THEN** 服务仍报告相同协议身份、工具和资源，不要求移动评审数据

### Requirement: Explicit technical name migration
包 SHALL 提供从 `uxai-review` 包/命令、`uxai_review` 配置、旧工具名、`uxai://` 资源及 `prototype-review` 技能以及上一候选 `@littlehobby/ruyi-uxai` 技术标识迁移到新名称的对应关系和重连步骤；MUST 不宣称旧工具或资源别名仍受支持。受管本地配置升级 SHALL 仅修改对应的如意连接，保留其他连接及用户设置；配置冲突 MUST 明确报告。

#### Scenario: Reconnect a previous client
- **WHEN** 使用方按迁移清单更新安装、配置及技能后重连
- **THEN** 客户端发现一套新工具和资源，能使用同一项目的历史评论与版本继续一轮评审，无需删除或重新初始化运行数据

### Requirement: Purpose-qualified technical identifiers
公开技术标识 SHALL 以 `ruyi-design` 表达此产品归属，并按职责使用适当后缀：包为 `@littlehobby/ruyi-design`，CLI 为 `ruyi-design`，MCP 服务为 `ruyi-design-mcp`，技能为 `ruyi-design-review`；工具 SHALL 使用 `ruyi_design_` 前缀，默认连接键 SHALL 为 `ruyi_design`。产品展示名称 MUST 保持“如意设计 / Ruyi Design”，不能将技术标识和公司署名混为同一名称。

#### Scenario: Trace installation to a review session
- **WHEN** 用户根据新文档安装该包、配置服务并启用技能
- **THEN** 包、命令、服务、连接、技能及工具均符合各自命名映射，指南 URI 使用 `ruyi-design://guides/review`，产品界面仍显示如意设计身份

### Requirement: Conversation-request publication in the existing session
既有 publish_revision SHALL 支持 source=conversation，要求 request、idempotencyKey 和 expectedBaseRevision，禁止同时传批次和租约；默认 feedback 模式 MUST 兼容既有参数与结果流程。对话发布 SHALL 保持 session 和入口，记录版本来源、请求与基版本，验证全部候选入口并原子推进活动版本，不创建虚构评论/批次，不修改已有评论或其归档状态。排队/处理中的反馈和并发发布 MUST 阻止直接发布；提交前须再次检查。失败 MUST 保留旧活动版本，重复相同请求须幂等，冲突键须拒绝。

#### Scenario: User requests a design change directly in chat
- **WHEN** 用户明确提出修改设计并通过 conversation 模式发布
- **THEN** 同一 session 发布新 revision，站点自动更新，已有评论、归档、历史快照和原版本查看保持有效，无需另开静态站点

#### Scenario: Active feedback or failed validation
- **WHEN** 候选验证失败，或提交前出现排队/处理中的反馈
- **THEN** 不切换活动版本，保留待处理反馈，可在解决冲突或修复候选后重试

### Requirement: Reproducible npmjs release artifact
发布流程 SHALL 对 @littlehobby/ruyi-design 的固定版本从确定的代码提交构建 dist/ 下的唯一 tarball，记录清单与摘要，并以该文件进行独立项目安装/CLI/MCP/技能验收及发布预演。真正发布 SHALL 使用通过验收的同一字节产物，不在验收后静默重建。包 MUST 排除源码测试、运行数据库/快照、客户端配置和嵌套 tgz，并保持新环境无需开发依赖。

#### Scenario: Promote a verified archive
- **WHEN** 维护者准备并验收一个待发布版本
- **THEN** dist 中的包名、版本、清单与摘要可复核，发布使用同一文件；任何文件变化必须重新验收

### Requirement: Explicit npmjs publication lifecycle
流程 SHALL 区分准备/dry-run 与远程发布，默认操作 MUST 不上传。远程发布 SHALL 明确选择 npmjs 公共 registry、public access 及 dist-tag，确认 scope 权限、许可意图和目标版本；重复版本或无法确定 registry 状态 MUST 阻止上传，不覆盖版本。发布后 SHALL 校验 registry 中的名称、版本、tag 和完整性信息；本地流程与 GitHub 手动触发流程 MUST 不把普通提交或测试当成发布授权。

#### Scenario: Prepare without publishing
- **WHEN** 用户执行准备、包测试或 dry-run
- **THEN** 得到可审核的本地产物与检查结果，不写入 registry，也不宣称已拥有发布权限

#### Scenario: Publish a new public version
- **WHEN** 获得维护者明确发布授权且前置条件通过
- **THEN** 上传已验收 tarball，核验远端元数据；失败不伪造成功、不自动递增版本或更换 registry

### Requirement: Controlled trusted-publisher automation
仓库 SHALL 提供 GitHub Actions 的手动触发发布流程，使用明确的版本/ref 和受保护发布环境，并将校验与上传分开。后续自动认证 SHALL 使用 npm Trusted Publisher/OIDC；首次创建包的交互式发布和外部信任配置 SHALL 有明确操作说明。仓库 MUST 不保存 npm token 或账号凭据，不因缺少信任关系静默转为 token 发布；当前许可保持 UNLICENSED，改变许可 MUST 由维护者明确决定。

#### Scenario: Trust is not configured
- **WHEN** npm package、Trusted Publisher 或发布环境配置尚未完成
- **THEN** 准备及 dry-run 仍可验证，真实发布停在明确的配置关口，说明手工首发及后续信任配置所需步骤
