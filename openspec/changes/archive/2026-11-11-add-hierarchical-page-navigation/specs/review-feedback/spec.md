# Spec Delta

## MODIFIED Requirements

### Requirement: Human verification of results
AI SHALL 可逐条回复、请求澄清、记录未处理原因或提交修改结果；AI 完成修改后评论 MUST 进入待复核，只有用户确认才标记解决；若固定输入后收到用户追加回复，该评论 SHALL 在发布后保留为下一轮待处理，MUST 不覆盖或遗漏追加内容。

#### Scenario: User rejects a claimed fix
- **WHEN** 用户复核后认为修改未解决问题
- **THEN** 评论保持或恢复未解决状态，并可形成新批次，历史修改结果仍可追溯

### Requirement: Resolved feedback archive
用户确认解决后，评论 SHALL 从当前反馈列表及当前计数中移出，并集中显示在默认未选中的已归档标签页中。归档 MUST 保留正文、处理线程、定位、原版本对照及重新打开能力，不删除持久记录。归档或确认解决 SHALL 保持用户当前选择的标签页，不自动跳转到已归档。

#### Scenario: Confirm and archive a fix
- **WHEN** 用户确认某条待复核评论已解决
- **THEN** 该评论进入已归档分组，当前列表和计数不再包含它，其余未解决评论保持可见

#### Scenario: Reopen archived feedback
- **WHEN** 用户在已归档分组中重新打开评论
- **THEN** 评论返回当前列表的待处理状态，保留原处理历史，并等待用户下一次主动要求更新

## ADDED Requirements

### Requirement: Exact element comment identity and multiple comments
元素选择 SHALL 只匹配同一对象、状态、设备及元素的已有未解决评论；元素身份在双方具有稳定 reviewId 时 SHALL 按该标识匹配，否则按完整 selector 匹配。父子或其他祖先关系 MUST 不作为同一元素依据。再次选择同一元素 SHALL 激活对应已有评论，不隐式创建重复评论；用户 SHALL 能显式新增同一元素的其他独立评论，保留各自正文和处理历史。

#### Scenario: Comment between already commented ancestors and descendants
- **WHEN** 某父元素和子元素已有评论，用户选择它们之间的另一个元素
- **THEN** 新建该元素的评论输入，不选择父元素或子元素已有评论

#### Scenario: Add another comment to the same element
- **WHEN** 用户对已有评论的元素选择新增评论并保存
- **THEN** 新增一条独立评论，原评论、元素身份和历史保持不变；再次直接选择该元素仍可激活已有评论

### Requirement: Preserve saved text when cancelling comment edits
取消编辑 SHALL 只丢弃本次未保存输入，MUST 保留已保存正文和历史，并立即恢复正文可见状态；立即取消与修改输入后取消 SHALL 遵循相同行为。

#### Scenario: Cancel an existing comment edit
- **WHEN** 用户编辑已有评论后点击取消，无论是否改动输入
- **THEN** 评论原文仍完整可见，持久内容不变，不残留隐藏正文的编辑状态

### Requirement: Comment mode focus ownership
元素评论模式 MUST 在原型控件取得默认指针焦点前阻止其聚焦与原型指针处理，允许评论选择后将输入焦点稳定交给工作区评论框。预览模式 SHALL 保留原型表单、选择控件和指针交互。

#### Scenario: Select a native control for commenting
- **WHEN** 用户在元素评论模式选择原型内的设备或状态下拉框并继续输入评论
- **THEN** 原型控件不弹出或夺取输入焦点，文字输入保持在评论框；进入预览后同一控件仍可正常操作

### Requirement: User follow-up replies reopen feedback
用户保存非空追加回复后，不在排队或处理中批次内的评论 SHALL 自动恢复待处理状态，并显示在进行中列表，保留原文、定位、处理结果与线程。追加回复 MUST 不自动发起 AI 或新批次。排队或处理中收到的追加回复 MUST 保留原固定输入与当前处理状态；该批次发布后 SHALL 将追加内容保留为下一轮待处理，继续等待用户主动要求更新。

#### Scenario: Reply to a reviewed or archived comment
- **WHEN** 用户给待复核或已归档评论保存追加回复，且该评论没有排队或处理中的批次
- **THEN** 评论自动重新打开并在进行中可见，无需用户额外点击重新打开；原文、结果及历史保留，不自动创建处理批次

#### Scenario: Reply after a processing snapshot was fixed
- **WHEN** 用户在该评论所在批次排队或处理期间保存追加回复
- **THEN** 原固定输入保持不变；发布本批次后，该评论携带追加内容保持待处理，可由下一次用户更新请求纳入新批次
