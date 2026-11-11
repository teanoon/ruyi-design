# Design

## Context

动机见 proposal.md。当前 `package.json`、lock 根条目和两份 README 使用 `UNLICENSED`，根目录没有 LICENSE。`scripts/release.mjs` 的 `validateMetadata` 强制检查 UNLICENSED，但没有检查 lock 的许可；发布测试、手动工作流和发布文档依赖这一约定。主规范 `Controlled trusted-publisher automation` 也要求保持 UNLICENSED，需通过本变更 delta 更新。

现有打包安装测试检查运行资源和包身份，可在其中验收许可证；发布脚本已有 tarball 读取与完整性验证，可复用来检查产物。Vite 构建前端资源，桥接脚本单独构建；不能仅根据运行时依赖的 package.json 判断随包声明是否充分。

## Goals / Non-Goals

**Goals:** 建立源码、lock、实际 tarball 和发布流程一致的许可契约；以真实产物验证许可证，保留现有发布保护。

**Non-Goals:** 不更换依赖、不改业务界面、不批量给源码增加文件头、不提升版本或执行发布；不改写历史归档记录，不宣称已发布旧包的字节或元数据已改变。

## Decisions

### 1. 官方许可证全文与项目说明分开维护

根目录 `LICENSE` 使用 https://www.apache.org/licenses/LICENSE-2.0 的原文，保持条款完整、不将版权主体填进条款占位示例。项目署名沿用已有 LittleHobby，年份按项目事实核对并在 README 的许可证段或适当归属文件中标注，不将品牌署名扩展为未经核实的法人身份。许可默认覆盖项目自有材料；明确第三方许可继续适用。仅添加 SPDX 标识或链接不能代替完整许可证，因此不采用“只改 package.json”的方案。

### 2. 保留第三方声明，以实际分发内容决定声明文件

检查 npm 包将分发的技能、示例和构建资源，以及 Vite/桥接构建内联的第三方内容，保留其要求的许可和署名；如有随包集中声明需要，加入相应声明文件并确保打包。npm 安装的独立依赖保持各自许可证，不将其统一改成 Apache-2.0。不为使用 Apache-2.0 而机械创建空 NOTICE，也不将目前 7 个直接依赖的初查当成完整来源审计。

### 3. 同步修改发布契约并验收真实产物

将项目包与 lock 根条目的 license 校验收紧为 Apache-2.0；更新 workflow 确认文字、错误提示、README 和发布文档。保留现有 registry、scope、版本、明确发布授权、干净提交和同一字节产物检查。

发布准备/产物验收检查 tarball 的 package.json 和完整 LICENSE，安装测试确认用户实际获得相同内容。新增有意义的负向覆盖：旧 UNLICENSED、错误 SPDX、lock 不一致、缺失/截断 LICENSE 均不可通过；更新现有 release fixture，避免仅测试工作区文件而漏掉打包遗漏。npm 可能自动收录 LICENSE，但以实际 tarball 检查为准。

## Risks / Trade-offs

- 第三方材料被误当作项目自有内容 → 针对实际分发内容检查来源并保留所需声明，无法确定来源的材料明确记录并解决后再验收。
- 全局替换 UNLICENSED 破坏历史事实 → 仅更新当前有效约束和文档，保留 archive 与历史说明。
- 发布检查修改放宽其他保护 → 对许可正反例和既有发布测试一起回归。
- 新 LICENSE 未进入实际 npm 包 → tarball 与安装目录双重检查完整文本及元数据。

## Migration Plan

在一个实现变更中同步提交许可证、元数据、文档和检查。运行发布单元测试、构建及本地 tarball 安装验收，再验证 OpenSpec；验收不调用真实上传。未来发布使用另行授权的新版本，旧版本不在本变更中重发。实现前可直接修订规划；实现后若需调整授权，必须另行明确决定，不能靠删除许可证撤销已授出的权利。
