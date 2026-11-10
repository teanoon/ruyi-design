# Tasks

## 1. 浏览器选择与实际启动验证

- [x] 1.1 建立共享浏览器配置/发现模块，支持 EXECUTABLE/CHANNEL 两个 RUYI_DESIGN_BROWSER_* 环境变量，校验互斥、绝对路径、空值和通道；通过单元用例验证显式配置错误不回退。
- [x] 1.2 实现 Windows/macOS/Linux 候选枚举、Chrome→Edge→Chromium→已有 Playwright 顺序与去重；通过注入平台/环境/文件系统 fixture 验证顺序、权限、PATH 和 WSL 不跨环境发现。
- [x] 1.3 实现有界实际启动、隔离 context/page 最小脚本检查及清理，自动候选失败继续、显式失败停止；通过模拟启动失败/超时及真实浏览器检查验证无资源遗留且不自动下载。

## 2. doctor、发布和消费者接入

- [x] 2.1 doctor 使用共享模块，新增 browser 诊断和实际可用性退出码，保留原 chromium 字段语义及现有 workspace/bridge 检查；验证系统浏览器可用而 bundled 缺失时整体成功，以及全部失败的原因汇总。
- [x] 2.2 候选发布使用共享启动结果，保留完整入口验证、内部本地地址、错误码和活动版本原子保护；通过 feedback/conversation 两种模式验证成功、浏览器不可用和页面 JS/资源失败。
- [x] 2.3 扩展包/集成测试覆盖显式通道、自定义路径、自动发现和已有 bundled 后备，验证 MCP 九工具/stdout 隔离与历史连续性；更新新环境、MCP env 和可选手动安装说明并实际执行 doctor 示例。

## 3. npmjs 发布准备与同一产物验收

- [x] 3.1 补齐 publishConfig、已知 repository 等分发元数据并保留 UNLICENSED，建立名称/版本/lock/registry/tag/提交预检；通过 fixture 验证不一致、重复版本、网络失败及许可确认关口，不执行真实上传。
- [x] 3.2 扩展 tests/package/install.mjs 接受显式 tarball，传入时不重打包，保留原调用行为；通过摘要前后相同、独立无开发依赖安装、CLI/MCP/技能闭环验证。
- [x] 3.3 增加 release 准备脚本，生成 dist 包和发布清单/摘要，排除嵌套归档、发布清单与本地状态，完成同一文件安装验收和 dry-run；通过真实本地产物及替换/损坏 fixture 验证，默认无 registry 写入。
- [x] 3.4 实现独立显式上传入口与上传后元数据核验，固定已验收文件/摘要/registry/access/tag，禁止生命周期重打包；用模拟 registry 验证授权、冲突、失败和 integrity 不符路径，不以真实 npm 发布作为完成条件。

## 4. 首发说明与受控 CI

- [x] 4.1 编写 docs/releasing.md，说明本地首发、scope/2FA/许可确认、版本递增、dry-run 局限、发布后核验及后续 Trusted Publisher 配置；对照当前 npm 官方文档核验命令，明确区分 npm 包发布和设计稿发布。
- [x] 4.2 创建 GitHub workflow_dispatch 发布工作流，校验版本/ref/tag并分离准备与上传，传递同一 tarball/摘要，上传使用 npmjs environment 与最小 OIDC 权限；通过工作流结构检查验证普通 push/PR 不上传、未授权 ref 和前置检查失败不能上传。
- [x] 4.3 提供 teanoon/ruyi-design、publish.yml 和 npmjs environment 的外部配置清单，记录托管 runner/Node/npm 前提及首包手工引导；验证准备流程不依赖账号 token，不擅自创建组织、环境或信任配置。

## 5. 回归与交付记录

- [x] 5.1 执行 typecheck、构建、相关单元/集成、跨源/网关发布、独立安装和发布准备 dry-run；记录真实浏览器来源、失败保护、包摘要和验收结果，通过 OpenSpec 严格校验及 git diff --check，不执行远程发布/推送。
