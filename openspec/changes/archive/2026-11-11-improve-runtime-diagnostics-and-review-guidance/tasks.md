# Tasks

## 1. 共享版本与运行身份

- [x] 1.1 实现从模块位置解析本包元数据并固定版本的共享模块，生成同进程稳定的 instanceId、pid、startedAt；测试从不同 cwd 读取正确版本、无效元数据明确失败及同进程重复读取稳定。
- [x] 1.2 将 MCP 握手硬编码版本替换为共享版本，并向 start_review、get_review_context、受认证 HTTP context 注入相同 runtime；通过 stdio MCP 与 HTTP 测试核对字段一致、原返回字段及九工具/三资源契约保持兼容。
- [x] 1.3 增加跨进程重启验收：同一数据目录重启后 instanceId 更新、sessionId/历史/修订不变；用临时安装副本验证磁盘包版本改变时旧进程仍报告原版本，新进程读取新版本。

## 2. Doctor 与操作说明

- [x] 2.1 为 doctor JSON 增加 packageVersion，并在文本显示本地包版本；扩展 tests/unit/doctor.test.ts 与 tests/integration/doctor-output.mjs，验证成功/失败输出、纯 JSON、verbose 和退出码语义保持一致。
- [x] 2.2 更新 docs/mcp.md、docs/getting-started.md 和迁移说明，交付“记录 live runtime → 升级 → 客户端重启/重连 → 比较 instanceId 与版本”的核对步骤；明确 doctor 只描述自身安装、旧服务无 runtime 时不可据此断言重启，人工对照示例检查无误。

## 3. 评论指导一致性

- [x] 3.1 更新打包技能、MCP instructions/工具描述中的相关指引和用户文档，准确说明非活动批次非空回复自动重开、活动批次保持冻结且发布后进入下一轮、仍由用户主动要求更新；定向检索并核对不再要求正常回复流程额外手动重开，保留显式手动重开入口说明与用户确认解决边界。
- [x] 3.2 同步仓库自用技能副本，核对 MCP guide Resource 与打包技能内容一致；运行技能安装/冲突验收，确认消费者定制副本仍受保护，文档说明已有副本需审核更新。
- [x] 3.3 运行现有反馈领域测试和 npm run test:comments，验证自动重开、历史保留、批次输入冻结及发布后下一轮行为不变；仅在覆盖缺口处补充有意义的场景测试。

## 4. 分发与综合验收

- [x] 4.1 扩展 tests/package/install.mjs 与 MCP 集成验收，验证实际安装包的握手/doctor 版本等于包元数据，runtime 稳定且指南与技能一致；运行 npm run typecheck、npm test、npm run build、npm run test:release、node tests/integration/brand-mcp.mjs、node tests/integration/doctor-output.mjs 和 npm run test:package -- --skip-browser-checks 并记录结果。
- [x] 4.2 运行 openspec validate improve-runtime-diagnostics-and-review-guidance --strict，检查差异只覆盖本变更且版本、持久数据与评审状态机未被改写，整理诊断和指南一致性的验收记录。
