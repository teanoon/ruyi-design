## Purpose

提供可安装到其他本地项目的单一 npm 工具包，使现有 AI 编程客户端能够通过 MCP 按需启动原型评审、获取操作指南并处理反馈，且不要求使用方构建工具界面或接入自有模型服务。

## ADDED Requirements

### Requirement: Installable npm delivery
工具包 SHALL 包含可执行 CLI、MCP 服务、本地站点的已构建资源及技能材料；使用方 MUST 无需本项目源码或开发依赖即可启动服务。

#### Scenario: Install an actual package artifact
- **WHEN** 在干净项目中安装发布 tarball 并执行其 mcp 命令
- **THEN** 客户端可以完成 MCP 握手并发现评审工具，不要求另外构建工作区

### Requirement: Explicit project binding and lifecycle
MCP 服务 SHALL 按需接受 projectRoot、designRoot、监听地址与端口启动评审，返回会话身份和可用 URL；MUST 不依赖进程 cwd 猜测项目，不混用不同项目数据。

#### Scenario: Start review from a different working directory
- **WHEN** 客户端从其他目录对指定项目调用 start_review
- **THEN** 系统仅加载指定项目的原型并返回该项目的会话与预览地址

#### Scenario: End or restart a session
- **WHEN** 会话被结束或 MCP 进程退出后重新启动
- **THEN** 原 listener 被关闭，持久记录可从原项目恢复

### Requirement: User-initiated feedback tools
MCP SHALL 提供读取已保存评论、prepare_update 固定本轮快照、领取批次、更新处理结果、发布修订与结束会话的工具；MUST 不提供智能体轮询或持续监控工具。AI SHALL 仅在用户主动要求更新后处理一轮，完成后结束，不自动消费后来新增评论。

#### Scenario: User requests an update
- **WHEN** 用户告知 AI 已保存评论、可以更新
- **THEN** AI 读取上下文、固定并领取本轮快照、修改验证发布，用户无需回到页面提交

#### Scenario: Read without starting work
- **WHEN** 客户端读取上下文但没有准备处理快照
- **THEN** 评论可读取，处理批次和领取状态不变

### Requirement: Guide resources and explicit local skill setup
包 SHALL 提供可读取的工作流指南和模板，以及显式的 Codex 项目技能安装命令；MUST 不将 Resource 读取等同于原生 Skill 激活，不通过 npm 安装脚本修改客户端配置。

#### Scenario: Client without MCP Skills extension
- **WHEN** 客户端仅支持基础工具和 Resource
- **THEN** 客户端仍可读取指南并执行完整评审流程，不依赖 Skills 扩展

#### Scenario: Preserve user changes during setup
- **WHEN** setup 遇到用户修改过的同名技能文件
- **THEN** 系统拒绝静默覆盖并报告冲突位置

### Requirement: Protocol output isolation
stdio MCP 服务 MUST 将标准输出专用于协议消息，诊断日志 SHALL 使用其他通道。

#### Scenario: Service reports a startup diagnostic
- **WHEN** MCP 服务输出诊断日志
- **THEN** 客户端接收的标准输出仍可解析为合法 MCP 消息
