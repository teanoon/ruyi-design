## ADDED Requirements

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
审核后的实际工作区 SHALL 对齐批准设计稿的导航与分区、连接状态位置、冗余提示和署名处理、预览控件、设备/状态选择及快捷键、评论原位编辑与归档/重开和历史提示。外壳 SHALL 在左侧菜单底部以左侧标志、右侧上下排列的中英文产品名称展示品牌，连接状态在品牌上方左对齐，两行共用左右边界，版本号位于预览按钮中，并移除顶部横栏与可见项目名称；底层项目身份和画布内项目品牌 MUST 保留。设计稿的模拟内容 SHALL 与真实项目数据区分，不能硬编码示例项目或模拟评论到工具中。交付 MUST 使用同一验收清单对照设计稿与实现，并记录有理由保留的差异；不能仅通过快捷键测试宣称完成同步。

#### Scenario: Compare the approved design and actual workbench
- **WHEN** 在桌面和窄屏对照批准设计稿与真实工作区
- **THEN** 控件层次、提示和规定的交互一致，实际项目保留自己的页面、设备、状态和评论；反馈发布、归档重开、原版本与自动更新仍有效

## MODIFIED Requirements

### Requirement: Product and publisher identity
产品 SHALL 以“如意设计”和“Ruyi Design”为中英文展示名称，以“小爱好出品”或“By LittleHobby”标识出品方，品牌标语 SHALL 为“让设计，更合心意。”；工具页面标题、品牌入口、CLI 帮助及分发文档 MUST 使用同一身份。出品方署名 SHALL 在 CLI 帮助及分发文档可见；工作区外壳 SHALL 使用产品品牌，允许隐藏出品方署名及项目名称而保留底层项目身份。

#### Scenario: Open the review workspace
- **WHEN** 用户打开评审工作区
- **THEN** 页面标题及产品区域显示如意设计身份，CLI 和分发文档保留出品方署名，当前项目仍通过清单和会话独立标识而无需在外壳显示项目名
