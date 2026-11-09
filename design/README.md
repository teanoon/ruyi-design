# 如意设计 · 产品设计稿

这里评审的是如意设计自身的产品界面。`examples/starter/design/` 中的 Northstar 仍是提供给消费者的通用 demo，两者独立。

设计稿收敛为一个工作区，包含元素评论、添加/原位编辑、交互预览、新版待复核等状态。评论与归档、原版本查看均在工作区内完成；不再保留独立评论、版本对照和连接引导页面。连接状态固定在左侧导航底部。

评论按创建时间倒序；点击有评论的画布元素会选中原评论并原位编辑，Ctrl+Enter（也支持 Cmd+Enter）保存。组件直接展示适用状态，预览高度随内容变化，页面仍使用设备逻辑视口。品牌标志已定稿为提交墙方印，仅保留标准展示、小尺寸与同形单色适配，其他候选已从当前设计稿移除。

工作区画布中的“山野拾光”只是展示本产品评审操作的示意设计。

HTML/CSS/JS 无需构建，页面复用 `components/ui.js`。交互数据用于本地原型体验，不会修改真实评审评论；对这份产品设计稿的实际反馈请保存在外层评审工具中。

```bash
npm run build
npm run test:design
RUYI_DESIGN_HOST=0.0.0.0 RUYI_DESIGN_PORT=4173 RUYI_DESIGN_PREVIEW_PORT=4174 RUYI_DESIGN_BASE_URL='https://design.dev.test:34000/?port=4173' npm run preview:design
```

通过 MCP 启动时，显式传入本仓库绝对 `projectRoot`、`designRoot: <仓库>/design`、`dataRoot: <仓库>/.ruyi-design`，以及网关监听配置。运行数据与 demo 的 `.uxai-review/` 隔离。根目录存在多套数据时必须显式指定 dataRoot，不要合并或移动旧评审历史。

保存评论后，在 AI 对话中说“我已评论，可以更新”。不会监控或自动消费新评论。需要发布产品设计稿更新时，以本评审 sessionId 处理一轮，再等待你复核。

## 最终品牌标志

用户确认采用上一版“提交墙色块底＋白色如意”，来源为不可变版本 `f1a705f1`。标准标志统一为 `assets/ruyi-mark.svg`，字标为 `assets/ruyi-wordmark.svg`，单色适配为 `assets/ruyi-mark-mono.svg`。工作区、favicon、组件展示和 npm 包均使用该定稿。其他候选源文件和选择入口已移除；原评审历史保留。
