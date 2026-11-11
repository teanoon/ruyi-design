# Spec Delta

## MODIFIED Requirements

### Requirement: Compact component comparison and contextual editing
组件展示 SHALL 保留设备逻辑宽度，按内容所需高度展示各状态而非各自占满设备高度；页面预览 MUST 保留设备逻辑视口。尺寸消息 MUST 校验来源、frameId 及有限尺寸范围。评论 SHALL 按创建顺序倒序排列，只有精确选择同一元素时 SHALL 激活对应评论，父子元素的评论 MUST 相互独立；同一元素 SHALL 复用已有讨论（包括已解决/归档），不提供新增独立评论入口，draft 编辑和回复输入框 SHALL 位于对应卡片内；已固定处理输入 MUST 不被直接编辑。Ctrl+Enter SHALL 在表单有效时保存，用户仍通过对话主动发起一轮更新。

#### Scenario: Review compact component states
- **WHEN** 用户查看组件的全部适用状态
- **THEN** 每个状态只占用内容所需高度，保持设备宽度，页面视口及原版本上下文不变

#### Scenario: Edit a previously commented element
- **WHEN** 用户再次选择已有 draft 评论的元素
- **THEN** 激活原评论并在其卡片原位编辑，不隐式新增评论；多个需求通过该讨论正文或回复补充；Ctrl+Enter 保存后创建顺序不变

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


## REMOVED Requirements

### Requirement: Explicit manual archiving
**Reason**: 用户已确定按状态精简并展开操作列表，不再在评论卡片提供归档或无需处理动作；待复核通过确认解决或重新打开完成决策。
**Migration**: 保留已归档分组、原有 resolution/历史和重开能力。用户不再通过卡片主动归档；未处理新评论可删除，已处理反馈按复核/回复/重开流程继续讨论。旧归档记录不伪装成确认解决。
