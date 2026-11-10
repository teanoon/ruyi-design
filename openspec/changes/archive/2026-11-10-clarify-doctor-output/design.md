# Design

## Context

见 proposal.md 的动机。当前 `src/cli/index.ts` 在 doctor 分支中直接组装 `any` 对象并输出 JSON；`chromium` 只是 Playwright 默认可执行文件是否存在，`browser.available` 才来自实际启动检查。`browserInstall` 无条件赋值，浏览器失败尝试直接保留了底层库的安装提示。两处自动化依赖当前默认 JSON：`tests/integration/browser-discovery.mjs` 和 `tests/package/install.mjs` 的完整浏览器分支。

`src/core/browser/index.ts` 已提供真实启动、版本、来源和尝试链，并负责关闭检查实例。`resolveDataRoot` 只解析目录选择：`source: new` 不代表已创建目录，也没有检查未来的写权限。可选 `--design` 调用 `loadCatalog`；目录歧义或清单错误当前会走最外层文本异常通道。

用户已确认默认使用文本摘要，机器调用显式添加 `--json`。项目没有 CLI 国际化设施；本次文本沿用产品默认中文，JSON 字段名保持英文，不增加自动语言判断或新的语言参数。

## Goals / Non-Goals

**Goals:** 所有格式由同一份报告得到相同结论；普通用户无需理解底层布尔值或通道名；失败建议对应真正阻塞项；自动化有可迁移的显式接口。

**Non-Goals:** 不改变 Chrome→Edge→Chromium→Playwright 的发现顺序、启动超时或显式配置失败策略；不增加 Node 版本兼容检测、远程浏览器、自动安装/修复、MCP 工具或 CLI 全量国际化；不恢复发布 CI 的浏览器检查，不在此阶段修改或发布实现。

## Decisions

### 1. 一次采集，统一报告，独立渲染

拟将 doctor 报告采集、最终状态计算、建议生成和纯文本渲染移到 `src/cli/doctor.ts`，`index.ts` 保留参数解析和命令分发。报告提供 `status`、`summary`、按项的 `checks` 和结构化 `recommendations`；检查状态区分 `passed`、`failed`、`not_checked`。文本和 JSON 必须消费同一结果，渲染阶段不能再次启动浏览器或重新探测文件。

整体状态沿用既有检查边界：工作区/桥接资源和已执行的浏览器检查必须成功，目录解析和用户要求的清单检查不能出错。Node 版本仅为信息，不将其伪称为新增且已通过的兼容检查。新数据目录显示“首次启动评审时创建”；不得据此暗示已有数据或已验证写权限。可预期诊断错误转换为统一报告；未运行的后续检查标记 `not_checked`，不伪造失败浏览器或安装建议。CLI 参数语法错误仍遵守参数解析器的既有错误规则。

不采用只在现有 JSON 前打印一行提示的方式，因为那会使机器输出失去可解析性；也不复制浏览器探测逻辑，因为 doctor 必须继续与设计稿发布使用同一启动检查。

### 2. 默认文本、显式 JSON、显式详细信息

`doctor` 默认输出中文文本；TTY 与管道使用相同格式。`doctor --json` 将报告序列化为单个 JSON 对象，成功/失败分别返回 0/1，不混入摘要、颜色或其他日志。`doctor --verbose` 在文本摘要之后追加诊断依据。两项同时指定时 JSON 格式优先，详细依据仍保留在 JSON 内。

对于用户提供的 Edge 案例，目标文本如下（目录示例已泛化）：

```text
如意设计 · Ruyi Design
检查结果：通过

工作区资源：可用
桥接脚本：可用
验证浏览器：Microsoft Edge 157.0.4341.42
浏览器来源：系统安装
浏览器启动验证：通过
额外浏览器安装：不需要

Node.js：v24.16.0
评审数据目录：D:\projects\example\.ruyi-design（首次启动评审时创建）
```

普通摘要不显示 `chromium: false`、未选中 Chrome 的错误或任何安装浏览器命令。详细文本可以保留原始错误，但须明确它们属于“未选用候选的诊断信息”，底层错误里的安装提示不等于当前建议。输出不能用红色、错误图标或警告级别表示成功回退中的缺失候选。

浏览器名称按可信诊断映射：`chrome` 为 Google Chrome，`msedge` 为 Microsoft Edge，Playwright 来源为 Playwright Chromium，系统路径候选显示“系统 Chromium”；其他显式路径显示“自定义浏览器”并展示路径，避免根据文件名猜测品牌。版本取不到时显示“版本未获取”，不将其独立判为启动失败。来源区分系统安装、显式指定和 Playwright 安装。

### 3. JSON 迁移和旧字段的限定含义

JSON 新增示意字段（其他现有字段与完整尝试链仍保留）：

```json
{
  "status": "ok",
  "summary": "检查通过，已使用系统 Microsoft Edge，无需额外安装浏览器。",
  "workspace": true,
  "bridge": true,
  "chromium": false,
  "checks": {
    "workspace": { "status": "passed" },
    "bridge": { "status": "passed" },
    "browser": { "status": "passed" }
  },
  "browser": {
    "available": true,
    "name": "Microsoft Edge",
    "source": "system",
    "channel": "msedge",
    "version": "157.0.4341.42",
    "attempts": [
      { "source": "system", "channel": "chrome", "error": "Chrome 未找到" },
      { "source": "system", "channel": "msedge" }
    ]
  },
  "recommendations": []
}
```

保留 `chromium` 的原始布尔语义，避免将“自带浏览器文件存在”改写成“任意浏览器可用”。它不参与最终状态计算，也不作为默认文本中的失败项。完整尝试链保留在 `browser.attempts` 中，保证故障调查有依据。

`recommendations` 是包含 `code`、`message` 和可选 `command` 的数组。成功时不提供浏览器安装建议；`browserInstall` 仅在数组中确实有安装 Chromium 的可选建议时保留。此字段的无条件存在保证明确结束，需要在迁移文档中列出，不能把本变更描述为默认接口无变化。

### 4. 建议由最终阻塞原因决定

- 浏览器成功：无浏览器修复操作；缺失的 Chrome 或 Playwright Chromium 仅为诊断信息。
- 显式配置失败：建议修复所选通道、绝对路径、互斥配置或启动条件，不通过推荐另一浏览器掩盖错误。优先依据显式来源和检查阶段归类，不依赖匹配某个 Playwright 英文错误句式。
- 自动发现全部失败：说明“没有通过启动检查的浏览器”，提供同环境已有 Chrome/Edge、显式可执行路径和可选安装 Chromium 的路径，不将 Chromium 安装写成唯一必需条件。
- 工作区、桥接或可选清单失败：针对资源安装/构建或清单错误给出建议；可用浏览器保持成功状态。
- 数据目录歧义：保留候选目录信息并说明需明确选择；不删除/合并目录，不虚构 doctor 尚不支持的 `--dataRoot` 参数。

### 5. 以固定诊断输入验证展示，不依赖宿主 Edge

单元测试通过固定报告和诊断输入覆盖用户的 Windows Edge 回退案例、自定义路径、未知版本、全失败、显式冲突和资源缺失。核心断言包括整体结论、来源、版本、建议是否适用，以及默认摘要不出现误导性的缺失/安装提示。

CLI 格式与退出码通过构建后的子进程验收，失败场景采用显式无效配置以保证不启动浏览器；这类验收在 build 后运行，不能令现有 `npm test` 依赖尚未生成的 `dist/`。已有浏览器发现集成及完整安装测试的 JSON 调用增加 `--json`。npm 发布工作流的 package-only 验收仍不调用 doctor 或浏览器集成测试。

## Risks / Trade-offs

- [现有脚本解析默认输出] → 由用户明确确认格式变化；随实现迁移仓库调用，文档列出 `--json` 和 `browserInstall` 的变化。
- [隐藏候选失败使故障难定位] → `--verbose` 和 JSON 保留完整尝试链，并将候选历史与最终建议明确区分。
- [资源失败但浏览器成功时报告矛盾] → 从同一检查模型计算总体状态，分别显示各检查结果，只建议修复真实失败项。
- [旧字段持续造成误读] → 默认文本不展示该布尔值，JSON 的新状态/摘要为直接结论，文档限定 `chromium` 的兼容含义。
- [被跳过的检查被误写为失败] → 使用明确的 `not_checked` 状态，浏览器未启动时不推导安装建议。
- [测试重新引入 CI 浏览器依赖] → 文本/JSON 的主要验收使用固定输入；构建后的失败 CLI 用例不启动浏览器，发布流程保留现有跳过边界。

## Migration Plan

先建立统一报告和格式化测试，再接入 CLI 参数；随后更新两处已知 JSON 消费方及中英文文档。验证旧 `chromium` 字段仍表示原语义，默认文本与 `--json` 结果/退出码一致，详细模式不污染 JSON。实现结束时记录实际执行的测试和平台范围；不以规划文件存在作为测试通过。

默认输出切换和 `browserInstall` 条件化都应写入发布说明；本提案不自行递增版本或执行发布。若需回滚，恢复 CLI 旧渲染分支并同步调用方，数据、清单和评审历史无需迁移。
