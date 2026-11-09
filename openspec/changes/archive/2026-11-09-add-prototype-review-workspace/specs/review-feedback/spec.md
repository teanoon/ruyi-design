## Purpose

在本地持久保存用户的元素与设计系统评论，由用户在对话中主动要求 AI 更新后生成不可变处理快照，保留原版本上下文及逐条处理和复核记录，并在客户端断线、重试或服务重启后继续评审。

## ADDED Requirements

### Requirement: Contextual comments
工作区 SHALL 提供预览按钮，默认使用元素评论且不提供页面评论入口；评论 MUST 记录对象身份、适用的状态和设备、版本、URL、视口与锚点上下文。

#### Scenario: Comment on an interactive state
- **WHEN** 用户在某组合中展开弹窗并对元素添加评论
- **THEN** 系统保存该组合、版本、元素和可采集的交互上下文，不只保存正文和屏幕坐标

#### Scenario: Locate across page state and device
- **WHEN** 用户从其他页面、状态或设备点击某条元素评论的定位
- **THEN** 工作区打开该评论对应的组合，恢复可用交互上下文，等待画布就绪后滚动并高亮目标，保留原评论所属版本

#### Scenario: Anchor becomes ambiguous
- **WHEN** 更新后目标消失或存在多个不确定匹配
- **THEN** 系统显示定位失效并保留旧版本上下文，不静默移动到其他元素

### Requirement: User-initiated immutable processing snapshot
用户 SHALL 直接保存、编辑或删除待处理评论，无需在评审页面提交。保存评论 MUST 不自动启动 AI。只有用户在对话中明确要求根据评论更新后，AI SHALL 通过 prepare_update 固定当前待处理评论快照，再领取处理；上下文读取 MUST 不隐式创建快照或领取任务。

#### Scenario: Save feedback without initiating work
- **WHEN** 用户保存评论但尚未在对话中要求更新
- **THEN** 评论立即持久化并可读取编辑，页面不显示提交按钮，系统不创建处理批次或监控任务

#### Scenario: New feedback during processing
- **WHEN** 用户要求更新后 AI 固定处理快照，用户又保存新评论
- **THEN** 当前快照保持不变，新评论留待用户下一次主动要求更新

#### Scenario: Retry snapshot preparation
- **WHEN** 相同幂等键的 prepare_update 请求被重试
- **THEN** 返回原快照，不包含后来新增的评论，也不创建重复批次

### Requirement: Recoverable exclusive processing
批次 SHALL 通过有期限的独占领取进入处理状态，支持续约；过期或失联后 MUST 能恢复，重复读取不能造成重复领取。

#### Scenario: Two clients claim one batch
- **WHEN** 两个客户端同时领取同一排队批次
- **THEN** 只有一个获得有效租约，另一个收到冲突或已领取结果

#### Scenario: Agent disconnects
- **WHEN** AI 领取后断开且租约过期
- **THEN** 批次可重新领取，固定输入及既有处理记录仍然存在

### Requirement: Human verification of results
AI SHALL 可逐条回复、请求澄清、记录未处理原因或提交修改结果；AI 完成修改后评论 MUST 进入待复核，只有用户确认才标记解决。

#### Scenario: User rejects a claimed fix
- **WHEN** 用户复核后认为修改未解决问题
- **THEN** 评论保持或恢复未解决状态，并可形成新批次，历史修改结果仍可追溯

### Requirement: Durable event recovery and activity display
评论、批次、结果和事件 SHALL 跨服务重启持久化；事件 SHALL 支持游标补读，工作区 MUST 显示等待用户发起、处理或服务连接失效状态；MUST 不显示智能体监听状态。

#### Scenario: Reconnect after missed events
- **WHEN** 浏览器使用上次游标重连，或 AI 再次读取完整上下文
- **THEN** 系统补发保留范围内的事件，或明确要求全量同步，不能静默跳过缺失记录

### Requirement: Deleted target context and original-version comparison
对于已发布且明确记录为删除的修改，工作区 SHALL 定位到代理记录的、唯一匹配的保留父容器并显示“此处已删除”，MUST 不因普通查找失败就推断删除。原评论目标及版本 MUST 保持不变。元素评论 SHALL 可查看评论保存时的不可变原版本并返回最新版本；原版本视图 MUST 有明确标识，不能被新发布自动替换，也不用于新建元素评论。

#### Scenario: Inspect a deleted element
- **WHEN** 用户定位带删除位置记录的评论
- **THEN** 当前版本高亮保留父容器并标注删除，父容器不存在或歧义则明确提示失败，不使用旧坐标代替

#### Scenario: Compare with the original version
- **WHEN** 用户点击查看原版本，再返回最新版本
- **THEN** 原版本展示删除前内容和原锚点，最新版本展示当前内容，评论和当前发布指针均不改变

### Requirement: Resolved feedback archive
用户确认解决后，评论 SHALL 从当前反馈列表及当前计数中移出，并集中显示在默认收起的已归档分组中。归档 MUST 保留正文、处理线程、定位、原版本对照及重新打开能力，不删除持久记录。

#### Scenario: Confirm and archive a fix
- **WHEN** 用户确认某条待复核评论已解决
- **THEN** 该评论进入已归档分组，当前列表和计数不再包含它，其余未解决评论保持可见

#### Scenario: Reopen archived feedback
- **WHEN** 用户在已归档分组中重新打开评论
- **THEN** 评论返回当前列表的待处理状态，保留原处理历史，并等待用户下一次主动要求更新
