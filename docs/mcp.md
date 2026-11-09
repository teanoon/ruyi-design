# MCP and Codex

From the consumer project, add this to the appropriate Codex `config.toml`:

```toml
[mcp_servers.ruyi_design]
command = "npx"
args = ["--no-install", "ruyi-design", "mcp"]
cwd = "/absolute/path/to/consumer-project"
tool_timeout_sec = 120
```

Use the locally installed package. The CLI itself does not infer the reviewed project from cwd: call `ruyi_design_start_review` with explicit absolute `projectRoot` and `designRoot`. No model API key or cloud service is required by this package.

Tools:

| Tool                 | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| ruyi_design_start_review         | Open project, snapshot current assets, start local workbench and preview listeners   |
| ruyi_design_get_review_context   | Read catalog, active revision, comments, batches and activity                        |
| ruyi_design_prepare_update       | On explicit user request, freeze saved pending comments using idempotencyKey and optional commentIds |
| ruyi_design_claim_batch          | Claim earliest queued batch using owner and idempotencyKey                           |
| ruyi_design_get_feedback_context | Read immutable batch item plus current thread                                        |
| ruyi_design_update_feedback      | Renew, reply, ask clarification, record modified/unaddressed scope, or release       |
| ruyi_design_publish_revision     | Validate and atomically publish using lease, idempotencyKey and expectedBaseRevision |
| ruyi_design_set_feedback_location | After a published deletion, record a surviving parent container without changing the original target |
| ruyi_design_end_review           | Stop listeners, retaining review data                              |

Read `ruyi-design://guides/review`, `ruyi-design://schemas/manifest`, and `ruyi-design://templates/manifest` through MCP resources. The package contains the same Skill used by explicit Codex setup. A generic Resource read is not native Skill activation. MCP Skills extension support is not required for this version.

`ruyi_design_start_review` accepts optional `host`, `port`, `previewPort`, `publicBaseUrl`, `previewBaseUrl`, and `dataRoot`. Defaults use loopback and available ports. For WSL/container forwarding, configure both base URLs and both port mappings explicitly. An explicit occupied port fails rather than silently changing. The workbench and prototype must have different origins.

Opening review only starts the site and returns its URL. End that agent turn; do not monitor comments. The browser saves comments immediately. Saving and `ruyi_design_get_review_context` never prepare or claim a batch.

When the user says comments are ready and asks for updates: read context → `ruyi_design_prepare_update` → `ruyi_design_claim_batch` → read fixed inputs → edit → record each item → publish → report and end the turn. `ruyi_design_prepare_update` requires `sessionId` and `idempotencyKey`; optional `commentIds` limits the snapshot. Reuse the same key after a transport retry so later comments are not accidentally included. Empty pending input returns `empty_batch`. Recover earlier queued batches first; a valid processing lease owned by another worker is a conflict. New comments remain for the next explicit request.

Leases last five minutes and renew through `ruyi_design_update_feedback(action="renew")`. Result scope is instance, component, or token. Only the browser user confirms resolution. For ambiguity, reply with `needs_clarification` and release the batch. The user replies, reopens the comment as pending, and asks the agent to update again. On interruption, reload context and reclaim expired work. There is no `wait_for_feedback` tool, browser batch submission endpoint, hook, or automatic agent wake-up.

## Port-selecting gateway

For `https://design.dev.test:34000/?port=4173`, start with `host: "0.0.0.0"`, `port: 4173`, `previewPort: 4174`, and `publicBaseUrl: "https://design.dev.test:34000/?port=4173"`. Omit `previewBaseUrl` to enable single-entry gateway mode. The returned URL retains `port`, `session` and the credential fragment. The gateway's local development CA must be trusted by the browser.

Only the workspace port is exposed through the gateway. Preview assets are served under `/_preview/` through that port, with explicit routing on HTML, CSS, module imports and common script navigation URLs. Management requests accept the configured public origin and the actual local upstream origin, including the gateway's Host/Origin rewrite. This does not trust arbitrary forwarded headers.

Prototype frames use an opaque sandbox in this mode: scripts cannot access the parent document or management credential. Public assets allow the frame's `null` origin for module loading; the authenticated API continues to reject it. Style publications use iframe restoration instead of history-based in-place updates. Internal candidate validation uses the local preview listener, so it does not depend on the gateway or development TLS certificate.

## Direct requests in conversation

When the user explicitly asks for a design change in chat, read current context, edit the repository and call the existing `ruyi_design_publish_revision` with `sessionId`, `source: "conversation"`, `request` (the actual user request), `idempotencyKey` and `expectedBaseRevision`. Omit batchId/leaseToken. The service validates all entries, records source/request/base revision and publishes in the same session. Do not fabricate comments, create a second session or redirect review to a separate static path. Saved comments and archived results stay unchanged; use the feedback workflow when the user requests changes from saved comments.

Queued/processing feedback blocks conversation publication, including feedback queued while validation is running. Finish or release that work first. Failed validation preserves the current version. Retries must reuse the same key, request and base revision; a new request requires a new key. Tool count remains nine.
