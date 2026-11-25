# Spec Delta

## ADDED Requirements

### Requirement: Private caching of published preview assets
预览服务 SHALL 允许浏览器私有缓存已发布快照中按版本寻址的 CSS、JavaScript、字体和图片，直连与单入口网关 SHALL 提供相同的缓存语义。工作区 HTML、评审 API、未按版本寻址的桥接脚本、未发布候选与错误响应 MUST 保持 `no-store`。

#### Scenario: Reuse shared resources during state navigation
- **WHEN** 用户在同一已发布版本的两个状态间往返切换，且这些状态引用相同 URL 的可缓存资源
- **THEN** 浏览器可以从私有缓存复用该资源，两个状态仍分别按声明的入口和参数呈现

#### Scenario: Load resources from a newly published revision
- **WHEN** 用户已有旧版资源缓存，之后成功发布修改了可缓存资源的新版本
- **THEN** 新版本加载其自己的资源内容，打开历史版本时仍展示历史版本对应的内容

#### Scenario: Keep session and unpublished responses out of cache
- **WHEN** 浏览器请求工作区 HTML、评审 API、未按版本寻址的桥接脚本、未发布候选或不存在的预览资源
- **THEN** 响应使用 `Cache-Control: no-store`，评审和预览的访问检查继续生效

### Requirement: Private caching of the compiled preview bridge
预览 HTML SHALL 通过内容指纹引用桥接脚本。直连和单入口网关 MUST 只为指纹匹配的脚本响应启用私有不可变缓存。无指纹或指纹过期的请求返回当前脚本，并使用 `no-store`。

#### Scenario: Reuse the same bridge across page loads
- **WHEN** 用户在同一服务实例中打开多个引用同一构建产物的原型页面或状态
- **THEN** 浏览器可以从私有缓存复用桥接脚本，各页面独立取得自己的桥接配置

#### Scenario: Serve an updated bridge after reinstall or rebuild
- **WHEN** 使用不同的桥接脚本启动服务，且浏览器持有旧脚本或引用旧地址的 HTML
- **THEN** 新 HTML 引用与当前脚本内容匹配的地址，旧地址返回当前脚本并禁止缓存

### Requirement: Private caching of published prototype HTML
工作区 SHALL 为已发布的原型 HTML 使用包含当前服务缓存标识的版本化 URL。直连和单入口网关 SHALL 为符合条件的 HTML 提供 60 秒私有缓存与基于 `ETag` 的条件校验。无有效标识的 HTML、未发布候选和错误响应 MUST 保持 `no-store`。

#### Scenario: Open another page with an independent HTML entry
- **WHEN** 用户从一个原型页面切换到使用不同 HTML 的页面
- **THEN** 工作区按清单加载目标文档并应用其状态参数，浏览器可以从有效的私有缓存读取该文档

#### Scenario: Return to a previously opened prototype page
- **WHEN** 用户在缓存有效期内回到同一发布版本、服务标识和完整 URL 的独立页面入口
- **THEN** 浏览器可以复用已缓存的 HTML，重新初始化目标入口并呈现声明的页面与状态

#### Scenario: Revalidate an expired document
- **WHEN** 浏览器提交对应 HTML 的 `If-None-Match` 条件请求，且访问检查通过
- **THEN** 服务按实际返回内容匹配校验标识，匹配时返回无正文的 `304`，内容变化时返回完整的当前 HTML

#### Scenario: Isolate cached HTML across restarts and revisions
- **WHEN** 服务重启，或用户打开另一已发布版本
- **THEN** 工作区使用不同的 HTML 缓存地址并加载对应的快照与桥接配置，历史版本的内容仍可读取

### Requirement: Prototype review over plain HTTP
评审工作区和原型桥接脚本 MUST 支持浏览器未提供 `crypto.randomUUID()` 的普通 HTTP 环境。预览 iframe 的识别、桥接消息来源校验与快捷键去重 SHALL 继续生效。

#### Scenario: Open and switch prototype states without browser randomUUID
- **WHEN** 用户用普通 HTTP 访问工作区和预览，且浏览器未提供 `crypto.randomUUID()`
- **THEN** 工作区正常加载原型，用户可切换到其他已声明的状态

#### Scenario: Use a shortcut from inside a prototype without browser randomUUID
- **WHEN** 用户在上述 HTTP 环境的原型 iframe 内按下当前模式支持的工作区快捷键
- **THEN** 工作区执行对应操作一次，原型桥接脚本正常发送消息

### Requirement: Switch opted-in prototype states in the current document
原型 SHALL 可以显式支持同一发布版本、页面、设备和 HTML 入口内的状态切换。工作区 MUST 在直连和单入口网关上复用符合条件、已就绪且仍位于声明入口的 iframe。成功切换 MUST 同步工作区状态、深链接及新评论目标。

#### Scenario: Switch between states without requesting HTML again
- **WHEN** 用户通过下拉框或快捷键，在已接入的同一入口上从默认状态切到错误状态，再切回默认状态
- **THEN** 浏览器保留同一个 iframe 文档且不会发起新的 HTML 文档请求，两个状态分别呈现清单声明的初始场景

#### Scenario: Switch every Starter page state on desktop and mobile
- **WHEN** 用户在 Starter 的登录、工作台、项目详情或设置页上，选择同一设备的任一已声明状态
- **THEN** iframe 保持原文档且不会重新请求 HTML，页面显示目标状态的初始内容与控件

#### Scenario: Open a state directly or locate a saved comment
- **WHEN** 用户独立打开某状态的深链接，或定位对应状态或历史版本的已保存评论
- **THEN** 原型显示正确的页面、状态、设备及版本，现有评论及其目标按原身份保留

#### Scenario: Fall back to declared navigation
- **WHEN** 原型未接入、当前文档或目标入口不满足复用条件，或应用目标状态失败或超时
- **THEN** 工作区按声明加载目标入口，并同步显示的状态和评论目标

#### Scenario: Ignore superseded state transitions
- **WHEN** 前一次状态切换尚未完成时，用户选择另一状态、定位评论或触发版本导航
- **THEN** 最晚的有效导航决定画布和工作区状态，过期响应不会改变当前入口或把元素评论关联到其他状态
