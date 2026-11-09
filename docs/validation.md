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

The final npm name/scope and license remain release decisions. The candidate uses `UNLICENSED` and has not been published.
