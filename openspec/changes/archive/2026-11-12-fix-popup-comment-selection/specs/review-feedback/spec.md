# Spec Delta

## ADDED Requirements

### Requirement: Element comments within popup layers
元素评论模式 SHALL 支持已展开的原生模态 dialog、原生 popover 及普通 DOM 弹出层中的元素。悬停与定位高亮 MUST 在目标弹出层上方可见且与目标边界一致，不被弹出层、遮罩或祖先裁剪遮蔽；选择 MUST 保存实际目标元素的身份与上下文，不将高亮辅助元素或弹窗外背景作为目标。点击弹出层内控件进行评论 MUST 不触发其原型动作或默认聚焦，新建或编辑评论时 MUST 将输入焦点稳定交给工作区评论框。高亮辅助元素 MUST 不进入键盘导航或拦截指针。切换预览模式 SHALL 清除评论选择高亮并保留弹出层原有交互。

#### Scenario: Select and comment within a native modal
- **WHEN** 用户在已展开的原生模态 dialog 中悬停并点击按钮或表单控件
- **THEN** 高亮在弹窗和遮罩上方显示，系统选中该控件且不执行其动作，工作区评论框可持续输入并保存对应元素评论

#### Scenario: Select elements in popovers and DOM overlays
- **WHEN** 用户在已展开的原生 popover 或普通 DOM 弹出层中选择元素
- **THEN** 高亮可见且贴合目标，保存的锚点对应实际元素，评论辅助层不遮挡点击或关闭原型弹出层

#### Scenario: Locate saved popup feedback
- **WHEN** 用户定位弹出层内已保存的评论，且弹出层已展开或可由已有交互状态恢复接口恢复
- **THEN** 系统恢复可用上下文并在弹出层内可见地高亮原目标，保留原锚点身份；目标隐藏、消失或歧义时明确提示定位失败

#### Scenario: Preserve preview behavior across popup lifecycle
- **WHEN** 用户从评论切换到预览，关闭并重新打开弹出层，再回到评论模式
- **THEN** 预览时按钮、输入和关闭动作正常工作，评论时仍可选取弹出层元素，且不残留高亮、辅助遮罩或焦点占用

#### Scenario: Highlight the active modal in a modal stack
- **WHEN** 多个原生模态 dialog 依次打开，用户评论当前最上层弹窗中的元素，之后在预览中关闭该弹窗并返回评论
- **THEN** 高亮始终显示在当前目标所在的可交互弹窗上方，关闭上层弹窗后仍可评论下层可交互弹窗中的元素
