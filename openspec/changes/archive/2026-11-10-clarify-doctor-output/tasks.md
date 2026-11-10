# Tasks

## 1. 统一诊断报告与结论

- [x] 1.1 提取 doctor 的类型化报告采集与状态聚合，复用现有浏览器启动诊断，区分 passed/failed/not_checked，并统一处理可预期的数据目录和清单错误；用资源缺失、目录歧义、新目录和未执行检查的固定输入验证状态、退出码和无副作用语义。
- [x] 1.2 根据最终阻塞项生成结构化建议，保留 JSON 旧字段含义并将 browserInstall 条件化；用 Edge 成功、显式配置冲突、指定浏览器启动失败和自动候选全部失败用例，验证不会给出无关的安装/切换建议。

## 2. 文本与机器输出

- [x] 2.1 实现默认中文摘要及浏览器名称/版本/来源映射，以用户 Windows Edge 结果为验收样例，验证显示“通过、Microsoft Edge、无需额外安装浏览器”，不出现 chromium=false、Chrome 缺失警告或浏览器安装命令；覆盖系统路径、自定义路径和未知版本的准确显示。
- [x] 2.2 为 doctor 接入 --json 与 --verbose 并更新命令帮助，确保同一报告产生一致结论、退出码和详细依据；通过 JSON 整体解析、无 ANSI/前后混入文本、重定向仍为文本及 JSON+verbose 组合用例验证格式边界。

## 3. 调用方与 CLI 验收

- [x] 3.1 将 tests/integration/browser-discovery.mjs 和 tests/package/install.mjs 完整浏览器分支中的 JSON 消费改为 doctor --json，保留 chromium 原语义断言；检查所有 doctor 的 JSON.parse 调用均已迁移，package-only 安装验收仍不调用 doctor。
- [x] 3.2 新增 build 后执行的 tests/integration/doctor-output.mjs，利用无效显式浏览器配置及临时目录验证文本/JSON/verbose 的实际 CLI 参数、失败退出码、目录歧义和错误建议；确认测试不启动浏览器，也不使 npm test 依赖 dist 存在。

## 4. 文档与兼容说明

- [x] 4.1 更新中英文 README、getting-started、MCP 文档及相关迁移说明，提供默认文本、--json、--verbose 和 Edge 成功示例，明确默认格式与 browserInstall 存在性变化；核对示例命令与 CLI 参数一致、链接可访问，不宣称旧默认 JSON 接口完全兼容。

## 5. 综合验证

- [x] 5.1 执行 typecheck、单元测试、构建及构建后的无浏览器 CLI 验收，检查文本/JSON 成功和失败的固定案例；验证真实 tarball 的 package-only CLI/MCP/技能验收在无效浏览器配置下仍能通过，记录执行范围，并通过 OpenSpec 严格校验及 git diff --check，不进行版本递增或远程发布。
