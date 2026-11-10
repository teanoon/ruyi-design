## ADDED Requirements

### Requirement: Reproducible npmjs release artifact
发布流程 SHALL 对 @littlehobby/ruyi-design 的固定版本从确定的代码提交构建 dist/ 下的唯一 tarball，记录清单与摘要，并以该文件进行独立项目安装/CLI/MCP/技能验收及发布预演。真正发布 SHALL 使用通过验收的同一字节产物，不在验收后静默重建。包 MUST 排除源码测试、运行数据库/快照、客户端配置和嵌套 tgz，并保持新环境无需开发依赖。

#### Scenario: Promote a verified archive
- **WHEN** 维护者准备并验收一个待发布版本
- **THEN** dist 中的包名、版本、清单与摘要可复核，发布使用同一文件；任何文件变化必须重新验收

### Requirement: Explicit npmjs publication lifecycle
流程 SHALL 区分准备/dry-run 与远程发布，默认操作 MUST 不上传。远程发布 SHALL 明确选择 npmjs 公共 registry、public access 及 dist-tag，确认 scope 权限、许可意图和目标版本；重复版本或无法确定 registry 状态 MUST 阻止上传，不覆盖版本。发布后 SHALL 校验 registry 中的名称、版本、tag 和完整性信息；本地流程与 GitHub 手动触发流程 MUST 不把普通提交或测试当成发布授权。

#### Scenario: Prepare without publishing
- **WHEN** 用户执行准备、包测试或 dry-run
- **THEN** 得到可审核的本地产物与检查结果，不写入 registry，也不宣称已拥有发布权限

#### Scenario: Publish a new public version
- **WHEN** 获得维护者明确发布授权且前置条件通过
- **THEN** 上传已验收 tarball，核验远端元数据；失败不伪造成功、不自动递增版本或更换 registry

### Requirement: Controlled trusted-publisher automation
仓库 SHALL 提供 GitHub Actions 的手动触发发布流程，使用明确的版本/ref 和受保护发布环境，并将校验与上传分开。后续自动认证 SHALL 使用 npm Trusted Publisher/OIDC；首次创建包的交互式发布和外部信任配置 SHALL 有明确操作说明。仓库 MUST 不保存 npm token 或账号凭据，不因缺少信任关系静默转为 token 发布；当前许可保持 UNLICENSED，改变许可 MUST 由维护者明确决定。

#### Scenario: Trust is not configured
- **WHEN** npm package、Trusted Publisher 或发布环境配置尚未完成
- **THEN** 准备及 dry-run 仍可验证，真实发布停在明确的配置关口，说明手工首发及后续信任配置所需步骤
