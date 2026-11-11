# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit npmjs publication lifecycle
流程 SHALL 区分准备/dry-run 与远程发布，默认操作 MUST 不上传。远程发布 SHALL 明确选择 npmjs 公共 registry、public access 及 dist-tag，确认 scope 权限、许可意图和目标版本；重复版本或无法确定 registry 状态 MUST 阻止上传，不覆盖版本。发布后 SHALL 校验 registry 中的名称、版本、tag 和完整性信息；本地流程与 GitHub 发布流程 MUST 不把普通分支提交或测试当成发布授权；维护者推送符合校验条件的版本标签 SHALL 作为该版本的明确发布授权，手动触发 SHALL 保留显式确认。

#### Scenario: Prepare without publishing
- **WHEN** 用户执行准备、包测试或 dry-run
- **THEN** 得到可审核的本地产物与检查结果，不写入 registry，也不宣称已拥有发布权限

#### Scenario: Publish a new public version
- **WHEN** 获得维护者明确发布授权且前置条件通过
- **THEN** 上传已验收 tarball，核验远端元数据；失败不伪造成功、不自动递增版本或更换 registry

### Requirement: Controlled trusted-publisher automation
仓库 SHALL 提供 GitHub Actions 的版本标签推送发布流程，并保留手动触发入口，使用明确的版本/ref 和受保护发布环境，并将校验与上传分开。后续自动认证 SHALL 使用 npm Trusted Publisher/OIDC；首次创建包的交互式发布和外部信任配置 SHALL 有明确操作说明。仓库 MUST 不保存 npm token 或账号凭据，不因缺少信任关系静默转为 token 发布；当前项目许可 SHALL 为维护者明确选择的 Apache-2.0，工作流确认及发布文档 SHALL 与该许可一致，改变许可 MUST 由维护者明确决定。采用开源许可 MUST 不被视为远程发布授权。

#### Scenario: Trust is not configured
- **WHEN** npm package、Trusted Publisher 或发布环境配置尚未完成
- **THEN** 准备及 dry-run 仍可验证，真实发布停在明确的配置关口，说明手工首发及后续信任配置所需步骤

#### Scenario: Confirm publication under the selected license
- **WHEN** 维护者查看手动发布确认与发布操作说明
- **THEN** 许可均明确为 Apache-2.0，仍须确认 scope 权限和目标版本；创建许可变更、提交或运行测试均不自动上传 npm

#### Scenario: Publish a pushed stable or prerelease tag
- **WHEN** 维护者推送 `vVERSION` 标签且该标签对应版本与包一致、提交属于 origin/main 并与触发事件提交一致
- **THEN** 工作流自动验收并通过 OIDC 发布同一字节产物，稳定版使用 latest，预发布版使用 next；配置的环境审批仍须满足

#### Scenario: Reject an invalid tag publication
- **WHEN** 标签版本与包不一致、提交不属于 main、标签已移动而不再对应触发事件，或事件为标签删除、普通分支推送或 PR
- **THEN** 工作流不得发布 npm；重复 npm 版本仍由既有发布检查阻止
