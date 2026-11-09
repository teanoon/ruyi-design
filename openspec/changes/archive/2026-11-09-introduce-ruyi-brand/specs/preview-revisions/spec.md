## ADDED Requirements

### Requirement: Non-destructive branded data discovery
新项目默认评审数据目录 SHALL 为 `.ruyi-design/`。存在唯一的既有 `.uxai-review/` 或 `.ruyi-uxai/` 且没有其他候选时，系统 SHALL 原地复用旧目录；显式 dataRoot SHALL 优先。`.ruyi-design/`、`.ruyi-uxai/`、`.uxai-review/` 中任意多个候选目录同时存在且未指定 dataRoot 时 MUST 报告歧义，不能静默选择、合并或创建另一套数据。

#### Scenario: Open an existing review after rebranding
- **WHEN** 项目仅存在有效的 `.uxai-review/` 或 `.ruyi-uxai/` 且通过新命令启动
- **THEN** 系统复用既有数据库与快照，保留会话、评论及当前版本身份，不重建初始快照或改写版本 ID

#### Scenario: Conflicting data directories
- **WHEN** 任意多个默认候选目录存在且未显式选择 dataRoot
- **THEN** 启动报告候选目录的歧义并要求明确选择，原有文件及进程锁语义不变

#### Scenario: Start a fresh project
- **WHEN** 项目没有旧数据目录且未传入 dataRoot
- **THEN** 系统在 `.ruyi-design/` 初始化本地数据，并与设计资产目录分离

### Requirement: Legacy prototype and revision continuity
品牌升级 SHALL 保留历史快照、原评论锚点、归档、处理结果及原版本对照；新桥接 SHALL 优先使用 `window.ruyiDesignReviewState`，在其不存在时依次兼容 `window.ruyiUxaiReviewState`、`window.uxaiReviewState` 的恢复契约。读取旧快照 MUST 不要求修改或重新发布其中的源文件。

#### Scenario: Restore an old prototype
- **WHEN** 旧设计稿仅声明 `window.uxaiReviewState` 并通过如意设计发布或查看
- **THEN** 可序列化状态的捕获与恢复继续有效，多个接口同时声明时仅使用优先级最高的接口且只调用一次

#### Scenario: Inspect an archived deletion comment
- **WHEN** 品牌升级后用户查看已归档评论的原版本或删除标记
- **THEN** 原版本和删除位置记录保持可读，当前发布指针及评论状态不因查看而改变
