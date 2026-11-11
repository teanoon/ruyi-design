# Tasks

## 1. 许可证与分发材料

- [x] 1.1 添加根目录 LICENSE，采用 Apache 官方完整文本；核对项目署名与年份并保留项目说明，验证全文完整且未修改条款。
- [x] 1.2 检查实际打包的技能、示例、前端及桥接构建资源中的第三方许可要求，保留所需声明；交付检查记录和必要的随包声明文件，核对其与实际包含内容一致。
- [x] 1.3 将 package.json 与 package-lock.json 的项目根许可同步为 Apache-2.0，不修改依赖自身许可；读取两处元数据确认一致且版本不变。

## 2. 发布契约与说明

- [x] 2.1 更新 scripts/release.mjs 的项目包和 lock 根许可检查，并在产物验收中检查 tarball 的许可元数据与完整 LICENSE；通过 Apache-2.0 正例及错误 SPDX、UNLICENSED、lock 不一致、缺失/截断 LICENSE 反例验证。
- [x] 2.2 更新 tests/release/release.test.mjs 的许可断言和 tarball fixture，并扩展 tests/package/install.mjs 检查实际 tarball 与安装目录的 LICENSE、包许可及必要第三方声明；运行 npm run test:release 验证，同时保持原有发布保护测试通过。
- [x] 2.3 更新中英文 README、docs/releasing.md 与 .github/workflows/publish.yml 的当前许可及确认文字，说明第三方材料和商标边界；定向检索确认有效文档和发布配置不再要求 UNLICENSED，历史归档保持原样。

## 3. 综合验收

- [x] 3.1 运行 npm run typecheck、npm test、npm run build 和 npm run test:package -- --skip-browser-checks，在本地完成 tarball 安装验收；记录许可证与运行资源检查结果，不上传 npm。
- [x] 3.2 运行 openspec validate adopt-apache-2-license --strict 并检查最终差异，确认规范、元数据、文档和实际产物一致，版本未提升且未执行真实发布；记录验证结果。
