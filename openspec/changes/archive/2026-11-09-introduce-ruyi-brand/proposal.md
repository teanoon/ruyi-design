# Proposal

## Why

现有产品已具备可交互设计预览、评论、修订发布和历史对照能力，但界面与接入方式仍使用 UXAI Review 工作名。需要以“小爱好 · LittleHobby”旗下的“如意设计 · Ruyi Design”建立统一身份，支撑未来网页、桌面和移动端 UI/UX 预览与评审。

## What Changes

- 引入产品品牌规范、如意曲线标志、字标、favicon、公司署名和“让设计，更合心意。”标语；以温润玉绿、木色和暖白作为待实施验证的视觉方向。
- 改进工具外壳的导航、画布、评论、归档、历史版本和处理状态层次；保持设计稿所属项目的品牌与资产独立。
- 采用“品牌展示名 + 技术产品标识 + 用途后缀”的命名体系：展示名为如意设计 / Ruyi Design，技术产品标识为 `ruyi-design`。
- **BREAKING** npm 包切换为 `@littlehobby/ruyi-design`，CLI 切换为 `ruyi-design`；MCP 协议服务名为 `ruyi-design-mcp`，默认客户端配置键为 `ruyi_design`。
- **BREAKING** 9 个 MCP 工具统一使用 `ruyi_design_` 前缀；技能名称/目录变为 `ruyi-design-review`，资源 URI 切换为 `ruyi-design://`，同步本项目接入配置、文档、示例及测试。
- 保留已有评论、归档、快照、版本 ID 和项目绑定；新项目使用 `.ruyi-design/`，自动识别并原地复用既有 `.uxai-review/` 或 `.ruyi-uxai/`，不通过品牌更名重建初始版本。
- 更新原型恢复接口和内部品牌标识，继续兼容旧设计稿的 `window.uxaiReviewState` 与上一候选的 `window.ruyiUxaiReviewState`；提供明确的旧命令、配置、技能及资源迁移说明。

- 建立根目录 `design/` 中的如意设计自身交互设计稿及独立评审入口，覆盖页面/状态/设备、共享组件和令牌，不再以 Northstar demo 代替本产品评审。

## Capabilities

### New Capabilities

- `product-brand`: 产品与公司身份、品牌资产、工具外壳视觉、可访问性和设计稿品牌边界。

### Modified Capabilities

- `package-and-mcp`: 新包、CLI、服务、工具、资源和技能命名契约，以及接入迁移和冲突保护。
- `preview-revisions`: 新旧数据目录发现、既有记录与版本连续性、旧原型恢复接口兼容。

## Impact

- 影响 `package.json`/lock、`src/cli`、`src/mcp`、`src/skills`、`skills/`、`src/browser`、服务桥接配置、会话数据目录发现、示例、文档和全部集成入口。
- 预计新增品牌常量/资产与工具自身语义令牌，复用现有 TypeScript/Vite/SVG 能力，无需新增运行依赖。
- 这是尚未正式发布的本地候选包，技术名称采用一次性切换；不同时暴露两套 MCP 工具。旧接入需按文档修改并重连，数据与已存设计资产保留兼容。
- npm 作用域及发布权限属于正式发布前检查，本变更不执行注册、发布、推送或商标可用性承诺。
- 不扩展多平台运行引擎、设计编辑器、云同步或智能体后台监听；现有用户主动发起的一轮评审流程继续适用。
