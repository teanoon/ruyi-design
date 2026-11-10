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

### Requirement: Context-aware workspace keyboard shortcuts
工作区 SHALL 在非输入状态以未带 Ctrl、Meta、Alt 的 C 键切换预览，左右方向键切换设备，上下方向键切换页面状态；C SHALL 不区分大小写。输入框、文本域、可编辑内容、原生选择控件及具有方向键交互语义的控件中的按键 MUST 保留原行为；输入法组合输入、已被处理的事件和长按重复 MUST 不触发快捷操作。快捷操作 SHALL 与对应按钮或下拉框共享选择与禁用规则。

#### Scenario: Toggle preview without editing
- **WHEN** 当前工作区允许预览且焦点位于非输入区域，用户按 C
- **THEN** 预览与元素评论模式互相切换，按钮文字、按下状态和画布交互同步；历史查看中禁用的预览按钮不能通过快捷键绕过

#### Scenario: Preserve text entry and native controls
- **WHEN** 用户在评论、原型表单、可编辑内容或原生选择控件内按 C 或方向键，或者正在使用中文输入法
- **THEN** 保留原有输入和控件行为，不切换模式、设备或页面状态；Ctrl/Cmd+Enter 保存评论继续可用

### Requirement: Ordered valid keyboard navigation
设备切换 SHALL 按当前设备下拉框显示顺序执行，左为前一项、右为后一项；页面状态切换 SHALL 按当前状态下拉框显示顺序执行，上为前一项、下为后一项。到达边界或没有可选项时 MUST 保持当前组合且不循环。状态切换 SHALL 优先保留当前设备，若不支持则使用目标状态的第一个可用设备，其顺序和鼠标切换 MUST 一致。组件 SHALL 仅支持设备切换且继续总览全部状态，令牌 SHALL 不响应设备和状态切换。

#### Scenario: Skip unsupported combinations
- **WHEN** 当前页面状态只提供部分设备，用户按左右方向键
- **THEN** 只在当前显示的有效设备间切换，不创建不存在的组合，并同步下拉框、画布和深链接

#### Scenario: Change state with a missing device
- **WHEN** 用户按上下方向键切换状态，目标状态没有当前设备
- **THEN** 使用与下拉框选择相同的有效设备回退规则，边界处保持不变

#### Scenario: Navigate a component or token showcase
- **WHEN** 用户在组件总览或令牌展示中使用方向键
- **THEN** 组件只响应有效设备方向键；令牌不响应组合切换；不出现组件状态菜单

### Requirement: Preview focus ownership
快捷键 SHALL 在工作区外壳的非输入区域可用；焦点在原型 iframe 的非输入区域时 C SHALL 可退出或进入预览，元素评论模式的方向键 SHALL 可控制宿主组合。体验模式中 iframe 内的方向键 MUST 保留给原型，不能阻止其滚动、导航或交互。每次物理按键 MUST 最多执行一次工作区操作。

#### Scenario: Leave preview after interacting with a prototype
- **WHEN** 用户在预览 iframe 内完成交互、焦点不在输入或原生交互控件上并按 C
- **THEN** 宿主退出预览，模式同步；在同一区域按方向键时原型正常处理，工作区组合不变

#### Scenario: Navigate from the commenting canvas
- **WHEN** 焦点位于元素评论画布非输入区域并按方向键
- **THEN** 工作区按有效组合切换一次，页面与组件中的输入、原生控件和事件来源保护继续有效
