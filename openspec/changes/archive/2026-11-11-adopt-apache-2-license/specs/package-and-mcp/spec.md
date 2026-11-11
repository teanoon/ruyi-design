# Spec Delta

## ADDED Requirements

### Requirement: Apache-2.0 licensed distribution
项目自有代码与随仓库提供的项目材料 SHALL 默认采用 Apache License 2.0，另有明确第三方授权声明的材料保持原有许可。仓库根目录与实际 npm 分发包 MUST 包含完整的 Apache-2.0 `LICENSE`；项目包元数据与 lock 根条目的许可标识 SHALL 一致为 `Apache-2.0`。中英文 README SHALL 指向许可证并准确说明许可，MUST 不将项目许可证解释为第三方材料的重新授权或产品商标授权。分发物 SHALL 保留实际包含的第三方材料所要求的许可及归属声明。

#### Scenario: Inspect source and installed package licensing
- **WHEN** 使用方查看仓库或从实际 tarball 安装 `@littlehobby/ruyi-design`
- **THEN** 两处均可读取完整 LICENSE，包的 license 为 Apache-2.0，仓库 lock 根条目和中英文文档一致，另行授权材料的声明可辨认且得到保留

#### Scenario: Reject inconsistent license metadata or missing license
- **WHEN** 待验收产物缺失 LICENSE、包含不完整许可证，或项目包和 lock 根条目的许可不是一致的 Apache-2.0
- **THEN** 本地发布准备或包验收失败，不将其视为合格的发布产物

## MODIFIED Requirements

### Requirement: Controlled trusted-publisher automation
仓库 SHALL 提供 GitHub Actions 的手动触发发布流程，使用明确的版本/ref 和受保护发布环境，并将校验与上传分开。后续自动认证 SHALL 使用 npm Trusted Publisher/OIDC；首次创建包的交互式发布和外部信任配置 SHALL 有明确操作说明。仓库 MUST 不保存 npm token 或账号凭据，不因缺少信任关系静默转为 token 发布；当前项目许可 SHALL 为维护者明确选择的 Apache-2.0，工作流确认及发布文档 SHALL 与该许可一致，改变许可 MUST 由维护者明确决定。采用开源许可 MUST 不被视为远程发布授权。

#### Scenario: Trust is not configured
- **WHEN** npm package、Trusted Publisher 或发布环境配置尚未完成
- **THEN** 准备及 dry-run 仍可验证，真实发布停在明确的配置关口，说明手工首发及后续信任配置所需步骤

#### Scenario: Confirm publication under the selected license
- **WHEN** 维护者查看手动发布确认与发布操作说明
- **THEN** 许可均明确为 Apache-2.0，仍须确认 scope 权限和目标版本；创建许可变更、提交或运行测试均不自动上传 npm
