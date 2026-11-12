# Proposal

## Why

用户反馈设计稿包含弹出层时无法选取其中元素进行评论。现有桥接高亮框处于普通文档层，即使使用最大 z-index 也无法覆盖原生模态弹窗；需要保证弹出层内的选择反馈、评论输入与后续定位完整可用。

## What Changes

- 明确评论模式支持已展开的原生 dialog、popover 和普通 DOM 弹出层中的元素。
- 让评论悬停、选择及定位高亮能够显示在目标弹出层上方，同时保持真实元素的锚点身份。
- 保持评论选择时对原型交互的阻止和工作区评论框的焦点交接，预览模式继续保留弹出层原有交互。
- 增加浏览器回归，分别验证选择消息、可见高亮、输入焦点和弹出层开关后的恢复。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `review-feedback`: 增加弹出层内元素的选择、高亮、评论与定位要求，覆盖浏览器顶层和普通文档层。

## Impact

- `src/browser/bridge/index.ts`：高亮层承载与生命周期、元素选择和定位路径。
- `tests/browser/` 及 `package.json`：弹出层评论浏览器回归及运行入口，复用现有 Playwright 工具。
- 原有 `review-feedback` 的交互状态评论和焦点要求继续适用；不改变评论协议、存储结构或引入运行时依赖。
