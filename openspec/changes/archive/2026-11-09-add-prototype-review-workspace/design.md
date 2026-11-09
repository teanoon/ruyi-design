# Design

## Context

动机与能力范围见 proposal.md。当前目录只有 OpenSpec 与环境元数据，没有业务源码、包配置或测试，因此本设计为单 npm 包的初始架构，不假设已有 Git 仓库或框架。原型以无需构建的 HTML/CSS/JS 为主，AI 运行于外部编程客户端。本次仅创建规划文件。

## Goals / Non-Goals

**Goals:**
- 一个 npm 安装单元同时提供 stdio MCP、本地服务、已构建工作区和技能材料。
- 页面组合、组件示例、评论目标、批次和版本均有稳定身份及可恢复记录。
- 设计资产可脱离评审工具独立运行；工具通过服务时注入桥接脚本提供增强能力。
- 文件编辑、候选检查与发布分开，避免用户看到 AI 修改到一半的页面。

**Non-Goals:**
- 不提供自有模型运行器，不承诺客户端结束后仍自动唤醒 AI。
- 不模拟物理 PPI、系统缩放或原生窗口管理；设备第一版表示逻辑视口和展示元数据。
- 不实现任意 JS 内存状态的无损热替换，也不将本机可信原型提升为不可信代码托管平台。

## Decisions

### 1. 单包、分模块，工具和原型使用不同构建约束

采用 TypeScript。服务端使用 Node.js、官方 MCP SDK、Fastify 与 SQLite；工作区使用原生 TypeScript/CSS，Vite 仅用于开发和构建工具自身前端。测试采用 Vitest 与 Playwright。实施时按官方兼容表锁定 SDK、Node LTS 和 SQLite 驱动版本，并在包 engines 与 CI 中保持一致。

原型无需安装 Vite、React 或工具自身开发依赖；已编译服务端和工作区随包发布。选单包而非 monorepo，是因为当前只有一个交付单元；模块边界通过目录与依赖规则维护。相较初期引入 React，原生工作区减少运行依赖；后续可替换 UI 实现而不改变资产协议。

### 2. 本项目目录规划

以下目录是实施目标，本次不创建源码目录。

```text
uxai-review/
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  src/
    cli/                 # mcp / setup / doctor 命令及参数
    core/
      catalog/           # 清单加载、稳定 ID、组合和资源解析
      sessions/          # 项目绑定、会话生命周期
      feedback/          # 评论、批次、领取租约和复核
      revisions/         # 快照、候选验证和原子发布
    contracts/           # 公共清单、HTTP、事件、桥接的版本化 schema
    storage/             # SQLite、迁移、事件日志及文件布局
    mcp/                 # tools/resources 与领域服务适配
    server/
      routes/            # HTTP API、SSE、工作区静态资源
      preview/           # 预览 origin、资源服务和桥接注入
      security/          # 路径、Host/Origin、令牌与请求边界
    browser/
      workspace/         # 导航、设备切换、评论与设计系统界面
      bridge/            # iframe 元素定位和状态恢复
      styles/            # 工具工作区自身样式
    skills/              # 内置技能、指南读取及显式安装逻辑
  skills/
    prototype-review/
      SKILL.md
      references/        # 原型编写、组件复用、批次处理约定
      templates/         # 清单和无需构建的原型模板
  schemas/               # 从 contracts 生成并发布的 JSON Schema
  tests/
    unit/
    integration/         # MCP stdio、HTTP、存储和生命周期
    browser/             # 真实浏览器评审闭环
    package/             # npm tarball 安装及启动验证
    fixtures/            # 正常/异常清单与原型
  examples/
    starter/             # 多页面、状态、设备、令牌与共享组件
  docs/
    getting-started.md
    asset-contract.md
    mcp.md
    security.md
  scripts/               # 构建、schema 导出及打包验证
  dist/                  # 生成的 cli/server/workspace/bridge
  openspec/
```

依赖方向：cli、mcp、server 调用 core；core 使用 contracts 和 storage 接口，不依赖 HTTP/MCP 或浏览器。浏览器只共享可浏览器化的 contracts，不导入 Node 或数据库模块。技能正文的唯一作者源位于 skills/，MCP Resource 与 setup 共用该源。

### 3. npm 包发布边界与 CLI

包名待发布前检查可用性，不影响协议；CLI 暂用 `uxai-review`。package.json 的 bin 指向 dist 中的入口。发布白名单包括 dist/、skills/、schemas/、示例模板、README 和 LICENSE，不包括测试、OpenSpec、开发缓存、数据库和用户项目。通过 npm pack 的实际 tarball 在干净临时项目安装验证，不以本仓库 node_modules 代替交付验证。

- `uxai-review mcp`：启动 stdio MCP；不自动启动任何项目 HTTP 站点，不向 stdout 输出日志。
- `uxai-review setup --client codex --project <root>`：显式安装项目级技能，显示安装位置；遇到用户修改的已有文件拒绝覆盖并提供差异信息。第一版不自动改客户端 MCP 配置，输出接入示例。
- `uxai-review doctor`：检查运行时、包资源、项目清单和配置，并报告问题。

不使用 npm postinstall 修改用户仓库或全局客户端设置。相比隐式安装，显式命令可审查并可重复执行。

### 4. 使用方目录与清单

```text
consumer-project/
  design/
    manifest.json
    tokens/              # CSS 自定义属性及令牌展示数据
    components/          # 页面与展示页共用的 CSS/JS/HTML 实现
    pages/               # 页面原型入口
    showcases/           # 组件状态的独立示例入口
    assets/
  .agents/skills/prototype-review/  # 显式 setup 才安装
  .uxai-review/           # 本地运行数据，建议排除版本控制
    review.sqlite
    revisions/<id>/      # 不可变快照
    candidates/<id>/
```

`design/` 和运行数据目录均允许显式覆盖；创建会话时必须传 projectRoot 与 designRoot，禁止依赖 MCP 子进程启动目录猜测目标项目。文件真实路径必须位于批准目录内，拒绝 traversal 和符号链接越界。

manifest.json 含 schemaVersion、项目 ID、devices、pages、tokens、components：
- device：稳定 ID、名称、逻辑 viewport 宽高；无 DPI/PPI/原生窗口设置。
- page：稳定 ID、名称和顺序；states 各有稳定 ID、展示名及显式 device→entry 映射。
- entry：本地 HTML 路径、初始化查询参数、可选 hash。无效组合不生成；不做全笛卡尔积。
- component：稳定 ID、实现文件路径、按设备分组的具名状态示例入口；状态不作为侧栏导航层。
- tokens：令牌组和稳定 ID、值、用途与 CSS 自定义属性关联；设备覆盖可显式声明。
- 页面入口可声明使用的 component IDs，为 AI 提供依赖线索；不宣称可以静态分析任意 JS 得到完整依赖图。

schema 校验重复 ID、丢失引用、缺失入口和越界路径，报告精确位置。不同组合可复用同一 HTML 并以查询参数初始化。初始状态不可依赖用户此前操作；模板推荐共享 ES modules 与 CSS，自定义元素是可选方式，不强制组件框架。按钮大小、主次等作为示例元数据，不增加导航层级。

### 5. 预览外壳和组件展示

工作区有 Pages 与 Design System 两个入口。Pages 展示单层页面列表，内容区选择状态及设备；URL 使用稳定 ID 深链接，缺失组合明确不可用。组件页选择设备后并排排列全部适用状态，每个示例有独立 iframe 和 comment scope，避免多个状态脚本互相污染。令牌提供色板、文字样例、尺寸样例、实际值与用途。

窗口随可用空间自适应适配画布，但画布查看缩放不改变 device 的逻辑 viewport。页面与组件都使用原仓库共享资源，不将展示页维护成另一份组件实现。

预览采用第二个 HTTP origin（独立端口），使原型脚本不能直接访问管理 API。服务时仅对 HTML 响应注入桥接脚本，保持源文件不变；桥接与外壳通过带协议版本、frame/session ID 的 postMessage 通信，并校验 origin 和 source。原型可信，跨源隔离是 API 边界而非完整恶意脚本沙箱。

### 6. HTTP、本地绑定与会话生命周期

`start_review` 启动工作区与预览 listener，返回 sessionId、实际端口、reviewUrl、revisionId。host 默认 loopback，允许指定 IP/0.0.0.0；publicBaseUrl 与 previewBaseUrl 可显式配置以适配 WSL、容器和端口映射。通配绑定时不得返回 0.0.0.0 作为浏览器目的地址；优先使用配置 URL，否则返回 loopback 地址及可选网卡地址。端口占用报可操作错误，不默默更换显式端口。

HTTP 提供 `/api/sessions/:id/...` 下的 catalog、comments、revisions 与 events（处理快照仅由 MCP 发起）；普通写操作用 HTTP，浏览器事件用 SSE。控制面校验 Host/Origin、会话令牌与请求大小，不启用通配 CORS；初始会话凭证通过 URL fragment 交给工作区并立即移除，凭证保存在当前标签页按会话隔离的 sessionStorage（禁用存储时保留 fragment），通过 Authorization 请求头传递，SSE 使用支持请求头的 fetch 流读取。不同端口不隔离 cookie，因此不使用共享主机 cookie 保存管理凭证；预览 origin 不接收控制凭证。只服务已批准的设计资源及工作区，不暴露整个项目或任意文件读取接口。

同一 MCP 进程按规范化项目路径复用活动会话，不允许不同项目串用数据。第一版同一项目数据目录仅允许一个进程持有锁；其他进程返回冲突信息。end_review 停止对应 listener 但保留记录；进程退出关闭全部 listener。重启通过项目绑定恢复数据并重新发放凭证，过期领取租约可恢复。无 Git 也可使用。

### 7. 评论、批次与 SQLite 模型

主要实体：projects、sessions、comments、thread_messages、batches、batch_items、claims、revisions、feedback_results、events。comment target 含 kind(page/component/token)、稳定对象 ID、state/device/example ID、revisionId、URL、viewport、滚动位置与元素/区域锚点。

元素优先使用 data-review-id；回退信息包括选择器、文本、角色、邻近结构与相对区域坐标。第一版不强制截图，优先提供可序列化 DOM 上下文；后续截图能力不得宣称重建浏览器即可还原用户瞬时状态。锚点匹配存在歧义时标记失效，不静默绑定相似元素。令牌及外壳内对象使用稳定语义 ID 定位。

评论保存后即持久化且可由 MCP 读取，页面无提交动作。用户在对话中主动通知 AI 可以更新后，AI 调用 prepare_update，在单事务内固定当前待处理评论的正文、目标与上下文快照；原评论可追加回复，不能改变历史输入。AI 处理期间新评论留待用户下一次主动要求更新。prepare_update 使用 idempotency key，重复请求返回同一快照；批次领取采用 owner+lease，按项目顺序处理，租约过期可重领。内部批次用于一致性及恢复，不要求用户理解或提交批次。

批次状态为 queued→processing→awaiting_review→completed；评论可标记 needs_clarification，不强制发布。修订结果逐条绑定评论和发布版本，只有用户确认才 resolved。重开评论进入待处理状态，用户再在对话中要求更新。已解决评论在 UI 中集中归档，默认收起，从当前反馈列表和计数移出；归档仅改变展示与状态，不删除数据库记录，重新打开后回到当前待处理列表。

events 使用持久化递增游标，浏览器 SSE 支持断线补读和过旧游标重同步。智能体通过 get_review_context 按需读取完整状态；删除 wait_for_feedback 和领域等待循环，无心跳监听状态。工作区显示等待用户发起、AI 正在修改以及服务连接状态。

### 8. MCP 工具与技能契约

stdio 为基础传输。工具参数与返回均 schema 校验，返回稳定 ID、版本和结构化错误，不把评论内容当作新授权。

| Tool | 关键输入与输出 |
|---|---|
| start_review | projectRoot/designRoot/host/ports/baseUrls → sessionId/reviewUrl/revisionId |
| get_review_context | sessionId → catalog、当前版本、批次与处理状态 |
| prepare_update | sessionId/idempotencyKey/commentIds? → 当前待处理评论的不可变快照 |
| claim_batch | sessionId/batchId/owner/idempotencyKey → leaseToken、固定输入 |
| get_feedback_context | sessionId/commentId/batchId → 批次快照、线程、锚点、资源引用 |
| update_feedback | sessionId/batchId/leaseToken/commentId/action/message → 状态 |
| publish_revision | sessionId/batchId/leaseToken/idempotencyKey/expectedBaseRevision → 新版本或检查失败 |
| end_review | sessionId → ended |

update_feedback 同时支持 lease 续约与逐条结果；处理超过租约时必须续约。prepare_update 只能在用户主动要求更新后调用；get_review_context 是只读操作，不隐式创建批次。没有待处理评论时报告无需修改，不进入等待循环。

包内 skill 指导 start→展示链接→结束本轮；用户另行要求更新时执行 context→prepare→claim→inspect→edit→validate/publish→report，然后结束。澄清时回复并释放批次，等待用户下一次主动通知。工具描述和 Resource 共用该约定；不安装 hook、监控子智能体或后台 AI 运行器。MCP Resource 仍提供指南、manifest schema 和模板。

删除类处理发布后通过 set_feedback_location 为该条 modified 结果记录保留父容器的选择器和可选稳定 ID/tag；不改写原评论。该记录与发布版本关联，普通查找失败不推断删除。工作区向桥接发送显式删除位置，唯一匹配后高亮父容器并标注“此处已删除”，不存在或歧义则失败。get /revisions/:revision 经同一会话鉴权返回已发布快照清单；查看原版本使用评论原始 revisionId 和清单入口，有版本横幅、只读评论选择及返回最新版本入口，支持 URL 及刷新恢复，发布事件不替换正在对照的历史视图。

### 9. 快照、验证和自动更新

新会话对清单与批准设计资源创建初始快照。源文件保存只使工作目录变更，不切换浏览器版本。publish_revision 在项目发布锁中复制候选、检查源文件复制期间是否变化、验证候选清单/入口/本地资源及所有有效页面和组件入口的浏览器加载。候选加载失败或新 JS 运行错误使发布失败；原 active 指针保持不变。Playwright 浏览器是需要另行准备的验证运行依赖，doctor 报告安装方式，包安装不隐式下载；缺失时返回 validation_unavailable，不能声称验证通过并发布。

验证对候选快照而非活动预览执行；成功后在事务中记录版本、批次关联和 active 指针并发出 revision.published，持久事件可在崩溃后重放。expectedBaseRevision 不匹配时拒绝旧发布。失败后清理未引用候选；快照不含工具运行目录、秘密配置或项目 node_modules。

外壳始终不因发布刷新。CSS-only 且资源关系可确定时替换样式；否则自动重建 iframe。桥接保存并尽可能恢复路由、滚动、稳定 ID 表单值、焦点；密码/文件字段不采集，任意 JS 内存、弹窗等依赖原型可选的 exportState/restoreState 接口。恢复失败时回到该组合确定性入口并显示提示，保留评论草稿。自动 iframe 重建属于兼容回退，不能称为完整状态热替换。

### 10. 验证策略与交付验收

以示例项目覆盖登录默认/错误状态、桌面/移动设备、共享按钮和输入组件及令牌。验证 schema 与路径约束、批次不可变和重试幂等、租约恢复、游标补读、发布失败保留旧版以及包资源可用。浏览器端覆盖导航、组件状态总览、元素评论、保存后主动要求更新、AI MCP 处理、发布和用户复核。用实际 tarball 在第二个临时项目运行完整闭环；另以真实 Codex 做用户发起的一轮处理与断线恢复验收，不用自制 MCP 客户端成功替代该证据。

协议依据：MCP stdio/Resources 规范与 Codex 本地技能加载机制。参考 https://modelcontextprotocol.io/specification/2025-11-25/basic/transports 、https://skills.extensions.modelcontextprotocol.io/ 、https://learn.chatgpt.com/docs/build-skills 。实施时核对当前 SDK API，不将可选扩展与基础传输混用。

## Risks / Trade-offs

- [用户尚未主动要求更新] → 评论保持待处理；AI 不监控、不自动启动回合。
- [共享组件修改影响多个页面] → 反馈结果说明修改范围，验证候选全部入口；显式依赖仅为辅助，不声称覆盖任意动态依赖。
- [任意 HTML/JS 无法可靠局部热替换] → 样式快路径与 iframe 回退分开，使用可选状态恢复接口并提示丢失状态。
- [双 origin 和非 loopback 绑定增加配置成本] → 返回明确的工作区与预览地址，校验来源，doctor 检查端口和转发配置。
- [浏览器验证需要额外运行依赖] → 明确 doctor/install 指引与失败状态，不在 npm 安装中隐式下载浏览器。
- [快照和上下文可能占用磁盘或包含输入] → 限制采集字段、排除敏感输入，提供有引用约束的保留策略和数据目录说明。

## Migration Plan

这是新包，无已有数据迁移。先完成契约和示例，再实现领域服务与 MCP/HTTP，最后构建工作区并用 tarball 验收。运行数据记录 schemaVersion，迁移前备份，遇到未来版本拒绝写入。发布回退只切换已验证快照指针，不覆盖用户源文件；npm 包回退不得擅自降级数据库。

## Open Questions

- 最终 npm scope、包名和许可证在发布前确认，不影响模块边界或协议。
- 初始设备预设的名称与逻辑尺寸可在示例制作时调整，所有尺寸均由清单显式给出。
