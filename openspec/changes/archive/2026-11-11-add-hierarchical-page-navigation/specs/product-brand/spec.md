# Spec Delta

## MODIFIED Requirements

### Requirement: Tool and prototype brand isolation
产品品牌 SHALL 应用于工作区及工具注入的评审控件，MUST 不覆盖使用方设计稿的颜色、字标、组件或项目名称。品牌升级 MUST 保留兼容平铺与层级组织的页面导航、状态和设备选择、组件状态总览，以及用户主动要求更新的评审流程；导航层级 MUST 不改变使用方页面及其评审上下文的身份。

#### Scenario: Preview an independently branded project
- **WHEN** 用户在如意设计中预览 Northstar 示例或其他项目
- **THEN** 工具外壳展示如意设计，iframe 设计稿继续使用该项目资产，保存评论不自动唤醒智能体或创建处理轮次

#### Scenario: Organize a separately branded project's pages
- **WHEN** 使用方为页面配置可折叠分组和同时具有子页面的父页面
- **THEN** 外壳按层级展示导航，原型品牌、页面状态与设备选择、组件总览及评论目标保持有效

### Requirement: Reusable brand assets
产品 SHALL 提供可在应用导航、浏览器图标及文档中复用的标志和字标；标志 SHALL 从如意器物曲线提炼，MUST 在小尺寸、单色和浅色背景下可识别，并具备适当的可访问名称或装饰标记。标准与单色符号资产 MUST 去除外围白色底板并紧裁至方印边界，圆角外透明，favicon MUST 不包含人为外围留白；既定方印图案 SHALL 保留。

#### Scenario: Display a compact brand mark
- **WHEN** 工作区在窄屏或浏览器图标尺寸展示品牌
- **THEN** 简化标志仍清晰，不能仅依赖细小文案、色差或复杂装饰识别产品

#### Scenario: Display a transparent tight favicon
- **WHEN** 浏览器标签或深色表面显示标准图标
- **THEN** 圆角外保持透明，图案充分利用图标视口，不显示白色底板或外围空白

### Requirement: Compact component comparison and contextual editing
组件展示 SHALL 保留设备逻辑宽度，按内容所需高度展示各状态而非各自占满设备高度；页面预览 MUST 保留设备逻辑视口。尺寸消息 MUST 校验来源、frameId 及有限尺寸范围。评论 SHALL 按创建顺序倒序排列，只有精确选择同一元素时 SHALL 激活对应评论，父子元素的评论 MUST 相互独立；用户 SHALL 能通过显式新增操作为同一元素保留多条独立评论，draft 编辑和回复输入框 SHALL 位于对应卡片内；已固定处理输入 MUST 不被直接编辑。Ctrl+Enter SHALL 在表单有效时保存，用户仍通过对话主动发起一轮更新。

#### Scenario: Review compact component states
- **WHEN** 用户查看组件的全部适用状态
- **THEN** 每个状态只占用内容所需高度，保持设备宽度，页面视口及原版本上下文不变

#### Scenario: Edit a previously commented element
- **WHEN** 用户再次选择已有 draft 评论的元素
- **THEN** 激活原评论并在其卡片原位编辑，不隐式新增评论；用户仍可显式新增同元素评论；Ctrl+Enter 保存后创建顺序不变

### Requirement: Prototype and runtime workbench parity
审核后的实际工作区 SHALL 对齐批准设计稿的导航与分区、连接状态位置、冗余提示和署名处理、预览控件、设备/状态选择及快捷键、评论原位编辑与归档/重开和历史提示。外壳 SHALL 在左侧菜单底部以左侧标志、右侧上方中文名称和下方连接状态胶囊展示品牌，状态胶囊替换英文副标题，MUST 只包含状态文字且不包含图标或符号；状态 SHALL 继续区分连接中、已连接、修改中、重连和失败，版本号位于预览按钮中，并移除顶部横栏与可见项目名称；底层项目身份和画布内项目品牌 MUST 保留。设计稿的模拟内容 SHALL 与真实项目数据区分，不能硬编码示例项目或模拟评论到工具中。交付 MUST 使用同一验收清单对照设计稿与实现，并记录有理由保留的差异；不能仅通过快捷键测试宣称完成同步。

#### Scenario: Compare the approved design and actual workbench
- **WHEN** 在桌面和窄屏对照批准设计稿与真实工作区
- **THEN** 控件层次、提示和规定的交互一致，实际项目保留自己的页面、设备、状态和评论；反馈发布、归档重开、原版本与自动更新仍有效

#### Scenario: Show the approved connection capsule
- **WHEN** 用户在桌面或窄屏查看侧栏底部品牌
- **THEN** 标志位于左侧，“如意设计”与纯文字状态胶囊在右侧上下排列，不显示英文副标题、独立状态行或状态点，状态信息仍可被辅助技术读取
