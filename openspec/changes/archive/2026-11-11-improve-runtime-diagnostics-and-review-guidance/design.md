# Design

## Context

见 proposal.md 的问题说明。`src/mcp/index.ts` 的 createMcp 当前写死握手版本 0.1.0。包根目录已有基于 import.meta.url 的解析方式（src/skills/index.ts），可用于读取本包而非消费者 cwd 的 package.json。doctor 当前输出 product/package/node 等字段，缺少包版本。

ReviewServer.info 返回启动信息；MCP get_review_context 当前直接调用 ReviewSession.context，HTTP context 则在其结果上增加预览字段。ReviewSession 的 sessionId 被持久保存，因此重启仍保留同一 sessionId，无法用它证明进程已替换。

src/core/feedback/index.ts 已实现非空回复自动重开与活动批次发布后保留追加内容；review-feedback 主规范已有相应要求。打包技能末段与 docs/mcp.md 仍要求用户回复后手动重开。MCP guide() 直接读取打包 SKILL.md，仓库另有自用技能副本；setup 对已有不同内容报冲突，不能借本次升级静默覆盖消费者技能。

## Goals / Non-Goals

**Goals:** 统一真实包版本来源；让用户可通过现有接口识别后端实例并确认重启；使代理收到的指南与既有评论行为一致。

**Non-Goals:** 不新增 MCP 工具、Resource 或浏览器诊断界面，不自动升级/重启进程，不修改评论状态机、历史数据、setup 冲突策略或发布流程，不批量改写用户项目技能。

## Decisions

### 1. 单一包版本来源，启动时固定

引入共享的只读服务端元数据模块（建议 src/core/runtime.ts），通过模块自身位置解析包根的 package.json，覆盖源码开发与 dist 安装布局。读取并验证 version 后在进程初始化时固定，不按每次请求重读磁盘。MCP 握手、runtime.packageVersion 与 doctor.packageVersion 共用这一来源；包元数据失效时明确报错，不用 0.1.0/unknown 掩盖问题，MCP stdout 仍仅用于协议。

仅替换硬编码握手不能区分同版本重启；每次查询磁盘又会使旧代码报出新版本，因此两种方案均不足。

### 2. 进程身份与持久会话分离

同一 Node 进程只初始化一份 `{packageVersion, instanceId, pid, startedAt}`：instanceId 使用随机 UUID，pid 使用当前进程 PID，startedAt 取服务初始化时刻的 UTC ISO 字符串。PID 可能复用，启动时间也不是唯一键，因此以 instanceId 的变化作为进程替换依据。同进程多个评审共享 runtime；关闭再打开评审但不退出进程，不刷新 runtime。

runtime 只在服务层组装返回，不写入 Store、revision 或批次快照。通过 ReviewServer 的统一上下文方法（或等价服务层组合）向 info、MCP context 和受认证 HTTP context 注入相同数据，避免只更新某一路。保持 HTTP 鉴权及所有既有字段；不返回凭据、完整环境变量或可执行路径。

### 3. doctor 只描述自身安装，不探测已有 MCP

DoctorReport 新增 packageVersion，文本显示包名与版本；JSON 保持单对象与旧字段语义，不加入可能被误认为 MCP 实例的 doctor PID/instanceId。文档给出对照步骤：先记录现有 live runtime；升级本地安装；由客户端重启/重连 MCP；再次 start_review 或 get_review_context 比较 packageVersion 与 instanceId。sessionId 可保持不变，刷新浏览器并非重启。旧服务没有 runtime 时明确说明需先升级并重启，不自动推断身份。

### 4. 在技能源头修正说明，保留人工边界

修改 skills/ruyi-design-review/SKILL.md，使其澄清段及反馈流程描述非活动批次回复后自动重开、活动批次输入冻结及发布后留待下一轮；保留主动请求、无需轮询和用户确认解决的规则。同步 docs/mcp.md、getting-started 与相关迁移/重启说明，并核对 MCP server instructions/tool descriptions 是否存在相反表述。

MCP guide 直接读取打包技能，不另建文案副本；同步本仓库 .agents/skills/ruyi-design-review 下受管副本。消费者已有技能仍遵循 setup 的差异冲突保护，文档说明需审核并更新已有技能，不承诺 npm 升级自动覆盖它。

## Risks / Trade-offs

- doctor 新包与 MCP 旧进程混淆 → 区分 installed/local 与 live runtime，提供可复现对照步骤。
- 进程身份写入持久会话造成历史变化 → 仅在返回值注入，不做数据库迁移。
- 源码/安装布局解析差异 → 从模块位置解析，使用真实 tarball 安装测试覆盖，禁止依赖 cwd。
- 指南更新未送达已有消费者 → 测试 MCP Resource 与技能源一致；保留 setup 冲突提示，文档明确技能副本需审核更新。

## Migration Plan

新增返回字段向后兼容，数据目录无迁移。升级安装后仍需客户端真正重启 MCP，再检查 live runtime；未重启的旧进程继续按原行为运行。本仓库更新技能镜像，外部项目不静默覆盖。验证包括同版本跨进程实例变化、同进程稳定性、持久会话恢复和实际安装后的版本/指南一致性。不在本变更中提升版本、发布 npm 或操纵用户当前评审会话。
