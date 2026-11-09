## Purpose

为本地原型提供可配置地址的交互预览站点，将正在编辑的文件与用户看到的已发布版本分开，经过验证后统一更新页面，并在版本切换或失败时保护评论草稿和可恢复的体验上下文。

## ADDED Requirements

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
浏览器 SHALL 展示不可变的已发布版本；源文件保存 MUST 不自动发布中间状态。发布 SHALL 验证完整候选并绑定基础版本，失败 MUST 保留上一个可用版本。

#### Scenario: Incomplete edit or failed candidate
- **WHEN** AI 保存部分文件，或候选入口缺失、浏览器加载报错、验证环境不可用
- **THEN** 用户继续看到原已发布版本，系统返回检查失败原因而不发布

#### Scenario: Stale publisher
- **WHEN** 发布请求的基础版本与当前版本不符
- **THEN** 系统拒绝旧请求，要求客户端重新获取上下文

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
