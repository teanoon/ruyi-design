# Validation · 2026-11-11

本记录补录标签发布实现完成时的检查结果。

- `npm run test:release`: 21/21 passed。5 项新增测试使用临时 Git 仓库覆盖轻量/附注标签、真实 CLI GITHUB_OUTPUT、稳定/预发布渠道、手动确认、非法事件、包版本不匹配、main 外提交及标签目标变化；现有 16 项发布回归保持通过。
- `node --check scripts/release-ref.mjs`: passed。
- 使用 PyYAML BaseLoader 解析 workflow，检查 v* push、手动入口、prepare sha/version 输出、验收步骤 version/tag 输入、publish version 来源及 id-token 权限：passed。
- `git diff --check`: passed。
- `openspec validate --specs --strict`: 7/7 passed；两项 MODIFIED requirement 与主规范完整块一致。

发布测试的 registry 与 npm 上传均为模拟。未触发真实 GitHub Actions、未更改外部 npm trust/环境策略、未创建或推送发布标签、未执行 npm 发布。版本保持 0.3.0。本变更只影响发布自动化，未重跑产品浏览器回归。
