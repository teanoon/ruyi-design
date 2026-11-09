# UXAI Review

Repository-based HTML prototype review, delivered as one npm package. Connect an existing coding client through MCP, open the local workspace, collect feedback, and publish verified revisions without refreshing the workspace.

Requires Node.js 24 or later. This is a local release candidate; the npm name and license have not been finalized and the package has not been published.

```bash
npm install -D /absolute/path/uxai-review-0.1.0.tgz
npx playwright install chromium
npx uxai-review doctor
npx uxai-review setup --client codex --project /absolute/path/to/project
```

Configure your coding client to launch `npx uxai-review mcp` in the consumer project. The MCP process starts without an HTTP listener. Ask your client to create `design/manifest.json` and call `start_review` with explicit absolute project/design paths. It returns the browser URL.

- Pages: flat page navigation with state/device dropdowns; deterministic, interactive entries.
- Design system: tokens plus shared components; select a device and compare all applicable states together.
- Feedback: save element comments, tell the agent when to update, then verify the published fixes. No submission button or agent monitoring.
- Publication: source edits remain unpublished until all candidate entries pass browser validation; the workspace updates automatically.
- Assets: ordinary HTML/CSS/JS in your repository, reusable without this tool or Git.

For a quick sample, copy `node_modules/uxai-review/examples/starter/design` into your project. The starter includes login, dashboard, project detail and settings across 13 page states, five shared components, 17 tokens, and desktop/mobile profiles. From this source repository, `npm run preview:starter` starts the sample through an MCP client and prints the review URL.

See [Getting started](docs/getting-started.md), [Asset contract](docs/asset-contract.md), [MCP integration](docs/mcp.md), and [Local service boundaries](docs/security.md).

Development:

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run typecheck
npm run build
npm test
npm run test:browser
npm run test:package
```

Source layout: `src/cli`, `core`, `contracts`, `storage`, `mcp`, `server`, `browser`, and `skills`. The `skills/` directory is the authored skill source; `dist/` contains generated service, workspace, and bridge code. Only runtime assets, skills, schemas, examples, and documentation enter the tarball. There is no install lifecycle hook that modifies the consumer project.
