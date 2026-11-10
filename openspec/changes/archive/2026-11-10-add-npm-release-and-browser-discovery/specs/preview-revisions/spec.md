## MODIFIED Requirements

### Requirement: Atomic verified publication
浏览器 SHALL 展示不可变的已发布版本；源文件保存 MUST 不自动发布中间状态。发布 SHALL 使用配置/发现且实际启动检查通过的浏览器验证完整候选并绑定基础版本，失败 MUST 保留上一个可用版本；MUST 不因浏览器不可用改为仅静态验证。

#### Scenario: Incomplete edit or failed candidate
- **WHEN** AI 保存部分文件，或候选入口缺失、浏览器加载报错、验证环境不可用
- **THEN** 用户继续看到原已发布版本，系统返回检查失败原因而不发布

#### Scenario: Stale publisher
- **WHEN** 发布请求的基础版本与当前版本不符
- **THEN** 系统拒绝旧请求，要求客户端重新获取上下文

#### Scenario: Publish with an existing system browser
- **WHEN** 系统或显式浏览器可用且完整候选验证通过
- **THEN** 无需另装默认 Chromium 即可按原子流程发布；反馈与对话两种来源遵守相同验证和失败保护
