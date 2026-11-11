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
工作区 SHALL 以页面、状态、设备组合组织设计；左侧页面导航 SHALL 支持可折叠层级，页面节点 MUST 能同时拥有自身入口和子节点，纯分组 MUST 不要求页面入口。状态和设备 SHALL 通过内容区下拉框选择，并提供可恢复选中组合的深链接；业务 Tab 作为独立页面时 MUST 保留各自页面身份与状态。

#### Scenario: Open a direct state link
- **WHEN** 用户打开某页面错误状态与移动设备的链接
- **THEN** 导航展开该页面的祖先并定位选中项，直接展示错误状态，不要求用户先执行一连串操作

#### Scenario: Select a parent page
- **WHEN** 用户点击“订单管理”父节点的页面名称
- **THEN** 打开订单管理自身页面，不添加额外“概览”子节点，不改变该节点的展开状态，状态和设备继续使用有效组合选择规则

#### Scenario: Toggle a parent without navigating
- **WHEN** 用户点击父节点的独立展开/收起按钮
- **THEN** 仅改变子节点可见性，当前页面、状态、设备、画布和评论编辑内容保持不变，不新增页面导航历史

#### Scenario: Open a pure group
- **WHEN** 用户点击无页面入口的纯分组名称或展开按钮
- **THEN** 仅展开或收起其子节点，不生成页面或评论目标

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

### Requirement: Optional validated page hierarchy
项目清单 SHALL 支持可选的、有序递归页面导航结构，节点 SHALL 以稳定 ID 标识并支持页面引用、展示名称及子节点；页面定义与页面 ID MUST 独立于导航位置。系统 MUST 拒绝节点 ID 重复、页面引用缺失、同一页面重复引用，以及既无页面又无有效子节点的节点；纯分组 MUST 有非空展示名称。错误 MUST 指出具体导航位置。未配置导航或导航为空时 SHALL 按原 pages 顺序平铺；部分配置时未引用页面 SHALL 按原 pages 顺序追加至根级。页面总数 MUST 按页面定义计算，分组子页面数量 MUST 只计算后代页面，不包含父节点自身页面。

#### Scenario: Load an existing flat manifest
- **WHEN** 项目使用没有导航字段的既有 schemaVersion 1 清单
- **THEN** 所有页面按原顺序显示，状态、设备、组件和令牌保持可用，无需迁移

#### Scenario: Reject an invalid hierarchy
- **WHEN** 导航中存在重复节点 ID、未知页面、重复页面引用、无有效内容的节点或没有名称的纯分组
- **THEN** 系统拒绝将该清单加载为可用版本，并报告错误位置及原因

#### Scenario: Keep pages accessible in a partial hierarchy
- **WHEN** 目录只引用部分页面
- **THEN** 已引用页面按声明层级和顺序显示，其余页面按 pages 顺序追加根级，每个页面只有一个入口

#### Scenario: Reorganize without changing identity
- **WHEN** 某页面被移到另一分组或祖先分组改名，页面 ID 保持不变
- **THEN** 页面原有组合链接和评论目标继续有效，不因导航路径改变创建新页面身份

#### Scenario: Count parent pages and descendants
- **WHEN** 系统有 10 个父页面，每个父页面包含 5 个子页面
- **THEN** 页面总数显示 60，每个父节点的子页面数量显示 5，纯分组不增加页面总数

### Requirement: Navigation expansion and current page visibility
导航 SHALL 允许多个分组同时展开，并按项目和稳定节点 ID 记忆用户的展开偏好；存储不可用时 SHALL 保持本次工作区可用。首次进入时 SHALL 展开当前页面祖先，其他无记忆分组默认收起。当前页面 MUST 有独立选中样式和当前页语义，祖先只提供后代选中提示。用户 SHALL 能收起包含当前页面的分组而继续查看画布，普通重绘 MUST 不撤销该操作。深链接、浏览器历史恢复、评论定位及版本切换 SHALL 使用所显示版本的层级展开并定位目标；不存在的页面 SHALL 沿用缺失入口提示与有效页面回退行为，MUST 不修改历史快照。

#### Scenario: Collapse the active branch
- **WHEN** 当前画布展示“待发货”，用户收起“订单管理”并触发后续普通界面重绘
- **THEN** 该分组保持收起，画布仍展示“待发货”，父节点显示后代选中提示而非自身页面选中高亮

#### Scenario: Restore independent expansion preferences
- **WHEN** 用户展开多个分组后刷新工作区
- **THEN** 同一项目仍存在的分组恢复展开偏好，其他项目的导航偏好不受影响，当前页面祖先可见

#### Scenario: Locate a comment in another revision
- **WHEN** 用户定位历史评论，目标页面在该历史版本属于另一个分组
- **THEN** 使用历史版本目录展开祖先并定位对应组合，返回最新版本时使用最新目录，页面和评论身份保持不变

### Requirement: Searchable hierarchical page navigation
页面导航 SHALL 提供本地名称搜索，忽略首尾空白与英文大小写，匹配页面名称、导航展示名及祖先分组名称；匹配分组名称 SHALL 保留其后代页面。搜索结果 MUST 保留匹配页面的祖先路径和原有顺序，临时展开相关路径，并在无结果时提供明确反馈。选择结果 SHALL 保留查询；清空搜索 SHALL 恢复搜索前的展开偏好。搜索 MUST 不改写长期展开偏好和页面总数；外部链接、评论或版本切换主动定位时 SHALL 清除搜索以确保目标可见。

#### Scenario: Search an ambiguous page name
- **WHEN** 多个分组都有“设置”页面，用户搜索“设置”
- **THEN** 显示所有匹配页面及各自的祖先路径，用户可区分并打开目标

#### Scenario: Search a group and restore the tree
- **WHEN** 用户搜索“订单管理”，随后清空搜索
- **THEN** 搜索期间展示该分组下所有页面，清空后恢复搜索前的展开偏好，页面总数保持不变

#### Scenario: Locate a target hidden by search
- **WHEN** 当前查询不匹配评论或版本切换将定位的目标页面
- **THEN** 清除查询，展开所显示版本中的目标祖先并定位页面

### Requirement: Accessible independent navigation controls
页面名称和展开按钮 MUST 是独立、可通过键盘操作的控件；展开按钮 SHALL 具有可访问名称和展开状态，当前页面 SHALL 具有当前页语义。Tab SHALL 按可见控件顺序移动，Enter/Space SHALL 执行对应操作；重绘 MUST 保留有效焦点，收起包含焦点的子树时 SHALL 将焦点移回所属展开按钮。焦点位于页面导航或搜索时，方向键 MUST 不切换工作区设备或状态，搜索输入 MUST 保留原生编辑行为；其他区域原有快捷键规则继续有效。窄屏 MUST 能识别层级和操作，不依赖悬浮且不产生横向溢出。

#### Scenario: Operate a parent using the keyboard
- **WHEN** 用户通过 Tab 到达父页面名称并按 Enter，再到达其展开按钮并按 Space
- **THEN** 前一次操作仅打开父页面，后一次仅展开或收起子节点，焦点仍可继续导航，方向键不误切换页面组合

#### Scenario: Search and navigate on a narrow screen
- **WHEN** 用户在窄屏输入搜索或使用长名称的多级页面目录
- **THEN** 输入和原生按键有效，名称与独立展开操作仍可识别并操作，页面导航无横向溢出

### Requirement: Consistent page navigation presentation
导航 SHALL 使用关闭文件夹、打开文件夹与单页图标分别标识有子页面且收起、有子页面且展开、无子页面节点；叶子节点 MUST 不使用空白图标占位。选中与悬停高亮 SHALL 覆盖图标和名称所在的整行，根级页面与设计系统入口 SHALL 保持一致行宽、图标列和文字起点；子页面 SHALL 保留层级缩进。图标展开与名称选择的操作 MUST 保持独立。

#### Scenario: Hover or select a page row
- **WHEN** 用户悬停页面名称或选择一个父页面或叶子页面
- **THEN** 整行高亮包裹图标与标题，根级入口和设计系统对齐，叶子节点显示单页图标

#### Scenario: Distinguish expanded and collapsed groups
- **WHEN** 用户独立展开或收起父节点
- **THEN** 文件夹图标同步变化，当前页面与组合不因折叠改变

### Requirement: Directly reviewable expanded page navigation
如意设计自身原型 SHALL 提供桌面和手机均可直接进入的首页子页面展开状态，内层状态选择器 SHALL 能选择同一状态；入口 MUST 确定性展开首页子页面，不依赖历史操作或浏览器保存的折叠偏好。

#### Scenario: Open the expanded home navigation state
- **WHEN** 用户直接打开首页下级页面展开状态，即使此前保存了首页收起偏好
- **THEN** 首页子页面列表可见，页面仍为首页，可继续独立展开或收起
