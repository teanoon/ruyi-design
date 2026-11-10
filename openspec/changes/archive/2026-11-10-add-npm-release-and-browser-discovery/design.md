# Design

## Context

现有 dist tarball 与独立安装测试可用，但 tests/package/install.mjs 每次自行重打包，不能证明发布的是此前验收的同一文件。package.json 无 publishConfig/repository；license 为 UNLICENSED。仓库远程为 teanoon/ruyi-design，没有 .github 工作流。见 proposal.md 的动机。

浏览器验证在 src/server/preview/validate.ts 中直接 chromium.launch；doctor 仅检查 chromium.executablePath 文件存在。ReviewServer.publish 已将候选验证与活动版本原子切换分离，可以替换启动来源而保持现有校验、批次与失败回退。所有浏览器测试当前明确依赖 Playwright 浏览器，运行时没有浏览器选择参数。

## Goals / Non-Goals

**Goals:** 新环境可复用已有浏览器；doctor 与发布行为一致；可复核的同一 npm tarball 从准备到发布；仓库内交付可独立于外部账号设置完成并验证。

**Non-Goals:** 不降低浏览器验证为静态验证、不支持 CDP/远程浏览器/日常用户配置、不增加 MCP 工具或数据库迁移、不实现自动版本递增、自动 Git 推送、实际 npm 发布或许可证替换。仓库内 npm 发布流程不是设计稿 publish_revision，两种“发布”必须在文档中区分。

## Decisions

### 1. 共享浏览器发现与启动模块

拟新增 src/core/browser/ 下的配置解析、候选发现与启动逻辑，供 CLI doctor 和 validateRevision 使用。仅用已有 Playwright 和 Node 能力，不新增外部依赖。环境变量为 RUYI_DESIGN_BROWSER_EXECUTABLE 与 RUYI_DESIGN_BROWSER_CHANNEL；显式值互斥，路径必须绝对，通道先支持 chrome/msedge。其他浏览器可通过自定义路径尝试，兼容性通过实际启动检查判定，不承诺任意版本都兼容。

选择顺序：显式路径或通道（失败即报错）→自动 Chrome 通道→自动 Edge 通道→平台 Chromium 路径/PATH 候选→已有 Playwright Chromium。拒绝无声忽略错误的显式配置。自动路径按平台固定顺序枚举，Linux 包含 chromium/chromium-browser；macOS 包含 Chromium.app 的可执行路径；Windows 包含当前账户及常见安装位置下的 Chromium 可执行文件。通过规范路径去重，不执行 shell 命令字符串。WSL 仅按 Linux 发现，不跨环境搜索或执行 Windows 浏览器。

每个启动尝试限制时间，并设总体发现超时；初始建议单次 10 秒、总计 30 秒，防止多候选放大启动等待。成功需创建独立 context/page 并执行最小脚本。发布可复用这个已检查的 browser，doctor 检查后立即关闭；失败必须清理已创建的 context/进程。候选启动失败可以自动继续，但选中后的设计稿 JS/资源错误属于候选验证失败，不能靠换浏览器掩盖。开始 MCP 或预览不主动启动浏览器。

### 2. 诊断兼容与配置边界

doctor 增加 browser 对象：available、source、channel/path、version、attempts；保留 chromium 字段原语义，避免把“Playwright 文件存在”偷换为“任意浏览器可用”。退出码改为 workspace/bridge 存在且所选 browser 检查通过。MCP 不输出诊断到 stdout，错误通过原错误结果给出。找不到浏览器仍为 validation_unavailable，活动版本/反馈结果/候选清理遵循原实现。

优先使用环境配置，既能写进客户端 MCP env，也可供 doctor 和本地脚本使用；本次不增加每会话 start_review 参数，保持九个工具。CI 可以显式安装验证浏览器，产品运行时发现不得自动下载。CDP 需要另一个会话与网络生命周期设计，暂不纳入。

### 3. 一个 tarball 的发布流水线

拟新增 scripts/release.mjs 和 docs/releasing.md。准备命令默认只检查并生成发布清单，不上传：确认干净提交、package 与 lock 版本一致及元数据，typecheck/单元/必要浏览器回归 → pack:local（prepack 构建）→ dist tarball 清单/摘要 → 安装验收该文件 → npm publish <tgz> --dry-run --ignore-scripts --access public --registry=https://registry.npmjs.org/。tarball 作为发布输入时禁用生命周期，防止静默重建。

tests/package/install.mjs 增加显式 tarball 参数；未传入保留现有自行打包行为，传入时不得重打包。发布清单记录 git SHA、名称/版本、dist-tag、文件清单、摘要与验收结果，存放 dist/；打包排除发布清单和其他本地产物，防止随包泄露绝对路径或再次膨胀。

远程发布单独显式执行。预检 registry 中该版本是否存在，404 才代表未发布，网络/权限失败不能当作空包。local 首发需 npm 登录、2FA、@littlehobby 权限及许可确认；维持 UNLICENSED，不替维护者选择 MIT 等许可。package 增补 public/官方 registry/repository 元数据，版本默认不变，重复版本明确失败。上传前再次验证摘要；上传后比对 npm view 的版本、dist-tag 和 dist integrity。认证由 npm 处理，不打印或写入凭据。

### 4. 手工首发与 GitHub OIDC 后续发布

本变更交付 .github/workflows/publish.yml，使用 workflow_dispatch，输入版本、ref/提交与 dist-tag，校验指定代码中的版本一致；普通 push/PR 不触发发布。检查阶段完成后，上传阶段使用 GitHub environment npmjs 和 id-token: write、contents: read，发布权限仅在上传 job 获得。目标 ref 限于维护分支可达提交/对应版本 tag，并记录被批准的提交与摘要；不接受任意 PR 代码直接发布。

npmjs 首包仍由维护者手工创建。随后按 npm 设置将 Trusted Publisher 绑定 teanoon/ruyi-design、publish.yml、npmjs environment；GitHub 环境保护/审批由维护者显式配置。未配置的外部账号关系不影响仓库内 dry-run/模拟测试完成，但真实上传不能视为已完成。运行器使用 Node 24 和符合当时 npm OIDC 要求的 npm（官方当前最低 11.5.1）；托管 runner 明确安装测试浏览器。工作流不得依赖默认已有登录 token。准备与上传间传递同一 tarball 和摘要，不重新打包。

stable 版本使用 latest，预发布版本使用 next 或显式非 latest tag；版本/tag 规则在准备阶段统一校验。失败不自动改版本、改 tag 或切换认证。CI 结构在本地/fixture 中验证，不为验收本变更擅自推送工作流、创建环境或发布包。

## Risks / Trade-offs

- [系统浏览器版本、策略、依赖差异] → 真实启动检查、明确来源和失败链、显式配置失败不回退、已有 Playwright 后备。
- [浏览器探测耗时与进程泄漏] → 总体/单次超时、finally 清理、测试失败和中断的回收路径。
- [doctor 兼容] → 保留旧字段并新增 browser 对象，退出码按真实可用性；文档说明变化。
- [CI 平台与 npm 规则变化] → 实施时再核对官方文档，将外部配置步骤与可自动验收的代码区分。
- [准备后产物被替换] → 安装、dry-run 和上传固定同一 tarball，发布前验证摘要，测试不重打包。

## Migration Plan

先交付浏览器配置/发现及诊断，再接入验证和消费者测试，再建立发布准备与 CI。默认 Playwright 已安装环境继续可用；无系统浏览器时按指引显式安装或配置，不能降级发布。回滚代码即可恢复原启动策略，数据和不可变历史不迁移。发布准备可重复执行；registry 中已发布版本不可覆盖，后续修正通过新版本或明确维护操作处理。

## External Release Preconditions

@littlehobby 发布权限、许可意图、首包创建、Trusted Publisher 与 GitHub 环境保护需要维护者在真实发布前确认。它们是外部发布前置条件，不是本次创建规划文件时已获得的授权，不把它们伪装成代码测试通过。

## References

- [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)
- [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype)
