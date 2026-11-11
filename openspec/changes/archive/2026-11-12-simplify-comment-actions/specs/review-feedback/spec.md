# Spec Delta

## ADDED Requirements

### Requirement: Single discussion per element
同一对象、状态、设备及组件示例下的同一元素 SHALL 复用一条默认讨论，跨版本保持评论原身份；双方具有稳定 reviewId 时 SHALL 按 reviewId 匹配，否则按完整 selector 匹配。父子/祖先元素 MUST 不视为同一元素，不同状态或设备及不同页面的组件实例 MUST 不自动合并。元素选择 SHALL 包含已解决和已归档评论：待处理评论原位编辑，其余状态只打开已有讨论，查看不自动重开；保存非空回复或显式重开才改变状态。界面 MUST 不提供新增同元素独立评论或多评论选择入口，后端 MUST 拒绝重复创建且不覆盖已有内容；并发重复创建最多新增一条。

#### Scenario: Comment between already commented ancestors and descendants
- **WHEN** 父元素和子元素已有评论，用户选择中间另一个元素
- **THEN** 该元素可创建自己的评论，不误选父子已有评论

#### Scenario: Reuse existing feedback including resolved feedback
- **WHEN** 用户再次选择已有评论的同一元素，无论其待处理、已纳入更新、待复核、已解决或已归档
- **THEN** 打开对应已有讨论且不创建新记录；仅查看已解决或归档讨论不会改变状态

#### Scenario: Concurrent creation on the same element
- **WHEN** 多个浏览器同时为同一元素提交新评论
- **THEN** 后端只允许一条新记录，其余请求明确提示已有评论并提供其身份，客户端保留未保存输入，不静默覆盖或丢失正文

#### Scenario: Retain pre-existing duplicate history
- **WHEN** 加载升级前同元素多条评论
- **THEN** 记录均保留并可在列表查看；默认选择创建顺序最新的未解决评论，若均已解决则选择创建顺序最新一条，不新增、不自动合并或删除旧记录

### Requirement: Expanded state-specific feedback actions
评论卡片 SHALL 全部展开当前适用操作，不使用更多/溢出菜单，也不显示不可用的编辑或状态操作。操作 SHALL 按定位、查看原版本（适用时）、编辑/回复、处理结果的顺序排列；定位仅在存在元素锚点时显示。排队或处理中批次优先于评论自身状态，卡片 SHALL 仅提供定位、适用的原版本和回复。无活动批次时，未纳入过更新的新 draft SHALL 显示定位、编辑、删除；具有重开恢复信息的 draft SHALL 显示定位、回复、编辑、撤销重新打开；其他已有批次历史但无重开恢复信息的 draft SHALL 显示定位、回复、编辑，不显示删除或撤销重新打开；submitted SHALL 显示定位、回复；needs_clarification SHALL 显示定位、回复；awaiting_review SHALL 显示定位、回复、确认解决、重新打开；resolved（确认或归档）SHALL 显示定位、回复、重新打开。所有状态 MUST 不显示新增评论、归档或无需处理按钮；已归档列表与读取历史能力 SHALL 保留。确认解决 SHALL 在待复核时突出显示，删除 SHALL 使用危险文字样式。

#### Scenario: Review a proposed fix
- **WHEN** 用户查看不在活动批次内的待复核评论
- **THEN** 所有适用操作展开，显示确认解决和重新打开，不显示无需处理或归档；保存回复仍按既有规则自动重开

#### Scenario: Protect an active processing input
- **WHEN** 某评论处于排队或处理中批次，无论其自身状态是什么
- **THEN** 卡片只显示定位、适用的原版本及回复；编辑、删除、重开和撤销重开均不可用，直接请求也不得修改该固定输入

### Requirement: Distinct deletion and reopened-draft cancellation
删除 SHALL 仅适用于从未纳入更新、无处理结果且无重开恢复信息的新 draft。已有处理历史的评论 MUST 不被删除。撤销重新打开 SHALL 仅适用于非活动批次且具备重开恢复信息的 draft，恢复重开前正文与状态并保留已保存线程、处理结果和原始定位；该操作 MUST 不显示为删除。新评论的删除与编辑取消 SHALL 保持不同语义，编辑取消仍仅丢弃未保存输入。

#### Scenario: Delete an untouched new comment
- **WHEN** 用户删除符合条件的新 draft
- **THEN** 仅该新记录移除，其他评论不变；带处理历史的评论不展示删除且后端拒绝删除请求

#### Scenario: Cancel a reopened discussion
- **WHEN** 用户撤销非活动批次 draft 的重新打开
- **THEN** 恢复重开前正文与状态，保留线程、处理结果和原定位，不把它当成永久删除

## MODIFIED Requirements

### Requirement: User-initiated immutable processing snapshot
用户 SHALL 直接保存、编辑待处理评论，并仅可删除从未纳入更新且无处理历史的新评论，无需在评审页面提交。保存评论 MUST 不自动启动 AI。只有用户在对话中明确要求根据评论更新后，AI SHALL 通过 prepare_update 固定当前待处理评论快照，再领取处理；上下文读取 MUST 不隐式创建快照或领取任务。

#### Scenario: Save feedback without initiating work
- **WHEN** 用户保存评论但尚未在对话中要求更新
- **THEN** 评论立即持久化并可读取编辑，页面不显示提交按钮，系统不创建处理批次或监控任务

#### Scenario: New feedback during processing
- **WHEN** 用户要求更新后 AI 固定处理快照，用户又保存新评论
- **THEN** 当前快照保持不变，新评论留待用户下一次主动要求更新

#### Scenario: Retry snapshot preparation
- **WHEN** 相同幂等键的 prepare_update 请求被重试
- **THEN** 返回原快照，不包含后来新增的评论，也不创建重复批次

### Requirement: Deleted target context and original-version comparison
对于已发布且明确记录为删除的修改，工作区 SHALL 定位到代理记录的、唯一匹配的保留父容器并显示“此处已删除”，MUST 不因普通查找失败就推断删除。原评论目标及版本 MUST 保持不变。元素评论 SHALL 可查看评论保存时的不可变原版本并返回最新版本；“查看原版本” SHALL 仅在评论保存版本与最新发布版本不同时显示，作为定位后的文字按钮。点击后 SHALL 在同一画布切换到保存时的对象/状态/设备并定位原锚点；顶部 SHALL 显示“正在查看评论原版本 · 只读”和“返回最新版本”。原版本视图 MUST 不能被新发布自动替换，也不用于新建元素评论；右侧讨论及未保存输入 SHALL 保留。返回最新版本 SHALL 重新定位同一评论的当前元素，明确删除时使用已记录父容器，失败时保留原上下文并说明原因；查看和返回 MUST 不改变评论状态、当前发布指针或评审会话。

#### Scenario: Inspect a deleted element
- **WHEN** 用户定位带删除位置记录的评论
- **THEN** 当前版本高亮保留父容器并标注删除，父容器不存在或歧义则明确提示失败，不使用旧坐标代替

#### Scenario: Compare with the original version
- **WHEN** 用户点击查看原版本，再返回最新版本
- **THEN** 原版本展示删除前内容和原锚点，最新版本展示当前内容，评论和当前发布指针均不改变

#### Scenario: Show an original-version action only when useful
- **WHEN** 用户查看评论卡片
- **THEN** 只有评论保存版本与最新发布版本不同才显示查看原版本，位置在定位之后，不使用弹窗或并排画布

#### Scenario: Keep discussion while viewing the original
- **WHEN** 用户有未保存回复并打开评论原版本，再返回最新版本
- **THEN** 原版本画布只读且顶部返回入口明确，右侧讨论与输入不丢失，返回时重新定位当前元素或明确的删除父容器，不因版本切换改变评论状态


## REMOVED Requirements

### Requirement: Exact element comment identity and multiple comments
**Reason**: 用户放弃同一元素多条独立评论，改为单条讨论承载多个需求；精确元素身份规则由 Single discussion per element 延续。
**Migration**: 移除新增独立评论入口，前后端复用/校验已有评论；旧的多条记录完整保留，不做破坏性合并或清理。
