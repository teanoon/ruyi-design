# Tasks

## 1. 弹出层回归夹具

- [x] 1.1 新增 `tests/browser/popup-comments.mjs` 临时设计夹具与 `test:popup-comments` 脚本，包含原生 dialog、popover、普通 DOM 弹层、叠加 dialog 及状态导出/恢复接口；用真实点击和高亮遮挡断言确认旧实现可复现缺陷，并分别记录选择消息是否正常。

## 2. 高亮承载与交互修复

- [x] 2.1 在 bridge 内建立统一高亮显示/隐藏入口，使用 manual popover、必要的模态子树承载和能力检测降级，重置默认布局并保持辅助层不可聚焦、不可拦截指针；通过截图像素或等价遮挡断言及目标矩形对齐验证 dialog、popover 和普通 DOM 弹层中高亮实际可见。
- [x] 2.2 将 hover、click 和 locate 接入统一高亮入口，保留实际目标的 selector/reviewId、坐标、删除标记和消息协议；通过保存评论、同元素讨论复用、无稳定 id 目标与状态恢复后定位断言验证锚点身份，隐藏或歧义目标仍提示失败。
- [x] 2.3 处理模式切换、Escape、弹窗关闭、目标移除及叠加弹窗顺序变化时的辅助层清理，避免自身观察循环及组件测量污染；验证预览关闭/重开后回到评论仍可选择，下层弹窗恢复可交互后高亮正确，组件高度不因辅助层改变。
- [x] 2.4 验证弹出层内按钮、输入及选择控件的评论焦点交接，若复现点击丢失则修正对应最小事件路径；断言评论时不执行原型动作、不关闭弹层且工作区可连续输入，预览时原型交互与控件焦点正常，只读模式不创建评论。

## 3. 集成验证

- [x] 3.1 完成弹出层浏览器回归，在桌面和窄屏画布运行选择、高亮、输入、保存、定位与模式切换场景，并保存失败截图；运行 `npm run build` 和 `npm run test:popup-comments` 确认通过。
- [x] 3.2 运行 `npm run typecheck`、`npm test`、`npm run test:focus`、`npm run test:comments`、`npm run test:deleted` 及 `npm run test:gateway`，确认现有焦点、评论、删除定位和预览桥接行为未回归，并记录结果。


## 验证记录

- 旧实现：`test:popup-comments` 中真实点击到达评论框，但“高亮位于弹窗与遮罩上方”断言失败，确认回归能够捕捉原缺陷。
- 修复后：`npm run build`、`npm run typecheck`、`npm test`（12 个文件、75 项测试）全部通过。
- 浏览器：`test:popup-comments`、`test:focus`、`test:comments`、`test:deleted`、`test:gateway` 全部通过。
- 弹出层测试覆盖 1280px / 390px 画布、dialog / popover / DOM 弹层 / 叠加 dialog，以及隐藏与歧义目标、无 ID 锚点、组件高度和禁用 Popover API 的降级路径。
- 网关原有测试在末尾查找旧文案“工作区连接失败”而超时；将断言更新为现有界面的“连接失败”后整套通过，未修改产品连接状态行为。
- `openspec validate fix-popup-comment-selection --strict` 与 `git diff --check` 通过。

- 本地设计稿新增模态弹窗、Popover、普通浮层三个桌面/手机审核状态；`npm run test:design` 的 84 个入口与弹层表单、关闭及状态恢复检查通过，另验证六种状态/设备组合在真实评论工作区中可选取并高亮。
- 设计稿发布修订 `397f1735-6154-4737-8742-5a6359d746d9` 后，用户确认“审核通过”，并授权执行收尾。版本按修复范围提升为 `0.3.3`。
- 收尾验证：全部 7 份主规范通过验证；`0.3.3` 构建和 21 项发布流程测试通过；package.json 与锁文件版本一致。
