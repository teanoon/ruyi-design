# Spec Delta

## ADDED Requirements

### Requirement: Pending comment submission and confirmed card actions

新建和编辑评论提交后，工作区 SHALL 关闭表单并立即在进行中列表显示新正文及「待提交」。后台确认写入后 SHALL 显示「待处理」，并将该评论纳入待处理计数。写入失败时 MUST 保留「待提交」及输入，卡片 SHALL 提供定位（有锚点时）、编辑及红色「重新提交」。重新提交 SHALL 防止重复落库。回复 SHALL 保持本地即时显示及后台同步，写入失败时保留回复输入。

点击删除、存档或重新打开时，工作区 SHALL 保留当前卡片和分组，点击的按钮 SHALL 分别显示「删除中」「存档中」「打开中」，同一卡片上的其它写入不可并发执行。后台成功后 SHALL 应用删除、存档或重开，失败时 SHALL 恢复点击前的卡片状态和操作。服务端旧列表 MUST 不覆盖未确认的正文或已确认的操作。后台确认后读取失败时，重试刷新 SHALL 只读取。

#### Scenario: Display a comment awaiting submission

- **WHEN** 用户新建或编辑评论且提交请求尚未确认
- **THEN** 进行中列表立即显示新正文和「待提交」，待处理计数不纳入该评论

#### Scenario: Retain a failed submission on its card

- **WHEN** 新建或编辑写入失败
- **THEN** 卡片保留新正文和「待提交」，并提供定位（有锚点时）、编辑及红色「重新提交」。确认后转为待处理

#### Scenario: Confirm or restore a card action

- **WHEN** 用户点击删除、存档或重新打开，并等候后端响应
- **THEN** 对应操作显示进度，原卡片和分组不变。后端成功后应用对应变化，失败则恢复原状态和操作

#### Scenario: Refresh after a confirmed write

- **WHEN** 写入成功而随后读取评论列表失败
- **THEN** 界面继续显示已完成的结果，并提供只读取列表的重试入口

## MODIFIED Requirements

### Requirement: User-initiated immutable processing snapshot
用户 SHALL 直接保存、编辑待处理评论，并仅可删除从未纳入更新且无处理历史的新评论。工作区 SHALL 在服务端确认保存后将评论纳入待处理。保存评论 MUST 不自动启动 AI。只有用户在对话中明确要求根据评论更新后，AI SHALL 通过 prepare_update 固定当前已保存的待处理评论快照，再领取处理。上下文读取 MUST 不隐式创建快照或领取任务。

#### Scenario: Save feedback without initiating work
- **WHEN** 用户保存评论但尚未在对话中要求更新
- **THEN** 写入确认后评论持久化并可读取编辑。工作区不提供提交给 AI 的入口，系统不创建处理批次或监控任务

#### Scenario: New feedback during processing
- **WHEN** 用户要求更新后 AI 固定处理快照，用户又保存新评论
- **THEN** 当前快照保持不变，新评论留待用户下一次主动要求更新

#### Scenario: Retry snapshot preparation
- **WHEN** 相同幂等键的 prepare_update 请求被重试
- **THEN** 返回原快照，不包含后来新增的评论，也不创建重复批次

### Requirement: User follow-up replies reopen feedback

用户保存非空追加回复后，不在排队或处理中批次内的评论 SHALL 自动恢复待处理状态，并显示在进行中列表，保留原文、定位、处理结果与线程。同一元素已有另一条进行中讨论时，对归档评论的回复及显式重开 SHALL 返回进行中讨论的身份，归档评论的状态和线程保持原样。工作区 MUST 保留未保存的回复，并提供主动进入该进行中讨论的入口。追加回复 MUST 不自动发起 AI 或新批次。排队或处理中收到的追加回复 MUST 保留原固定输入与当前处理状态；该批次发布后 SHALL 将追加内容保留为下一轮待处理，继续等待用户主动要求更新。

#### Scenario: Reply to a reviewed or archived comment

- **WHEN** 用户给待复核或已归档评论保存追加回复，评论没有排队或处理中的批次，且同一元素没有另一条进行中讨论阻止归档评论重开
- **THEN** 评论自动重新打开并在进行中可见，无需用户额外点击重新打开；原文、结果及历史保留，不自动创建处理批次

#### Scenario: Reply after a processing snapshot was fixed

- **WHEN** 用户在该评论所在批次排队或处理期间保存追加回复
- **THEN** 原固定输入保持不变；发布本批次后，该评论携带追加内容保持待处理，可由下一次用户更新请求纳入新批次

#### Scenario: Prevent a second active discussion from archived feedback

- **WHEN** 用户回复或重新打开归档评论，而同一元素已有另一条进行中讨论
- **THEN** 归档评论保持归档，线程及历史保留；界面提示已有进行中讨论并提供进入入口，回复草稿仍可用，只有用户再次主动提交才写入该讨论

### Requirement: Resolved feedback archive

用户确认解决后，评论 SHALL 从当前反馈列表及当前计数中移出，并集中显示在默认未选中的已归档标签页中。显式存档可将无活动批次的已保存进行中评论移入已归档。归档 MUST 保留正文、处理线程、定位、原版本对照及重新打开能力；当同一元素已有另一条进行中讨论时，重新打开受同一元素规则约束。归档或确认解决 SHALL 保持用户当前选择的标签页，不自动跳转到已归档。

#### Scenario: Confirm and archive a fix

- **WHEN** 用户确认某条待复核评论已解决
- **THEN** 该评论进入已归档分组，当前列表和计数不再包含它，其余未解决评论保持可见

#### Scenario: Reopen archived feedback

- **WHEN** 用户在已归档分组中重新打开评论，且同一元素没有另一条进行中讨论
- **THEN** 评论返回当前列表的待处理状态，保留原处理历史，并等待用户下一次主动要求更新

### Requirement: Single discussion per element

同一对象、状态、设备及组件示例下的同一元素 SHALL 复用进行中的讨论，跨版本保持评论原身份；双方具有稳定 reviewId 时 SHALL 按 reviewId 匹配，否则按完整 selector 匹配。父子/祖先元素 MUST 不视为同一元素，不同状态或设备及不同页面的组件实例 MUST 不自动合并。元素选择 SHALL 只匹配进行中讨论：可编辑的待处理评论原位编辑，其余进行中状态只打开已有讨论。没有进行中讨论时 SHALL 打开进行中标签页中的新建评论框，包括同一元素存在已解决或已归档记录的情况。界面 MUST 不提供绕过进行中讨论的新建入口或多评论选择入口。后端 MUST 在同一元素已有进行中讨论时拒绝创建或重开另一条讨论，保留原记录，并返回现有讨论的身份。

#### Scenario: Comment between already commented ancestors and descendants

- **WHEN** 父元素和子元素已有评论，用户选择中间另一个元素
- **THEN** 该元素可创建自己的评论，不误选父子已有评论

#### Scenario: Reuse existing feedback including resolved feedback

- **WHEN** 用户再次选择已有待处理、已纳入更新、待澄清或待复核评论的同一元素，该元素也可能有已解决历史
- **THEN** 工作区复用进行中讨论并按其状态提供编辑或查看，已有的已解决历史仍可在归档中打开

#### Scenario: Create feedback after a discussion is resolved or archived

- **WHEN** 用户选择同一元素，且该元素仅有已解决或已归档评论
- **THEN** 工作区显示进行中标签页和空白评论框；保存后生成独立记录，旧评论及其线程和历史仍可从已归档打开

#### Scenario: Concurrent creation on the same element

- **WHEN** 多个浏览器同时为同一元素创建评论
- **THEN** 最多创建一条进行中讨论，其余请求明确提示已有评论并提供其身份，工作区保留未保存输入，原正文及线程不被覆盖

#### Scenario: Concurrent creation and reopening on the same element

- **WHEN** 一个请求创建评论，另一个请求同时尝试为同一元素重开归档讨论
- **THEN** 最多一个请求创建或重开进行中讨论，另一请求收到进行中讨论的身份，未保存输入及原正文和线程保留

#### Scenario: Retain pre-existing duplicate history

- **WHEN** 加载升级前同元素多条评论
- **THEN** 记录均保留并可在各自列表查看；默认选择创建顺序最新的未解决评论，若均已解决则打开新建评论框，旧记录不自动合并或删除

### Requirement: Expanded state-specific feedback actions
评论卡片 SHALL 全部展开当前适用操作，不使用更多/溢出菜单，常态下只显示适用操作，状态操作等待确认时允许暂时禁用同卡片的写入操作。操作 SHALL 按定位、查看原版本（适用时）、编辑/回复、处理结果的顺序排列；定位仅在存在元素锚点时显示。排队或处理中批次优先于评论自身状态，卡片 SHALL 仅提供定位、适用的原版本和回复。无活动批次时，进行中的已保存评论 SHALL 提供存档。未纳入过更新的新 draft SHALL 显示定位、编辑、删除；具有重开恢复信息的 draft SHALL 显示定位、回复、编辑、撤销重新打开；其他已有批次历史但无重开恢复信息的 draft SHALL 显示定位、回复、编辑，不显示删除或撤销重新打开；submitted SHALL 显示定位、回复；needs_clarification SHALL 显示定位、回复；awaiting_review SHALL 显示定位、回复、确认解决、重新打开；resolved（确认或归档）SHALL 显示定位、回复、重新打开。所有状态 MUST 不显示新增评论或无需处理按钮；已归档列表与读取历史能力 SHALL 保留。确认解决 SHALL 在待复核时突出显示，删除 SHALL 使用危险文字样式。

#### Scenario: Review a proposed fix
- **WHEN** 用户查看不在活动批次内的待复核评论
- **THEN** 所有适用操作展开，显示确认解决和重新打开，同时提供存档，不显示无需处理；保存回复仍按既有规则自动重开

#### Scenario: Protect an active processing input
- **WHEN** 某评论处于排队或处理中批次，无论其自身状态是什么
- **THEN** 卡片只显示定位、适用的原版本及回复；编辑、删除、重开和撤销重开均不可用，直接请求也不得修改该固定输入
