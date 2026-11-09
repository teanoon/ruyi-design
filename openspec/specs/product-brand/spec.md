# product-brand Specification

## Purpose

为小爱好旗下的多平台交互设计预览与评审产品建立可复用的身份和视觉规范，使如意设计的工具界面、图标、状态反馈、接入文档与品牌署名保持一致，同时保障用户设计稿自身的品牌和交互上下文独立。

## Requirements

### Requirement: Product and publisher identity
产品 SHALL 以“如意设计”和“Ruyi Design”为中英文展示名称，以“小爱好出品”或“By LittleHobby”标识出品方，品牌标语 SHALL 为“让设计，更合心意。”；工具页面标题、品牌入口、CLI 帮助及分发文档 MUST 使用同一身份。

#### Scenario: Open the review workspace
- **WHEN** 用户打开评审工作区
- **THEN** 页面标题及产品区域显示如意设计身份，出品方署名可见，当前设计项目名称仍独立呈现

### Requirement: Reusable brand assets
产品 SHALL 提供可在应用导航、浏览器图标及文档中复用的标志和字标；标志 SHALL 从如意器物曲线提炼，MUST 在小尺寸、单色和浅色背景下可识别，并具备适当的可访问名称或装饰标记。

#### Scenario: Display a compact brand mark
- **WHEN** 工作区在窄屏或浏览器图标尺寸展示品牌
- **THEN** 简化标志仍清晰，不能仅依赖细小文案、色差或复杂装饰识别产品

### Requirement: Consistent accessible workspace language
工具外壳 SHALL 使用一致的品牌颜色、背景、字体、边框、焦点和交互状态；品牌展示不得改变成功、错误、删除及历史版本的语义。正文对比度 MUST 至少达到 4.5:1，重要非文本控件和焦点边界 MUST 保持可辨识；键盘操作及减少动效偏好 MUST 保持有效。

#### Scenario: Review and compare revisions
- **WHEN** 用户添加评论、查看归档、定位删除内容或打开原版本
- **THEN** 界面使用一致的如意设计视觉，当前与原版本、待复核与已归档、普通高亮与删除标记仍可区分，原有操作可通过键盘完成

### Requirement: Tool and prototype brand isolation
产品品牌 SHALL 应用于工作区及工具注入的评审控件，MUST 不覆盖使用方设计稿的颜色、字标、组件或项目名称。品牌升级 MUST 保留单层页面导航、状态和设备选择、组件状态总览，以及用户主动要求更新的评审流程。

#### Scenario: Preview an independently branded project
- **WHEN** 用户在如意设计中预览 Northstar 示例或其他项目
- **THEN** 工具外壳展示如意设计，iframe 设计稿继续使用该项目资产，保存评论不自动唤醒智能体或创建处理轮次

### Requirement: Product-specific review prototypes
如意设计 SHALL 提供自身产品的独立仓库设计稿，包含页面/状态/设备入口、同源共享组件和设计令牌；本产品评审 MUST 指向该设计稿，不能以消费者 demo 替代。独立设计稿 MUST 使用单独的评审数据根目录，保留 demo 历史。

#### Scenario: Review Ruyi Design itself
- **WHEN** 用户要求评审如意设计产品
- **THEN** 返回的评审站点载入如意设计自身工作区、评论、归档及历史对照设计，提供组件和令牌展示，并与 Northstar demo 的评论和版本隔离

### Requirement: Compact component comparison and contextual editing
组件展示 SHALL 保留设备逻辑宽度，按内容所需高度展示各状态而非各自占满设备高度；页面预览 MUST 保留设备逻辑视口。尺寸消息 MUST 校验来源、frameId 及有限尺寸范围。评论 SHALL 按创建顺序倒序排列，已有评论的元素选择 SHALL 激活对应评论，draft 编辑和回复输入框 SHALL 位于对应卡片内；已固定处理输入 MUST 不被直接编辑。Ctrl+Enter SHALL 在表单有效时保存，用户仍通过对话主动发起一轮更新。

#### Scenario: Review compact component states
- **WHEN** 用户查看组件的全部适用状态
- **THEN** 每个状态只占用内容所需高度，保持设备宽度，页面视口及原版本上下文不变

#### Scenario: Edit a previously commented element
- **WHEN** 用户再次选择已有 draft 评论的元素
- **THEN** 激活原评论并在其卡片原位编辑，不新增重复评论；Ctrl+Enter 保存后创建顺序不变

### Requirement: Explicit manual archiving
浏览器 SHALL 为未归档且不在排队/处理中批次内的评论提供独立归档操作，包含无需修改的处理结果、待澄清评论、新建及重新打开的草稿。手动归档 MUST 不伪造已验证修复，保留处理结果和原始上下文，通过独立 resolution 标记与确认解决区分；只有用户操作才归档。排队或处理中批次的评论 MUST 拒绝归档，保护固定输入与发布状态。

#### Scenario: Archive unchanged work or a reopened comment
- **WHEN** 用户归档无需修改的已发布结果或重新打开的草稿
- **THEN** 评论移入归档，可重新打开并再次归档，刷新后状态保留；处理结果仍保持原来的 modified/unaddressed 语义
