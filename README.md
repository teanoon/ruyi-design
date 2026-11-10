# 如意设计 · Ruyi Design

Repository-based HTML prototype review, delivered as one npm package. Connect an existing coding client through MCP, open the local workspace, collect feedback, and publish verified revisions without refreshing the workspace.

Requires Node.js 24 or later. This is a local release candidate; the package has not been published; its license is UNLICENSED.

```bash
npm install -D /absolute/path/to/ruyi-design/dist/littlehobby-ruyi-design-0.1.0.tgz
npx playwright install chromium
npx ruyi-design doctor
npx ruyi-design setup --client codex --project /absolute/path/to/project
```

Configure your coding client to launch `npx ruyi-design mcp` in the consumer project. The MCP process starts without an HTTP listener. Ask your client to create `design/manifest.json` and call `ruyi_design_start_review` with explicit absolute project/design paths. It returns the browser URL.

- Pages: flat navigation, state/device dropdowns and keyboard shortcuts (C, ←/→, ↑/↓); deterministic, interactive entries.
- Design system: tokens plus shared components; select a device and compare all applicable states together.
- Feedback: save element comments, tell the agent when to update, then verify the published fixes. No submission button or agent monitoring.
- Publication: source edits remain unpublished until all candidate entries pass browser validation; the workspace updates automatically.
- Assets: ordinary HTML/CSS/JS in your repository, reusable without this tool or Git.

For a quick sample, copy `node_modules/@littlehobby/ruyi-design/examples/starter/design` into your project. The starter includes login, dashboard, project detail and settings across 13 page states, five shared components, 17 tokens, and desktop/mobile profiles. From this source repository, `npm run preview:starter` starts the sample through an MCP client and prints the review URL.

See [Getting started](docs/getting-started.md), [Asset contract](docs/asset-contract.md), [MCP integration](docs/mcp.md), and [Local service boundaries](docs/security.md).

Development:

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run typecheck
npm run build
npm run pack:local
npm test
npm run test:browser
npm run test:shortcuts
npm run test:package
```

Local release archives are written to `dist/` by `npm run pack:local` (builds first through `prepack`). The package excludes existing `.tgz` files from its contents.

Source layout: `src/cli`, `core`, `contracts`, `storage`, `mcp`, `server`, `browser`, and `skills`. The `skills/` directory is the authored skill source; `dist/` contains generated service, workspace, and bridge code. Only runtime assets, skills, schemas, examples, and documentation enter the tarball. There is no install lifecycle hook that modifies the consumer project.

小爱好出品 · By LittleHobby · 让设计，更合心意。

See [Brand guidelines](docs/brand-guidelines.md) and [Migration](docs/migration-to-ruyi-design.md) for naming and existing-project upgrades. The package name is reserved by project convention; no registry publication has been performed.

## 本产品设计评审

`design/` 是如意设计自身的交互设计稿，以工作区为核心，内含评论、归档和原版本查看，并提供设计系统及最终提交墙方印标志。运行 `npm run preview:design` 评审本产品；`preview:starter` 仅用于 Northstar 消费者 demo。两套评审独立保存历史，启动参数和网关说明位于源码仓库的 `design/README.md`；npm 包内可使用的示例见 [starter 说明](examples/starter/README.md)。
