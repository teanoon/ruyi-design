# Release candidate validation

This report covers the local `0.1.0` candidate. It is not an npm publication or a claim that every coding client has identical behavior.

Environment: Linux/WSL, Node.js 24.19.0, npm 11.17.0, Codex CLI 0.167.0, Playwright 1.65.0 / Chromium 158. SQLite uses Node's built-in `node:sqlite`, so no native addon compilation is required.

Validation commands:

```bash
npm run typecheck
npm run build
npm test
npm run test:package
npm run test:deleted
npm run test:gateway
npm run test:codex
```

The domain/HTTP suite verifies manifest references, invalid schema versions, combination enumeration, shared implementation declarations, path and symlink boundaries, snapshot exclusions, immutable and idempotent batches, exclusive ordered leases, lease recovery, human verification, history preservation, transaction/event consistency, replay gaps, process locks, database version protection, authentication, removal of the browser submission endpoint, port conflicts, source-file preservation, and explicit conflict-preserving skill setup.

The browser workflow uses the real SDK stdio transport and Chromium. It saves element feedback without creating a batch, verifies that monitoring tools and submission controls are absent, prepares a snapshot through MCP only for a user-requested update, retries that snapshot after a new comment to ensure the input stays fixed, verifies safe-field context, updates a shared stylesheet, checks CSS publication and form preservation, updates JS and checks restoration plus unsaved composer preservation, confirms fixes through the UI, inspects every applicable component state and tokens, rejects a broken candidate, opens a direct error/mobile state link, and restarts the review against its existing data.

The package test runs the same workflow after installing the actual tarball in a separate temporary consumer project with development dependencies omitted. It executes the installed npm binary and checks the published file list. Test fixtures, source, OpenSpec, databases and host caches are excluded from the package.

Real Codex tests use `codex exec --ignore-user-config --ephemeral --skip-git-repo-check --json` and an explicitly configured local stdio server with workspace-write/network-enabled execution. Existing login is used; no separate API credentials are added. The test runs two separate user-requested rounds over saved comments, including snapshot preparation, claims, context reads, clarification replies, release and clean shutdown, without a monitoring tool. A second test saves a comment after startup, sends SIGINT, and starts a new CLI run against the same project; the subsequent run reads retained review context and shuts down. Summaries under `test-results/` contain tool names/statuses rather than browser credentials.

The agent ends its turn after opening review or processing the requested round. Only a new user request starts another update; saving a comment does not wake the client. Browser arbitrary JS state remains outside generic restoration guarantees.

The gateway browser test additionally covers flat page navigation, state/device dropdowns, preview versus default element commenting, opaque-frame isolation, saved comments remaining pending, and authenticated reload. Actual `design.dev.test:34000/?port=4173` rendering and connection state were checked separately.

The host environment required per-command sandbox escalation for npm networking, local listeners, Chromium and real CLI tests. Ordinary workspace file edits and type checking stayed within the workspace sandbox. This does not require changing the delivered package's runtime permissions for an ordinary local user.

The deletion workflow additionally verifies explicit published deletion metadata, surviving-container markers, immutable original snapshots, historical URL/reload recovery, returning to the latest revision, and retaining a historical comparison while another revision is published. Real gateway checks use the existing deleted settings note and verify both the marker and the original text.

The candidate package is `@littlehobby/ruyi-design`, with the `ruyi-design` binary and `ruyi-design-mcp` handshake. It uses `UNLICENSED` and has not been published.

## 如意设计品牌迁移验收 · 2026-11-09

本轮通过类型检查、构建、22 项领域/HTTP 测试、`test:brand`、`test:gateway`、`test:starter`、`test:deleted`、`test:package` 和真实 `test:codex`。MCP SDK 核对握手 `ruyi-design-mcp`、精确的 9 个 `ruyi_design_` 工具及三项 `ruyi-design://` 资源，旧工具返回错误，旧资源拒绝读取。安装后的消费者不需要开发依赖；技能安装幂等，旧技能定制内容保留，新技能冲突与符号链接仍受保护。

品牌截图位于忽略的 `test-results/brand/`：marks（16–64px 与单色）、desktop、narrow、actual-deletion、actual-history、actual-narrow。已人工核对玉绿如意符号、字标、木色署名、暖白画布、评论卡片与归档、普通定位实线、删除虚线和历史横幅。桌面 1440px 和窄屏 390px 无宿主横向溢出，窄屏保留可访问品牌名称。键盘跳过链接与预览按钮可达，焦点 3px，减少动效设置生效。正文、辅助文字、公司署名和历史文字至少 4.5:1，控件边界至少 3:1；为满足正文对比度，将木色从规划起点 `#9B6A45` 加深到 `#8E603E`。

Northstar 仍保持原紫色品牌、页面标题和共享令牌，61 个有效入口全部通过；逻辑设备宽度保持 desktop 1280 / mobile 390，独立于外壳窗口。原有及上一候选恢复 API、新恢复 API、多者并存的优先级及单次调用均通过，旧凭据存储键可在同一有效会话中恢复。原型源和不可变快照无需改写。

实际项目在旧服务退出后完整备份到 `/tmp/ruyi-design-backup-20261109-180745`。通过 `preview:starter` 的新 `RUYI_DESIGN_*` 变量及新 MCP 调用重启，保留 `.uxai-review/` 原路径。迁移前后全部 9 条 records 内容一致，SQLite schema 仍为 1，当前版本仍为 `7c26a35e`；两条评论保持归档。三个历史版本共 75 个快照文件的哈希全部一致，没有创建 `.ruyi-design/` 空库。实际 HTTPS 网关 `design.dev.test:34000/?port=4173` 验证了跨设备定位、删除父容器、原版本文字、返回最新版本与窄屏。只读检查未更改真实用户评论。

本仓库的受管技能经逐文件比较后由 `prototype-review` 更名为 `ruyi-design-review`，安装新源后 setup 写入数为 0；MCP 配置仅将旧连接键更名为 `ruyi_design`，其余命令参数和设置保留。新进程连接已经 SDK 和真实 Codex 验证；当前交互客户端仍需重连才能刷新会话里缓存的工具/技能列表。

公共命名矩阵见 [迁移表](migration-to-ruyi-design.md)，包、CLI、握手、连接键、技能、工具、资源、数据目录、环境变量和恢复接口均按表实现。旧名称审计白名单为：历史 OpenSpec（不回写既有规范和归档）、迁移说明、旧数据/凭据/恢复 API 兼容逻辑、旧技能迁移提示以及显式回归 fixtures 与其临时目录。公开帮助、默认接入和工具发现使用唯一新身份。物理仓库目录不更名。没有执行 npm 发布、Git 提交或远程推送。

本轮命名进一步统一为 `ruyi-design`：包 `@littlehobby/ruyi-design`、CLI `ruyi-design`、服务 `ruyi-design-mcp`、连接 `ruyi_design`、技能 `ruyi-design-review`。展示名仍为“如意设计 · Ruyi Design”。数据发现补充 `.ruyi-uxai/` 兼容，所有两两目录组合及三个目录同时存在均拒绝歧义；恢复 API 优先级为 ruyiDesign → ruyiUxai → uxai，凭据键同样保留两代兼容。旧候选仅作为兼容输入和迁移说明保留，不暴露重复工具。

## 如意设计自身设计稿

根目录 `design/` 新增 4 个产品页面：设计工作区、评论与归档、版本对照、开始评审。桌面和手机共 58 个有效页面/状态及组件入口，复用 6 组组件和 13 个令牌。`npm run test:design` 验证全部入口无资源错误或横向溢出，令牌与 CSS 实际值一致；验证了预览、保存本地原型评论、状态恢复、确认归档、重新打开回到待处理、原版本对照与连接错误。截图位于 `test-results/product-design/`。

通过 `preview:design` 使用独立 `.ruyi-design/` 评审根目录设计稿，Northstar 的 `.uxai-review/` 保持原有数据。网关要求动态生成的图片与内部链接同样携带 port；设计稿的 routedMarkup 保留显式网关参数，直接本机托管时不修改链接。初次尚未分享且没有评论的预览已完整备份到 `/tmp/ruyi-product-unshared-preview-20261109-182947`，正式评审使用修复后的初稿。

实际 HTTPS 网关已验收正确产品目录、初稿图片、原型内部导航、手机归档状态、组件全部状态和 13 个令牌；本轮未提交真实评审评论，demo 数据逐条核对保持不变。

## 产品评论第一轮更新

本轮冻结 13 条反馈，一次处理。设计稿收敛为 1 个工作区、48 个页面/组件状态设备入口；移除独立评论、版本、连接页面和多余入口，连接状态在左下角。评论卡片与已有实现保持一致，补齐倒序、已有目标激活、原位编辑与 Ctrl/Cmd+Enter。四套 SVG Logo 候选及小尺寸对比已截图检查，默认品牌未擅自替换。

通过 22 项单元/HTTP 测试、test:design、test:editing、原有 browser 完整发布闭环、gateway 和 deleted 回归。组件 measure/resize 通过来源及 frameId 校验，有限尺寸范围为 160–7680px；使用实际布局边界避免 scrollHeight 的视口下限，使用任务队列避免视口外 iframe 的动画帧暂停。组件逻辑宽度保留，页面高度仍为设备高度。原位编辑保存不新增重复评论，已固定处理输入只能回复。

本轮已通过 MCP 发布为 `498c8c00`，共 12 条 modified 和 1 条按要求保留现状的 unaddressed，未代用户确认或归档。四条具体删除记录已关联新版本中存续的导航、头部或反馈容器；已删除页面的原版本仍可查看，返回最新版本会回到有效工作区。实际 HTTPS 网关验证了目录收敛、删除标记、已删除页面的历史查看和返回、评论倒序、五个紧凑品牌示例及桌面/手机尺寸，Logo 图片全部加载成功。

## 手动归档修复

归档从“确认已发布修复”分离为独立浏览器操作，支持 unaddressed、需要澄清及重新打开/新建草稿，保留原目标、结果和历史；排队/处理中的快照仍受保护。新增 resolution=archived/confirmed 的可选 JSON 元数据，无须改写旧记录或 SQLite schema。通过 24 项单元/HTTP 测试和 test:archive，覆盖 active batch 拒绝、无需修改归档、重新打开再次归档及刷新后持久化。重载实际服务，未替用户归档现有评论。

## 精密赛博 Logo 候选

新增数字如意、电路方印两套 SVG 候选，独立对比页通过实际 HTTPS 网关检查，包含深浅底、16/24/40px、单色和应用图标。桌面 1440px、手机 390px 无横向溢出；两项偏好控件和携带 port 的 SVG 下载可用，源文件与公共导出逐文件相同。设计稿源的 52 个入口及七个品牌状态内容适配通过。已发布设计稿仍为此前的 498c8c00，本次只提供独立探索页，未替换正式品牌或修改已存评论。

## 对话直接发布与原 session 连续性

新增 conversation 发布模式，沿用九个工具，原 feedback 调用兼容。通过 28 项单元/HTTP 测试，以及真实 SDK/浏览器 conversation 流程：同 session 和 URL 自动更新、无虚构评论/批次、请求/基版本绑定的幂等与冲突、候选失败保留旧版并可重试、活动反馈互斥、验证期间出现反馈时中止提交、原版本和重启连续性。原 browser 反馈发布闭环回归通过。技能源与本仓库受管副本同步，技能校验和类型检查通过。

两套精密赛博 Logo 已以 source=conversation 发布为 e723db1d，session 仍为 7edf66f6-24ff-4cfe-b3d5-e54bf82f8473，基版本为 498c8c00。原 13 条评论和原批次逐条比较完全相同，无新评论或批次；请求原文摘要记录于版本元数据。此前的静态公共入口已移除，设计稿中的候选通过原 session 的品牌标志 E/F 查看。

实际原 session 网关验收通过：七个紧凑品牌状态全部加载，E 数字如意 / F 电路方印可见，所有 SVG 正常；原归档评论仍可查看旧版本并返回最新版本。

## 如意方印提交墙填色

B 如意方印改为 7×7 方格、五档玉绿色，保留白色如意；24px 及以下降低纹理强度。16–128px 视觉检查通过，实际网关的 SVG 与源文件逐字一致。通过 conversation 发布原 session 新版 f1a705f1，基版本 e723db1d，所有声明入口验证通过；原 13 条评论和批次未改变。仅变更方印 SVG 与该方案说明，其他 Logo 保持原样。

## 如意本体的方格融合

B 如意方印去除白色线条叠层，改由深绿方格直接构成云头与回转柄，浅色方格形成提交墙背景。标准版为 13×13，24px 及以下使用较粗的 9×9 轮廓；16–160px 视觉对比已检查。原 session 通过 conversation 发布 7623f11f，实际 SVG 与源文件一致，所有声明入口验证通过，原评论和批次保持不变。

## Logo 最终定稿

按用户要求撤销本体像素化，精确恢复 f1a705f1 的提交墙底＋白色如意，作为唯一正式标志。运行时与设计稿的 ruyi-mark/ruyi-wordmark/mono 逐文件一致；其他候选 SVG、对比页与选择按钮从当前源和新快照中移除，旧快照保留。品牌展示只含标准、小尺寸及同形单色适配。

构建、44 个设计稿入口、品牌 MCP/浏览器与评论编辑回归通过。原 session 已发布 e199c2cd；实际网关验证批准版本的 SVG 字节完全相同、运行时/设计稿一致、无候选选择界面。原 13 条评论和批次保持不变。


## 快捷键与批准设计稿同步

用户明确回复“设计稿通过”，批准 revision `4d96de1a-50c1-4be3-a955-3162446240dc` 后同步真实工具。移除顶栏/外壳项目名与多余提示，连接与品牌底部左对齐，版本进入预览按钮；状态/设备控件旁提供按键提示，评论按进行中/已归档切换，独立归档语义保持。

通过 typecheck、build、28 项单元/集成，test:shortcuts 的真实跨源与 opaque 网关流程（输入/IME/原生与 ARIA 控件保护、边界/稀疏组合/回退、深链接、草稿、帧来源/动作白名单/去重、原版本禁用、窄屏和直接发布），以及 editing/archive/brand/gateway/starter/deleted 回归。桌面/窄屏截图与批准设计稿按 design/review-checklist.md 人工对照，记录真实版本 ID、数据与逻辑视口等必要差异。

实际 tarball `littlehobby-ruyi-design-0.1.0.tgz` 含 66 个公开文件，在独立项目以无开发依赖安装通过。完整包内浏览器+stdio MCP 流程通过两轮发布、CSS/JS 状态恢复、失败候选保护、组件/令牌、归档重开和重启。原 HTTPS 网关通过外壳及内层原型快捷键验收，设计稿 revision 不变，无需改动历史快照。已打开的旧外壳刷新一次即可使用新工具；设计稿后续发布仍自动更新。

本地交付路径现统一为 `dist/littlehobby-ruyi-design-0.1.0.tgz`，由 `npm run pack:local` 生成。再次验证已有 dist tarball 时重打包仍为 66 个公开文件、无嵌套 tgz，独立项目安装、技能 setup 和完整 MCP/浏览器流程通过。根目录旧 tarball 已清理；新环境与 Chromium 职责说明已更新。

## 层级页面导航

新增可选 `pageNavigation`，保留平铺 `pages`、组合枚举和评论 Target。父页面名称打开自身入口，箭头独立展开/收起；纯分组只折叠。产品原型与工作区共用 `design/components/page-navigation.js` 和 CSS，实际发布包通过 Vite 内联，不依赖产品原型源目录。

本轮检查：`npm run typecheck`、`npm test`（9 个文件、62 项测试）、`npm run build`、`npm run test:design`、`npm run test:shortcuts`、`npm run test:gateway`。生成 JSON schema 已用旧 starter、递归导航和非法节点 ID 样例核对；MCP schema 资源读取生成文件，模板继续提供兼容的平铺 starter。OpenSpec 严格校验及 `git diff --check` 通过。

`npm run test:navigation` 的综合场景包含 60 页（10 个父页面各 5 个子页面）、折叠不重建 iframe/不改 URL 或历史记录/不丢评论草稿、搜索与原展开状态恢复、纯分组、原生键盘与焦点恢复、中文组合输入、页面移组后的评论定位、历史目录与最新目录切换、浏览器历史及不可变快照、禁用存储后的可用性和窄屏长名称。产品原型额外检查同源不同项目共用节点 ID 时的偏好隔离，以及各导航实例 aria-controls 目标唯一性。

桌面和窄屏截图位于 `test-results/navigation/runtime-{1280,390}.png`、`test-results/product-design/navigation-{desktop,mobile}.png`；已查看确认层级、独立箭头、换行和布局。共用验收清单及模拟数据与实际运行时的差异见 `design/review-checklist.md`。本轮未创建真实评审评论或发布到现有用户 session；浏览器流程使用临时测试项目及评审数据。

## 层级导航反馈修订

本轮按三条用户反馈补充首页子页面展开入口（桌面/手机及内层状态选择器），将文字箭头替换为 flex 居中的 SVG，并在评审桥接的元素评论模式拦截 pointerdown 默认聚焦与原型处理器。`npm run test:focus` 验证真实产品设计稿中的设备/状态下拉框不再夺取评论输入焦点，后续键入保持在外层；预览模式仍可聚焦和操作原型。测试同时检查展开入口不依赖已保存的折叠偏好，以及 SVG 与标题的垂直中心差小于 1.5px。

导航图标反馈：将无子页面节点的空白占位替换为单页 SVG；有子页面节点分别使用收起/展开文件夹 SVG。三种图标均使用统一 16px 轮廓与居中容器，名称选择和独立展开操作保持一致。`npm run test:focus` 通过桌面/手机焦点、展开入口及垂直居中检查；已查看 `test-results/review-focus/navigation-icons-{1280,390}.png`，确认三种节点图标可区分，叶子节点前不再空白。

导航选中样式反馈：将当前页背景从名称按钮移到包含图标的整行，名称按钮保留 aria-current；统一页面根节点与设计系统入口的行宽、左右内边距、图标尺寸和文字起点，窄屏两组入口均保留图标。桌面/手机焦点与居中检查通过，已查看更新的导航截图确认高亮完整包裹图标和标题，根节点与设计系统左右边界及内容列对齐。

本轮评论交互反馈通过 `npm run test:comments` 验证父/中间/子元素精确匹配、相同元素多条评论、取消编辑后原文可见，以及归档/解决后保留当前标签。产品原型同步“新增评论”入口和标签行为，46 个入口、评论编辑、归档与直接/网关快捷键回归通过。SVG 标志去除白底并将 viewBox 裁到方印边界，像素检查确认圆角透明、上下左右外沿无额外留白；浅/深背景截图在 `test-results/review-assets/transparent-brand.png`。导航 hover/focus 高亮统一整行覆盖，并保留独立操作。

连接状态反馈：将突出的绿色整行文字调整为品牌区上方的辅助信息行，加入细分隔线、左侧本机工作区标识、右侧小状态点与低强调连接文字；品牌与状态间距缩至12px。窄屏简写本机，保留左右边界对齐。原型及真实工作区共用 connection-status.css；真实事件流仍更新修改中、重连和失败状态，状态区域保留role=status。已查看桌面和手机截图确认视觉融合、文字不溢出，焦点和布局专项检查通过。

纯文字状态胶囊与自动重开：状态移入品牌文字列第二行，替换英文副标题，去除上一版独立行/图标/状态点。桌面/手机截图及46个入口检查通过。追加用户回复自动将非处理中的评论重新打开为draft，原文、Target与历史结果保留；排队/处理中回复保留原批次输入，发布后成为下一轮draft。新增3项反馈单元测试，合计65项通过；浏览器评论检查覆盖归档评论回复后的自动重开和进行中可见。前端兼容尚未重启的旧MCP服务，刷新工作区后即可应用自动重开行为。


## 最终批准与重启后对照（2026-11-11）

最终批准版本为 `6c0bfd72-fec4-4c32-972c-6c604b2cee24`。用户先确认“设计审核通过”，随后在Codex/MCP重启后确认“重启后功能/设计正常”。当前服务继续使用同一评审数据，所有评审批次已完成，没有待处理评论。上文记录的独立连接行等中间方案属于评审历史，当前规范以 `design/review-checklist.md` 的纯文字品牌胶囊及已批准评论行为为准。

实测HTTPS入口在1280/390px均返回200，页面脚本路径与当前dist/workspace/index.html一致，内外层品牌胶囊结构/文字/圆角相同，无英文副标题或装饰符号，无页面脚本错误或横向溢出。最终截图 `test-results/final-review/runtime-{1280,390}.png` 已人工查看。类型检查、65项测试、评论、焦点、直接/网关快捷键回归重新执行通过，OpenSpec增量校验通过。评审运行数据和凭证不纳入Git。
