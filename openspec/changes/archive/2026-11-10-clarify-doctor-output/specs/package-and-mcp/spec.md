## ADDED Requirements

### Requirement: Human-readable doctor summary by default
`ruyi-design doctor` SHALL 默认输出人类可读文本，首先明确整体检查通过或失败，再展示工作区资源、桥接资源及浏览器检查的实际结果。浏览器结果 SHALL 使用可辨认名称、可获得的版本和来源，不要求用户根据 `chromium`、`channel` 或失败尝试列表推断是否可用。新数据目录 SHALL 标注为首次评审时创建，不因尚未创建而被报告为检查失败。输出格式 MUST 不因 TTY、重定向或管道而自动改变。

#### Scenario: Edge satisfies the browser requirement
- **WHEN** 工作区和桥接资源可用，系统 Edge 通过启动检查，但默认 Playwright Chromium 文件不存在
- **THEN** 默认文本明确显示整体通过、Microsoft Edge、其可获得版本、系统来源，以及无需额外安装浏览器；不显示误导性的 Chromium 缺失失败项

#### Scenario: Required package asset is missing
- **WHEN** 浏览器可用，但工作区或桥接必需资源不存在
- **THEN** 总体结果明确失败，指明实际缺失的资源；浏览器仍显示其真实可用状态，不建议为此额外安装浏览器

#### Scenario: Redirect the default report
- **WHEN** 用户将不带格式选项的 doctor 输出重定向到文件
- **THEN** 文件仍包含与交互运行相同类型的文本摘要，机器调用方须显式使用 `--json`

### Requirement: Explicit machine-readable doctor report
`ruyi-design doctor --json` SHALL 在标准输出生成且仅生成一个合法 JSON 对象，不混入文本摘要或 ANSI 控制序列。报告 SHALL 提供 `status`、`summary`、每项检查结果和结构化 `recommendations`；`status` 为 `ok` 或 `error`，整体通过时退出码为 0，检查失败时为 1。JSON SHALL 保留已有 `product`、`package`、`node` 以及已执行检查对应的 `data`、`workspace`、`bridge`、`chromium`、`browser` 和可选 `catalog` 字段含义，浏览器的完整尝试链 SHALL 保持可获取。`browserInstall` SHALL 仅在对应的安装建议适用时出现。可预期的数据目录解析、浏览器诊断及可选目录清单错误 MUST 转换为一致的 doctor 失败报告，未执行的检查 MUST 明确标注为未检查，不得伪称通过或不可用。

#### Scenario: Machine consumer requests JSON
- **WHEN** 自动化脚本使用 `doctor --json`，系统 Edge 可用而 Playwright Chromium 不存在
- **THEN** 可解析的报告具有 `status: "ok"`、`chromium: false`、`browser.available: true` 和 `browser.channel: "msedge"`，无浏览器安装建议，退出码为 0

#### Scenario: An expected diagnostic error prevents completion
- **WHEN** `doctor --json` 遇到多个评审数据目录的歧义或用户指定的设计目录清单无效
- **THEN** 输出可解析且 `status` 为 `error` 的 JSON，包含具体失败原因及与原因对应的建议，退出码为 1；没有运行的检查标注为未检查

#### Scenario: Existing JSON automation migrates
- **WHEN** 原先直接解析默认 doctor JSON 的脚本升级到新的输出契约
- **THEN** 文档明确要求调用方增加 `--json`，并说明 `browserInstall` 不再是无条件存在的字段，不能宣称默认格式完全向后兼容

### Requirement: Opt-in detailed doctor diagnostics
`doctor --verbose` SHALL 在文本摘要之后提供标注清晰的详细诊断，包括浏览器尝试顺序、未选用候选的原因和最终所选候选。候选级失败 MUST 不被误标为整体失败。`--json` 与 `--verbose` 同时指定时 MUST 保持纯 JSON 输出，并保留完整诊断，不追加文本。

#### Scenario: Inspect successful fallback
- **WHEN** 自动发现 Chrome 失败后成功使用 Edge，用户运行 `doctor --verbose`
- **THEN** 首先显示整体成功和所选 Edge，再将 Chrome 失败标记为未选用候选的诊断信息，而非当前必须修复的错误

#### Scenario: JSON takes precedence over verbose text
- **WHEN** 用户同时指定 `doctor --json --verbose`
- **THEN** 标准输出仍能整体解析为单个 JSON 对象，其中保留诊断依据，不出现额外的文本报告
