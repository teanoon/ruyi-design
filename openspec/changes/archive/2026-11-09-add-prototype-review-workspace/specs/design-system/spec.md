## Purpose

在原型工作区内集中展示设计令牌和共享组件，使用户能够比较组件在不同设备下的全部适用状态，并将设计系统反馈与使用同一实现的页面关联，降低展示示例和页面实现不一致的风险。

## ADDED Requirements

### Requirement: Dedicated token presentation
工作区 SHALL 提供独立设计系统入口，展示令牌分组、稳定名称、实际值、视觉样例与用途；令牌 MUST 可独立评论。

#### Scenario: Inspect and comment on a color token
- **WHEN** 用户打开颜色令牌并添加评论
- **THEN** 系统展示对应色板、值和用途，评论目标关联令牌 ID 及版本

### Requirement: Component state overview per device
组件 SHALL 按设备展示所有已声明状态示例，MUST 不要求通过组件状态菜单逐个进入；每个示例 MUST 可独立交互和评论。

#### Scenario: Compare button states
- **WHEN** 用户选择按钮组件及移动设备
- **THEN** 同页展示其已声明的默认、禁用和加载示例，评论能定位到具体状态示例

### Requirement: Shared implementation and traceable reuse
页面与组件展示 SHALL 能引用相同组件实现和令牌，编写指南 MUST 要求优先复用已有组件；清单 SHALL 支持记录页面使用的组件并供 AI 查询。

#### Scenario: Change a shared component
- **WHEN** AI 修改页面和展示页共同引用的按钮实现并发布
- **THEN** 两者加载同一修订中的共享资源，反馈结果能够说明修改组件及声明的受影响页面

### Requirement: Instance and shared scope distinction
反馈上下文 SHALL 区分页面实例、组件示例和令牌目标，AI 处理结果 MUST 记录修改作用范围，不能仅因评论命中组件实例就默认改变全部实例。

#### Scenario: Change a page-specific button label
- **WHEN** 用户在登录页面评论要求修改按钮文案
- **THEN** 反馈保留页面组合与组件关联，结果说明是当前实例修改还是共享实现修改
