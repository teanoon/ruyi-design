# preview-revisions Specification

## Purpose

为本地原型提供可配置地址的交互预览站点，将正在编辑的文件与用户看到的已发布版本分开，经过验证后统一更新页面，并在版本切换或失败时保护评论草稿和可恢复的体验上下文。

## Requirements


### Requirement: Configurable local access
预览站点 SHALL 支持 loopback、指定接口和通配绑定，允许配置端口及访问基址；返回的浏览器 URL MUST 使用可访问的主机地址而非通配绑定地址。

#### Scenario: Bind to all interfaces
- **WHEN** 用户指定 0.0.0.0 以及访问基址
- **THEN** 服务按要求监听并返回基址对应的工作区和预览地址

#### Scenario: Access through a port-selecting gateway
- **WHEN** 用户指定携带端口选择查询参数的网关访问基址
- **THEN** 返回地址保留路由参数，设计资源、模块、交互和工作区事件能通过该入口访问，原型仍无法读取管理凭证，候选验证不依赖网关的开发证书

#### Scenario: Requested port unavailable
- **WHEN** 显式指定端口已被占用
- **THEN** 系统报告冲突，不静默改用另一端口

### Requirement: Scoped and authenticated serving
服务 MUST 仅暴露批准的设计资源和工具界面，阻止路径及符号链接越界，并校验管理请求的会话身份和来源；原型脚本 MUST 不直接获得管理 API 凭证。

#### Scenario: Request a file outside design root
- **WHEN** 请求通过编码路径或符号链接访问设计目录外的文件
- **THEN** 系统拒绝返回文件内容

#### Scenario: Invalid management request
- **WHEN** 请求缺少有效会话凭证或来自不允许的 Origin
- **THEN** 管理 API 拒绝读取评审数据或执行写操作

### Requirement: Atomic verified publication
浏览器 SHALL 展示不可变的已发布版本；源文件保存 MUST 不自动发布中间状态。发布 SHALL 使用配置/发现且实际启动检查通过的浏览器验证完整候选并绑定基础版本，失败 MUST 保留上一个可用版本；MUST 不因浏览器不可用改为仅静态验证。

#### Scenario: Incomplete edit or failed candidate
- **WHEN** AI 保存部分文件，或候选入口缺失、浏览器加载报错、验证环境不可用
- **THEN** 用户继续看到原已发布版本，系统返回检查失败原因而不发布

#### Scenario: Stale publisher
- **WHEN** 发布请求的基础版本与当前版本不符
- **THEN** 系统拒绝旧请求，要求客户端重新获取上下文

#### Scenario: Publish with an existing system browser
- **WHEN** 系统或显式浏览器可用且完整候选验证通过
- **THEN** 无需另装默认 Chromium 即可按原子流程发布；反馈与对话两种来源遵守相同验证和失败保护

### Requirement: Automatic browser updates with explicit fallback
发布成功后工作区 SHALL 自动展示新版本且不刷新外壳，MUST 保留已保存的待处理评论；系统 SHALL 尽可能恢复路由、滚动和安全表单字段，不能恢复时 MUST 明确提示并回到该组合入口。

#### Scenario: Style-only update
- **WHEN** 新版本仅修改可安全替换的样式
- **THEN** 原型自动更新样式并保留现有交互状态

#### Scenario: Script replacement requires reinitialization
- **WHEN** JS 或结构变化需要重建原型
- **THEN** 系统自动重建原型并尝试恢复支持的状态，外壳及评论草稿不丢失，不声称保留任意 JS 内存状态

### Requirement: Version traceability
发布记录 SHALL 关联来源批次、逐条处理结果和原型清单，历史评论 MUST 保留其实际评审版本。

#### Scenario: Review old-version feedback after release
- **WHEN** v4 发布后读取用户在 v3 保存的评论
- **THEN** 系统仍返回 v3 上下文以及该评论关联的 v4 处理结果，不将原评论改写为 v4 评论

### Requirement: Non-destructive branded data discovery
新项目默认评审数据目录 SHALL 为 `.ruyi-design/`。存在唯一的既有 `.uxai-review/` 或 `.ruyi-uxai/` 且没有其他候选时，系统 SHALL 原地复用旧目录；显式 dataRoot SHALL 优先。`.ruyi-design/`、`.ruyi-uxai/`、`.uxai-review/` 中任意多个候选目录同时存在且未指定 dataRoot 时 MUST 报告歧义，不能静默选择、合并或创建另一套数据。

#### Scenario: Open an existing review after rebranding
- **WHEN** 项目仅存在有效的 `.uxai-review/` 或 `.ruyi-uxai/` 且通过新命令启动
- **THEN** 系统复用既有数据库与快照，保留会话、评论及当前版本身份，不重建初始快照或改写版本 ID

#### Scenario: Conflicting data directories
- **WHEN** 任意多个默认候选目录存在且未显式选择 dataRoot
- **THEN** 启动报告候选目录的歧义并要求明确选择，原有文件及进程锁语义不变

#### Scenario: Start a fresh project
- **WHEN** 项目没有旧数据目录且未传入 dataRoot
- **THEN** 系统在 `.ruyi-design/` 初始化本地数据，并与设计资产目录分离

### Requirement: Legacy prototype and revision continuity
品牌升级 SHALL 保留历史快照、原评论锚点、归档、处理结果及原版本对照；新桥接 SHALL 优先使用 `window.ruyiDesignReviewState`，在其不存在时依次兼容 `window.ruyiUxaiReviewState`、`window.uxaiReviewState` 的恢复契约。读取旧快照 MUST 不要求修改或重新发布其中的源文件。

#### Scenario: Restore an old prototype
- **WHEN** 旧设计稿仅声明 `window.uxaiReviewState` 并通过如意设计发布或查看
- **THEN** 可序列化状态的捕获与恢复继续有效，多个接口同时声明时仅使用优先级最高的接口且只调用一次

#### Scenario: Inspect an archived deletion comment
- **WHEN** 品牌升级后用户查看已归档评论的原版本或删除标记
- **THEN** 原版本和删除位置记录保持可读，当前发布指针及评论状态不因查看而改变
