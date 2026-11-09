# Design

## Context

动机及范围见 proposal.md。当前为已归档首版实现后的 TypeScript 单包：Node/Fastify/MCP SDK 提供服务，Vite 构建原生工作区，SQLite 和不可变目录快照持久化评审。npm 尚未正式发布，工作树在本次规划前干净。

现有公开命名散布于 package/bin、CLI 帮助、MCP 注册与 Resources、技能源及安装路径、示例脚本、文档和测试。默认数据目录是 `.uxai-review/`；原型恢复契约为 `window.uxaiReviewState`。工具界面目前是 `UXAI Review` 字标和 U 图标，紫色值分散在 CSS 与桥接脚本中。Northstar 是待评审示例品牌，不能与工具品牌混淆。

本变更跨越界面、协议及持久化入口，因此需要迁移设计。它不改变“用户保存评论，再主动要求 AI 更新”的工作流。

## Goals / Non-Goals

**Goals:**
- 分离展示名称、包名、命令、协议服务名和客户端别名，并让代码、技能、配置及验收使用同一映射。
- 建立可维护的品牌资产和语义令牌，完善工作区视觉，不侵入设计稿样式。
- 在技术名称切换后继续读取既有评论、版本、归档与设计资产，避免隐式创建空评审库。

**Non-Goals:**
- 不在此次迁移中提供旧命令、旧资源或无前缀工具别名；不同时向模型展示两套工具。
- 不自动发布 npm、创建组织、重命名物理仓库路径或修改归档中的历史提案。
- 不新增原生应用、多平台仿真引擎、云端账户或设计编辑器；品牌定位允许后续扩展。

## Decisions

### 1. 固定命名映射，集中定义身份

| 层级 | 新标识 |
|---|---|
| 中文 / 英文产品 | 如意设计 / Ruyi Design |
| 中文 / 英文公司 | 小爱好 / LittleHobby |
| 署名 / 标语 | 小爱好出品、By LittleHobby / 让设计，更合心意。 |
| npm / CLI | `@littlehobby/ruyi-design` / `ruyi-design` |
| MCP 握手名称 / 默认配置键 | `ruyi-design-mcp` / `ruyi_design` |
| 技能 / Resource 前缀 | `ruyi-design-review` / `ruyi-design://` |
| 新默认数据目录 | `.ruyi-design/` |

命名按“公司 → 产品线 → 用途”分层：`littlehobby` 标识发布者，`ruyi-design` 标识该设计预览与评审产品，`mcp` 与 `review` 分别说明协议服务和技能用途。展示名称保留“如意设计 / Ruyi Design”，不把技术后缀强加到界面字标或公司署名。

| 品牌用例 | 规范名称 | 用途说明 |
|---|---|---|
| 安装包 | `@littlehobby/ruyi-design` | 公司作用域下的具体产品分发单元 |
| 终端命令 | `ruyi-design` | 承载 mcp、setup、doctor 子命令 |
| MCP 协议服务 | `ruyi-design-mcp` | 明确标识该产品的 MCP 服务 |
| 默认客户端连接键 | `ruyi_design` | 连接配置与客户端侧命名空间；用户可修改 |
| 技能名称与目录 | `ruyi-design-review` | 明确产品归属与评审工作流用途 |
| 工具函数前缀 | `ruyi_design_` | 如 `ruyi_design_start_review`，标识产品工具集 |
| Resource scheme | `ruyi-design://` | 如 `ruyi-design://guides/review`；路径表达资源用途，不重复产品名 |
| 默认本地数据目录 | `.ruyi-design/` | 隔离此产品的评审数据 |
| 示例环境变量 | `RUYI_DESIGN_*` | 如 `RUYI_DESIGN_PORT`，限定产品配置范围 |
| 原型恢复接口 | `window.ruyiDesignReviewState` | 供该产品桥接调用的评审状态恢复接口 |

内部通道、注入配置、定位覆盖层和会话存储键分别使用 `ruyi-design`、`__RUYI_DESIGN_CONFIG__`、`data-ruyi-design-overlay`、`ruyi-design:<sessionId>:token`。这些技术标识与产品展示名分开维护。前一稿的 `ruyi` CLI、`.ruyi/` 数据目录和 `ruyiReviewState` 仅存在于未实施提案中，不视为已落地的兼容接口；已实现的上一轮本地候选标识 `ruyi-uxai` 本次同步更名；其 `.ruyi-uxai/`、`window.ruyiUxaiReviewState` 及凭据存储键作为兼容输入，原有 `.uxai-review/` 与 `window.uxaiReviewState` 也继续兼容。旧 CLI、工具和资源不提供别名。

新增 `src/contracts/brand.ts` 作为可被 Node 与浏览器安全导入的纯常量源，避免在 UI、帮助和 MCP 指南中各自拼写名称。package.json 与 lock 的名称按表更新；版本仍为未发布候选 `0.1.0`。CLI bin 只提供 `ruyi-design`。客户端配置键 `ruyi_design` 是用户侧别名，不用于服务协议身份、SQLite 项目身份或目录解析。

9 个工具名称均为旧动词名称加 `ruyi_design_`：start_review、get_review_context、prepare_update、claim_batch、get_feedback_context、update_feedback、publish_revision、set_feedback_location、end_review。参数、返回字段和操作顺序保持现有契约。Resources 为 `ruyi-design://guides/review`、`ruyi-design://schemas/manifest`、`ruyi-design://templates/manifest`。服务 instructions、工具描述、start 返回 guideUri 与技能调用示例必须同批更新。

采用一次性切换，因为当前仍是未发布候选；相较保留 18 个重复工具或再加兼容模式，这能让模型和使用方有唯一接入路径。迁移文档明确这是 breaking change，并要求修改配置后重连，而不是承诺旧调用继续成功。将来的公开发行需独立确定版本及发布政策。

### 2. 工具外壳的品牌系统

形象从木作如意的曲线提炼，制作简洁 SVG 标志、字标组合和 favicon。优先用一条有辨识度的轮廓建立记忆点；不把完整器物、画板、聊天气泡等全部堆到标志里。提供小尺寸和单色版本，使用本地字体栈，不引入远程字体或图片服务。最终 SVG 几何细节在实施阶段结合工作区截图调整，不另行扩大命名范围。

以下色值是实施起点，需经过对比度及实屏验证，可为达到验收要求在同一方向内调整：

| 作用 | 起点 |
|---|---|
| 品牌主色 / 选中 / 普通定位 | 玉绿 `#2F6B58` |
| 主色悬停 | 深玉绿 `#255644` |
| 品牌浅底 | `#E8F0E9` |
| 工作区底色 | 暖白 `#F7F5EF` |
| 内容面板 | `#FFFFFF` |
| 主文字 | 墨绿 `#263C32` |
| 次文字 | `#647267` |
| 木色装饰 | `#9B6A45` |

分为 primitive → semantic → component 三层：色值在基础层集中，品牌/文本/边界/成功/错误/删除/历史等语义层绑定用途，控件层消费语义变量。木色用于少量署名与装饰，不替代错误、删除或历史警示色。桥接高亮使用同源品牌配置或共享常量；保留删除标记的区别，不让原型全局 CSS 变量接管工具的语义。

界面保持导航—画布—反馈三栏：导航强调项目与页面，状态/设备保留内容区下拉框，预览按钮仍在左侧页面上方。统一头部品牌与项目名的层次、控件高度、间距、圆角、评论卡片、归档入口、空态和历史横幅。产品署名放在稳定的外壳位置，标语用于帮助理解产品的合适位置，不把宣传文案反复插入评审操作。窄屏下优先保留画布与操作，允许品牌文字简化但保留可访问名称。

默认元素评论、显式预览、跨组合定位、删除父容器标记、原版本对照、归档与重新打开均为验收基线。品牌更换不重写 Northstar 的 CSS 令牌、Logo 或项目标题。

### 3. 文件及模块落点

| 位置 | 规划改动 |
|---|---|
| `src/contracts/brand.ts` | 共享身份、协议及内部品牌常量 |
| `src/browser/assets/` | 本地 SVG 标志、favicon 及必要字标资产 |
| `src/browser/styles/brand.css` | 品牌基础/语义/控件令牌，工作区样式导入 |
| `src/browser/workspace/` | 标题、头部、署名、状态/归档/历史等界面 |
| `src/browser/bridge/`、`src/server/` | 新桥接标识与配置、品牌高亮及恢复兼容 |
| `src/core/sessions/` | 数据目录发现及旧数据原地复用 |
| `src/cli/`、`src/mcp/`、`src/skills/` | 包命令、工具/资源名称及技能安装迁移 |
| `skills/ruyi-design-review/` | 更名后的唯一技能源及原型指南 |
| `docs/brand-guidelines.md` | 名称、署名、资产、配色、字体和使用边界 |
| `docs/migration-to-ruyi-design.md` | 命名映射、重连、技能冲突、数据发现与回退步骤 |
| `design/`、`scripts/preview-design.mjs` | 如意设计自身的页面/状态/设备设计稿、共享组件与令牌；显式独立 dataRoot，不复用 demo 数据 |
| README、示例脚本、tests | 新接入和完整回归；保留明确的 legacy fixtures |

此表是实施目标，本次规划不创建这些实现文件。

### 4. 数据发现采用原地兼容

会话打开前解析数据目录，显式 dataRoot 优先。默认候选为 `.ruyi-design/`、上一轮本地候选的 `.ruyi-uxai/` 和原有 `.uxai-review/`：

1. 传入 dataRoot：沿用现有路径边界和项目绑定校验。
2. 只存在一个候选目录：原地复用它，不创建其他目录。
3. 候选均不存在：在 `.ruyi-design/` 初始化。
4. 任意两个或三个候选同时存在：在创建目录或打开 SQLite 前返回歧义错误，要求显式 dataRoot。

不自动复制、重命名、合并或删除旧目录，也不修改 SQLite 记录 ID、schema 版本、快照内容或文件哈希。继续使用同一进程锁与绝对项目绑定。doctor 报告发现结果或歧义；忽略规则与 npm 打包检查覆盖三个候选目录。

该方案相比自动搬库能避免 WAL、活动进程锁和两份历史分叉。旧项目可继续使用旧目录名称；如果使用方未来要搬迁，应单独停服并完整备份后显式选择新 dataRoot，不在品牌升级中静默完成。

### 5. 桥接和已安装技能的兼容边界

内部注入配置、postMessage channel、DOM overlay 标识按第 1 节的 `ruyi-design` 技术命名映射更新，由同一构建版本的服务与浏览器同时更新。`data-review-id`、页面/状态/设备 ID、session/revision ID 和公开 URL 的路由参数不改名。新会话凭证仍按原生命周期发放，不承诺重启后旧凭证继续有效；浏览器会话存储键更名时依次读取 `ruyi-uxai:<sessionId>:token` 和 `uxai-review:<sessionId>:token` 旧键作为有效凭证的兼容来源，错误时给出重新打开链接的提示。

原型作者使用 `window.ruyiDesignReviewState`；桥接依次选择 `window.ruyiDesignReviewState`、`window.ruyiUxaiReviewState`、`window.uxaiReviewState` 中第一个存在的接口，每次捕获或恢复只调用所选接口一次。更新 starter 和原型指南使用新接口，旧不可变快照按原样加载。示例脚本环境变量统一 `RUYI_DESIGN_*`，迁移表记录原 `UXAI_*` 名称。

`ruyi-design setup` 安装 `.agents/skills/ruyi-design-review/`，保留现有“相同文件幂等、不同文件冲突、拒绝符号链接越界”规则。对用户既有 `ruyi-uxai-review` 或 `prototype-review` 目录给出冲突或迁移信息，不自动删除定制文件。本仓库安装副本若与变更前的官方源完全一致，可作为已授权的受管副本更名；否则保留并报告。MCP 配置升级只针对本仓库已配置的旧连接，生成默认键 `ruyi_design` 的片段；其他项目仍由使用方显式更新，不扩展 setup 为任意客户端配置编辑器。

### 6. 验证覆盖可见身份与真实迁移

- 以 SDK stdio 验证握手、9 个规范工具及新 Resources，拒绝旧名称；所有测试与指南真实调用新工具，而非只搜索字符串。
- 真实 tarball 安装验证 scoped package、`bin/ruyi-design`、带新目录的技能、已构建品牌资产与 doctor；发布白名单继续排除本地记录及客户端状态。
- 迁移 fixture 先生成旧目录、已发布修订、评论/归档和删除位置，再以新入口打开，验证身份及指针不变，并完成新一轮发布和原版本查看。
- 单独验证任意多候选目录冲突、显式 dataRoot、技能用户修改保护、旧恢复接口以及新旧接口优先级。
- 浏览器检查工作区和网关入口的标题/品牌/图标、键盘操作、对比度、窄屏、预览/评论、定位、归档、历史对照及自动更新；对修改前后截图人工检查层次与设计稿品牌隔离。
- 旧品牌搜索使用白名单：历史归档、迁移说明、显式兼容代码和 legacy fixtures 可以出现旧标识；公共帮助、默认配置、技能源和新工具发现中不得残留旧身份。

## Migration Plan

1. 停止旧 MCP 及本地服务，完整备份当前实际 dataRoot；不在活动数据库写入时仅复制 sqlite 主文件。
2. 构建新包和工作区，完成自动化及视觉验收；新安装使用 `@littlehobby/ruyi-design` 和 `ruyi-design` 命令。本变更只产出本地 tarball，不执行 npm 发布。
3. 更新本仓库受管 MCP 配置和技能副本，处理旧目录冲突；向其他项目提供明确的安装及迁移步骤。
4. 重连 MCP，使用新工具启动原项目并确认复用旧目录和当前版本；重新提供带有效凭证的评审 URL。
5. 根据旧评论完成一次读取、定位、历史对照及归档检查，再验证新一轮主动更新。
6. 若回退：停止新服务，恢复旧代码/包与客户端配置；旧目录未被移动且数据格式未变，旧入口使用同一实际 dataRoot。新项目若仅有 `.ruyi-design/`，旧工具必须显式传此 dataRoot，防止创建空 `.uxai-review/`。

## Risks / Trade-offs

- [旧工具或资源名称失效] → 明确 breaking 迁移、单一新工具集、同步技能与配置并重连。
- [品牌更名导致空库或丢失历史] → 原地发现旧目录、多候选目录拒绝猜测、迁移前后验证版本和评论身份。
- [旧原型快照无法恢复交互] → 保留旧恢复接口回退，以旧快照 fixture 验证，不改写历史资产。
- [颜色和装饰影响可读性或定位语义] → 语义令牌、对比度及键盘检查，删除/历史色独立于主色。
- [用户定制技能或配置被覆盖] → 受管内容检查、冲突报告及仅针对目标连接的更新。
- [npm scope 或名称无发布权限] → 正式发布前独立核验；本地 tarball 和 bin 验收不依赖 registry 发布。

### 本产品评审对象

根目录 `design/` 是如意设计自身的界面设计稿，按用户评论收敛为设计工作区，评论/归档与原版本查看在工作区内完成；包含组件、令牌和多套 Logo 候选，移除独立评论、版本和连接引导页面。它通过本工具评审；画布内可包含演示被评审页面的示意内容，但 Northstar 消费者 demo 不作为本产品的评审目标。`preview:design` 显式使用 `<仓库>/.ruyi-design`，旧 demo 的 `<仓库>/.uxai-review` 继续保留；两套库不合并，后续启动必须显式选择 dataRoot。

### 本轮评论交互调整

评论以存储创建顺序倒序呈现；点击已有评论的元素选择最新匹配评论，draft 原位编辑，已纳入处理的评论只允许在原位补充回复，不改写固定批次输入。编辑/回复表单嵌在原卡片位置，Ctrl/Cmd+Enter 调用表单校验后保存。组件 iframe 保持设备逻辑宽度，通过已校验来源、frameId 的 measure/resize 消息使用内容高度（160–7680px）；页面 iframe 仍保留设备高度。Logo 候选不自动替换默认品牌。

### 归档与确认修复分开

浏览器 review endpoint 增加 archive 操作，与 resolve 分开。archive 将非活动批次评论移入 resolved 存储分组并标记 resolution=archived，保留原处理结果；resolve 仍仅接受 awaiting_review 并标记 confirmed。归档草稿清理 previousDraft，避免重新打开后的隐藏回退状态残留。无旧库迁移，已有 JSON 记录未标记时沿用原确认语义。Agent MCP 不增加归档工具。

### 精密赛博候选

用户选择继续探索数字如意与电路方印，风格为精密、克制。原生 SVG 与独立对比稿保存在 design/brand-explorations，公共导出在 src/browser/assets/explorations，build 后由现有静态入口提供。品牌组件源新增 E/F 候选，当前发布快照和正式标志保持原样；本次独立对比页面不假造用户反馈或绕过批次发布。

### 对话直接发布

沿用九个工具，在 publish_revision 中引入 source=conversation；默认 source=feedback 维持兼容。共用 PublicationInput/schema 和快照验证/原子事务，conversation 记录 request、baseRevision、source，不调用 feedback.published。幂等键绑定来源、请求和基版本；活跃反馈与并发发布互斥，验证后重查，失败删除候选快照并保留原版本。移除此前独立静态公共入口，候选仍在原 session 的品牌组件中查看。

### 最终标志选择

用户撤销如意本体方格化，确定 f1a705f1 中的提交墙底＋白色如意为唯一正式标志。设计稿和运行时公用同版 ruyi-mark/ruyi-wordmark，保留同形单色适配；删除其他候选和偏好选择入口，品牌组件改为标准、小尺寸、单色应用三项。不可变评审历史不重写。
