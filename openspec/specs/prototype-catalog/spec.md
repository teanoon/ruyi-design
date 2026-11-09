# prototype-catalog Specification

## Purpose

将仓库中的独立 HTML、CSS、JavaScript 及资源组织为可稳定访问的页面、状态、设备组合，帮助用户直接体验目标场景，并使评论与 AI 上下文具有一致身份而不依赖文件名或历史操作。

## Requirements


### Requirement: Explicit valid combinations
系统 SHALL 从版本化项目清单读取页面、页面状态、设备及入口，以稳定 ID 标识；MUST 只展示声明的有效组合，不要求生成全部组合。

#### Scenario: Unsupported device combination
- **WHEN** 某页面状态只声明桌面入口
- **THEN** 系统不为其生成移动入口，并对直接访问不存在的组合给出明确提示

#### Scenario: Invalid manifest
- **WHEN** 清单存在重复 ID、缺失引用或缺失入口
- **THEN** 系统报告具体位置，拒绝将无效清单作为可用版本加载

### Requirement: Page state device navigation
工作区 SHALL 以页面、状态、设备组合组织设计；左侧页面列表 MUST 为单层目录，状态和设备 SHALL 通过内容区下拉框选择，并提供可恢复选中组合的深链接。

#### Scenario: Open a direct state link
- **WHEN** 用户打开某页面错误状态与移动设备的链接
- **THEN** 导航选中该组合并直接展示错误状态，不要求用户先执行一连串操作

### Requirement: Reproducible interactive entries
原型 SHALL 支持无需构建的 HTML/CSS/JS、本地资源及多页面交互；每个已声明入口 MUST 以确定的初始状态启动，允许多个组合复用文件。

#### Scenario: Shared file with different initial states
- **WHEN** 默认状态与错误状态指向相同 HTML 但具有不同初始化参数
- **THEN** 两个入口分别稳定呈现各自状态，体验模式允许原型正常交互

### Requirement: Reusable device profiles
页面与组件 SHALL 引用同一组项目设备档案；档案 MUST 明确逻辑视口尺寸，画布适配缩放 MUST 不改变该视口定义。

#### Scenario: Fit a large canvas into the workspace
- **WHEN** 浏览器空间小于所选设备视口
- **THEN** 工作区可缩小画布展示，但原型的布局视口保持设备配置值
