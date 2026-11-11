# product-brand Specification

## Purpose

为小爱好旗下的多平台交互设计预览与评审产品建立可复用的身份和视觉规范，使如意设计的工具界面、图标、状态反馈、接入文档与品牌署名保持一致，同时保障用户设计稿自身的品牌和交互上下文独立。

## Requirements

### Requirement: Product and publisher identity
产品 SHALL 以“如意设计”和“Ruyi Design”为中英文展示名称，以“小爱好出品”或“By LittleHobby”标识出品方，品牌标语 SHALL 为“让设计，更合心意。”；工具页面标题、品牌入口、CLI 帮助及分发文档 MUST 使用同一身份。出品方署名 SHALL 在 CLI 帮助及分发文档可见；工作区外壳 SHALL 使用产品品牌，允许隐藏出品方署名及项目名称而保留底层项目身份。

#### Scenario: Open the review workspace
- **WHEN** 用户打开评审工作区
- **THEN** 页面标题及产品区域显示如意设计身份，CLI 和分发文档保留出品方署名，当前项目仍通过清单和会话独立标识而无需在外壳显示项目名

### Requirement: Reusable brand assets
产品 SHALL 提供可在应用导航、浏览器图标及文档中复用的标志和字标；标志 SHALL 从如意器物曲线提炼，MUST 在小尺寸、单色和浅色背景下可识别，并具备适当的可访问名称或装饰标记。标准与单色符号资产 MUST 去除外围白色底板并紧裁至方印边界，圆角外透明，favicon MUST 不包含人为外围留白；既定方印图案 SHALL 保留。

#### Scenario: Display a compact brand mark
- **WHEN** 工作区在窄屏或浏览器图标尺寸展示品牌
- **THEN** 简化标志仍清晰，不能仅依赖细小文案、色差或复杂装饰识别产品

#### Scenario: Display a transparent tight favicon
- **WHEN** 浏览器标签或深色表面显示标准图标
- **THEN** 圆角外保持透明，图案充分利用图标视口，不显示白色底板或外围空白

### Requirement: Consistent accessible workspace language
工具外壳 SHALL 使用一致的品牌颜色、背景、字体、边框、焦点和交互状态；品牌展示不得改变成功、错误、删除及历史版本的语义。正文对比度 MUST 至少达到 4.5:1，重要非文本控件和焦点边界 MUST 保持可辨识；键盘操作及减少动效偏好 MUST 保持有效。

#### Scenario: Review and compare revisions
- **WHEN** 用户添加评论、查看归档、定位删除内容或打开原版本
- **THEN** 界面使用一致的如意设计视觉，当前与原版本、待复核与已归档、普通高亮与删除标记仍可区分，原有操作可通过键盘完成

### Requirement: Tool and prototype brand isolation
产品品牌 SHALL 应用于工作区及工具注入的评审控件，MUST 不覆盖使用方设计稿的颜色、字标、组件或项目名称。品牌升级 MUST 保留兼容平铺与层级组织的页面导航、状态和设备选择、组件状态总览，以及用户主动要求更新的评审流程；导航层级 MUST 不改变使用方页面及其评审上下文的身份。

#### Scenario: Preview an independently branded project
- **WHEN** 用户在如意设计中预览 Northstar 示例或其他项目
- **THEN** 工具外壳展示如意设计，iframe 设计稿继续使用该项目资产，保存评论不自动唤醒智能体或创建处理轮次

#### Scenario: Organize a separately branded project's pages
- **WHEN** 使用方为页面配置可折叠分组和同时具有子页面的父页面
- **THEN** 外壳按层级展示导航，原型品牌、页面状态与设备选择、组件总览及评论目标保持有效

### Requirement: Product-specific review prototypes
如意设计 SHALL 提供自身产品的独立仓库设计稿，包含页面/状态/设备入口、同源共享组件和设计令牌；本产品评审 MUST 指向该设计稿，不能以消费者 demo 替代。独立设计稿 MUST 使用单独的评审数据根目录，保留 demo 历史。

#### Scenario: Review Ruyi Design itself
- **WHEN** 用户要求评审如意设计产品
- **THEN** 返回的评审站点载入如意设计自身工作区、评论、归档及历史对照设计，提供组件和令牌展示，并与 Northstar demo 的评论和版本隔离

### Requirement: Compact component comparison and contextual editing
组件展示 SHALL 保留设备逻辑宽度，按内容所需高度展示各状态而非各自占满设备高度；页面预览 MUST 保留设备逻辑视口。尺寸消息 MUST 校验来源、frameId 及有限尺寸范围。评论 SHALL 按创建顺序倒序排列，只有精确选择同一元素时 SHALL 激活对应评论，父子元素的评论 MUST 相互独立；同一元素 SHALL 复用已有讨论（包括已解决/归档），不提供新增独立评论入口，draft 编辑和回复输入框 SHALL 位于对应卡片内；已固定处理输入 MUST 不被直接编辑。Ctrl+Enter SHALL 在表单有效时保存，用户仍通过对话主动发起一轮更新。

#### Scenario: Review compact component states
- **WHEN** 用户查看组件的全部适用状态
- **THEN** 每个状态只占用内容所需高度，保持设备宽度，页面视口及原版本上下文不变

#### Scenario: Edit a previously commented element
- **WHEN** 用户再次选择已有 draft 评论的元素
- **THEN** 激活原评论并在其卡片原位编辑，不隐式新增评论；多个需求通过该讨论正文或回复补充；Ctrl+Enter 保存后创建顺序不变

### Requirement: Discoverable shortcut affordances
产品设计稿与实际工作区 SHALL 在预览按钮附近展示 C 提示，在设备和状态控件附近分别展示左右与上下方向键提示，并提供说明输入与预览画布作用范围的可访问文本，MUST 不显示独立快捷键说明区块。提示 MUST 与实际可用操作一致；隐藏或禁用的操作不能被提示为可用，鼠标操作和窄屏可用性 SHALL 保留。

#### Scenario: Discover shortcuts in the workbench
- **WHEN** 用户查看页面工作区的预览、设备和状态控件
- **THEN** 无需猜测即可发现对应快捷键；通过鼠标和键盘执行操作得到一致的模式与组合

#### Scenario: View component shortcuts on a narrow screen
- **WHEN** 用户在窄屏查看组件总览
- **THEN** 控件与快捷键说明可读且不溢出，不展示页面状态切换提示

### Requirement: Approved prototype before runtime implementation
本次交付 MUST 先在如意设计自身设计稿中提供可交互的快捷键及工作区同步方案，并在既有产品评审会话发布可审核版本。修改实际工具运行时前 MUST 获得用户对具体设计稿版本的明确批准，记录版本、确认内容及适用范围；自动检查、发布成功、创建变更或笼统要求继续 MUST 不视为设计批准。审核前的变更 SHALL 限于设计稿及其验证和说明，不得修改真实工具以支持新行为。

#### Scenario: Publish a prototype for approval
- **WHEN** 快捷键设计稿完成验证并发布到原产品 session
- **THEN** 用户可以在原入口体验和评论，真实工具保持现有行为；提供待审核版本和验收项后等待用户明确批准

#### Scenario: User requests revisions instead of approving
- **WHEN** 用户提出设计调整或未明确批准待审核版本
- **THEN** 只继续迭代设计稿，运行时实现阶段保持待审核；新版本重新提交审核

### Requirement: Prototype and runtime workbench parity
审核后的实际工作区 SHALL 对齐批准设计稿的导航与分区、连接状态位置、冗余提示和署名处理、预览控件、设备/状态选择及快捷键、评论状态操作矩阵、原位编辑、单元素讨论、重开和历史提示。外壳 SHALL 在左侧菜单底部以左侧标志、右侧上方中文名称和下方连接状态胶囊展示品牌，状态胶囊替换英文副标题，MUST 只包含状态文字且不包含图标或符号；状态 SHALL 继续区分连接中、已连接、修改中、重连和失败，版本号位于预览按钮中，并移除顶部横栏与可见项目名称；底层项目身份和画布内项目品牌 MUST 保留。设计稿的模拟内容 SHALL 与真实项目数据区分，不能硬编码示例项目或模拟评论到工具中。交付 MUST 使用同一验收清单对照设计稿与实现，并记录有理由保留的差异；不能仅通过快捷键测试宣称完成同步。

#### Scenario: Compare the approved design and actual workbench
- **WHEN** 在桌面和窄屏对照批准设计稿与真实工作区
- **THEN** 控件层次、提示和规定的交互一致，实际项目保留自己的页面、设备、状态和评论；反馈发布、既有归档读取与重开、原版本与自动更新仍有效

#### Scenario: Show the approved connection capsule
- **WHEN** 用户在桌面或窄屏查看侧栏底部品牌
- **THEN** 标志位于左侧，“如意设计”与纯文字状态胶囊在右侧上下排列，不显示英文副标题、独立状态行或状态点，状态信息仍可被辅助技术读取

#### Scenario: Show all applicable comment actions without overflow menus
- **WHEN** 用户在桌面或窄屏浏览任一评论状态
- **THEN** 适用操作按固定顺序直接展开，窄屏允许换行，不使用更多菜单、不隐藏到 hover 中；待复核突出确认解决，删除与撤销重开文案明确，焦点与键盘操作可用
