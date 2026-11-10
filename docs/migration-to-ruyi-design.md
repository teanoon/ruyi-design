# 迁移至如意设计

本版本仍为未发布候选 0.1.0。技术名称切换属于 breaking change；旧命令、旧工具与旧资源不提供别名。当前可安装实际构建的本地 tarball；正式发布后可使用 `npm install -D @littlehobby/ruyi-design`，本次未执行发布。

| 用例 | 原名称 | 新名称 |
| --- | --- | --- |
| 产品 | UXAI Review | 如意设计 · Ruyi Design |
| npm 包 | uxai-review | @littlehobby/ruyi-design |
| CLI | uxai-review | ruyi-design |
| MCP 握手 | uxai-review | ruyi-design-mcp |
| 默认连接键 | uxai_review | ruyi_design |
| 技能及目录 | prototype-review | ruyi-design-review |
| 9 个工具 | start_review 等无前缀动词 | ruyi_design_start_review 等 |
| 指南 | uxai://guides/prototype-review | ruyi-design://guides/review |
| schema / template | uxai://schemas/manifest、uxai://templates/manifest | ruyi-design://schemas/manifest、ruyi-design://templates/manifest |
| 新默认数据目录 | .uxai-review/ | .ruyi-design/ |
| 恢复 API | window.uxaiReviewState | window.ruyiDesignReviewState |
| 示例环境变量 | UXAI_* | RUYI_DESIGN_* |
| 桥接通道 / 注入 | uxai-review / __UXAI_CONFIG__ | ruyi-design / __RUYI_DESIGN_CONFIG__ |
| 覆盖层 / 会话凭据 | data-uxai-review-overlay / uxai-review:&lt;session&gt;:token | data-ruyi-design-overlay / ruyi-design:&lt;session&gt;:token |

## 升级

1. 通过旧客户端结束评审并停止服务。完整备份实际 dataRoot，包括 SQLite、WAL（如有）、快照和元数据，不能只复制活动数据库主文件。
2. 安装新 tarball，执行 `npx ruyi-design doctor --project /absolute/project`。新包不会在安装时修改项目。
3. 按 [MCP 文档](mcp.md) 将目标连接改成 `ruyi_design`，命令改成 `npx --no-install ruyi-design mcp`。保留其他连接。连接键是客户端别名，可自定义，不影响协议握手或数据身份。
4. 执行 `npx ruyi-design setup --client codex --project /absolute/project`。新技能安装到 `.agents/skills/ruyi-design-review/`。相同内容幂等、用户修改冲突和符号链接保护不变。setup 报告 `prototype-review` 和上一候选 `ruyi-uxai-review` 等旧技能，不删除它们；确认内容并另行备份定制文件后停用对应的旧技能，避免两套工作流同时激活。
5. 重连 MCP、重新加载技能。新工具发现中只有 9 个 `ruyi_design_` 工具。用新工具启动原项目，显式传绝对 projectRoot/designRoot，核对版本及评论，打开新链接。重启发放新凭据；有效旧凭据可由旧会话存储键兼容读取，但不承诺重启后仍有效。

## 数据与原型

显式 `dataRoot` 优先。默认候选为 `.ruyi-design/`、上一候选的 `.ruyi-uxai/`、原有 `.uxai-review/`：只存在一个时原地复用，均不存在时在 `.ruyi-design/` 初始化；任意多个候选同时存在则拒绝猜测，要求显式 dataRoot。不会搬移、合并或重写历史，也不改变 SQLite schema、session/revision/comment ID、版本指针或快照哈希。将三个数据目录都加入忽略规则。

新原型使用 `window.ruyiDesignReviewState`，缺少时依次回退 `window.ruyiUxaiReviewState`、`window.uxaiReviewState`；每次捕获或恢复只调用优先级最高的接口一次。不要修改不可变历史快照来更新品牌。消费者的页面、组件、令牌、品牌与设备尺寸无需迁移。

上一轮未发布的本地候选也一并迁移：

| 上一候选 | 当前名称 |
| --- | --- |
| `@littlehobby/ruyi-uxai` / `ruyi-uxai` | `@littlehobby/ruyi-design` / `ruyi-design` |
| `ruyi-uxai-mcp` / `ruyi_uxai` | `ruyi-design-mcp` / `ruyi_design` |
| `ruyi-uxai-review` / `ruyi_uxai_*` | `ruyi-design-review` / `ruyi_design_*` |
| `ruyi-uxai://` / `RUYI_UXAI_*` | `ruyi-design://` / `RUYI_DESIGN_*` |
| `.ruyi-uxai/` / `window.ruyiUxaiReviewState` | 新默认 `.ruyi-design/` / `window.ruyiDesignReviewState`，旧输入继续兼容 |

旧候选包、命令、工具和资源同样不提供别名；更新配置后重连。浏览器依次兼容 `ruyi-uxai:<session>:token`、`uxai-review:<session>:token`，仅适用于仍有效的凭据。上一候选的环境变量 `RUYI_UXAI_*` 需改为 `RUYI_DESIGN_*`；脚本不再读取旧变量。

## 示例启动与端口网关

```bash
RUYI_DESIGN_HOST=0.0.0.0 RUYI_DESIGN_PORT=4173 RUYI_DESIGN_PREVIEW_PORT=4174 RUYI_DESIGN_BASE_URL='https://design.dev.test:34000/?port=4173' npm run preview:starter
```

这组变量用于源码仓库的 preview 脚本。可选 `RUYI_DESIGN_PREVIEW_BASE_URL` 对应旧 `UXAI_PREVIEW_BASE_URL`；其余后缀 HOST、PORT、PREVIEW_PORT、BASE_URL 保持不变。旧 `UXAI_*` 变量不再读取。单入口网关省略 PREVIEW_BASE_URL，设计稿使用隔离的 opaque iframe。显式端口占用时直接报错。

## 回退

停止新服务，恢复之前的包、配置和技能后重连；原地复用的旧目录仍在原路径，数据格式不变。若回退新建项目，旧服务必须显式传 `.ruyi-design/` 为 dataRoot，防止创建空库。需要恢复备份时先完整保留升级后数据，再停服恢复整个备份；不要混合两份数据库与快照。


## Doctor 输出格式迁移

本次 doctor 输出契约包含两项不兼容变化，适用于包含此变更的新版本：

- `npx ruyi-design doctor` 默认输出中文文本摘要，重定向或管道中也保持文本。原先直接解析默认 JSON 的脚本必须改为 `npx ruyi-design doctor --json`。
- `browserInstall` 不再无条件存在：只有自动发现全部失败且建议中包含可选 Chromium 安装方案时才提供。调用方应检查字段存在性，或读取结构化 `recommendations`。

JSON 的 `status` 为 `ok` 或 `error`，对应退出码 0 或 1；`checks` 区分 `passed`、`failed` 和 `not_checked`。`chromium` 仍仅表示默认 Playwright 浏览器文件存在，不参与总体成功判定；请使用 `status` 和 `browser.available`。已采集的原有字段及完整 `browser.attempts` 保留。

Edge 通过检查且其他必需检查成功时，默认摘要显示“检查结果：通过”、“Microsoft Edge”、“系统安装”和“额外浏览器安装：不需要”，即使 `chromium` 为 false 或先前 Chrome 尝试失败。`doctor --verbose` 显示完整候选诊断；底层错误中的安装提示属于历史诊断，当前操作以摘要中的建议为准。`doctor --json --verbose` 始终输出单个 JSON 对象。

数据目录歧义和无效 `--design` 清单也会生成统一的失败报告。新目录显示“首次启动评审时创建”，不代表已创建或已验证写权限。出现多个数据目录时先确认应使用的目录；MCP `ruyi_design_start_review` 可显式指定 `dataRoot`，doctor 没有同名参数，也不会自动删除或合并目录。

本次格式变更无需迁移评审数据或设计清单。自动发布工作流继续使用 package-only 验收，不运行 doctor 或浏览器检查。
