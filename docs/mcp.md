# MCP and Codex

From the consumer project, add this to the appropriate Codex `config.toml`:

```toml
[mcp_servers.uxai_review]
command = "npx"
args = ["--no-install", "uxai-review", "mcp"]
cwd = "/absolute/path/to/consumer-project"
tool_timeout_sec = 120
```

Use the locally installed package. The CLI itself does not infer the reviewed project from cwd: call `start_review` with explicit absolute `projectRoot` and `designRoot`. No model API key or cloud service is required by this package.

Tools:

| Tool                 | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| start_review         | Open project, snapshot current assets, start local workbench and preview listeners   |
| get_review_context   | Read catalog, active revision, comments, batches and activity                        |
| prepare_update       | On explicit user request, freeze saved pending comments using idempotencyKey and optional commentIds |
| claim_batch          | Claim earliest queued batch using owner and idempotencyKey                           |
| get_feedback_context | Read immutable batch item plus current thread                                        |
| update_feedback      | Renew, reply, ask clarification, record modified/unaddressed scope, or release       |
| publish_revision     | Validate and atomically publish using lease, idempotencyKey and expectedBaseRevision |
| set_feedback_location | After a published deletion, record a surviving parent container without changing the original target |
| end_review           | Stop listeners, retaining review data                              |

Read `uxai://guides/prototype-review`, `uxai://schemas/manifest`, and `uxai://templates/manifest` through MCP resources. The package contains the same Skill used by explicit Codex setup. A generic Resource read is not native Skill activation. MCP Skills extension support is not required for this version.

`start_review` accepts optional `host`, `port`, `previewPort`, `publicBaseUrl`, `previewBaseUrl`, and `dataRoot`. Defaults use loopback and available ports. For WSL/container forwarding, configure both base URLs and both port mappings explicitly. An explicit occupied port fails rather than silently changing. The workbench and prototype must have different origins.

Opening review only starts the site and returns its URL. End that agent turn; do not monitor comments. The browser saves comments immediately. Saving and `get_review_context` never prepare or claim a batch.

When the user says comments are ready and asks for updates: read context → `prepare_update` → `claim_batch` → read fixed inputs → edit → record each item → publish → report and end the turn. `prepare_update` requires `sessionId` and `idempotencyKey`; optional `commentIds` limits the snapshot. Reuse the same key after a transport retry so later comments are not accidentally included. Empty pending input returns `empty_batch`. Recover earlier queued batches first; a valid processing lease owned by another worker is a conflict. New comments remain for the next explicit request.

Leases last five minutes and renew through `update_feedback(action="renew")`. Result scope is instance, component, or token. Only the browser user confirms resolution. For ambiguity, reply with `needs_clarification` and release the batch. The user replies, reopens the comment as pending, and asks the agent to update again. On interruption, reload context and reclaim expired work. There is no `wait_for_feedback` tool, browser batch submission endpoint, hook, or automatic agent wake-up.

## Port-selecting gateway

For `https://design.dev.test:34000/?port=4173`, start with `host: "0.0.0.0"`, `port: 4173`, `previewPort: 4174`, and `publicBaseUrl: "https://design.dev.test:34000/?port=4173"`. Omit `previewBaseUrl` to enable single-entry gateway mode. The returned URL retains `port`, `session` and the credential fragment. The gateway's local development CA must be trusted by the browser.

Only the workspace port is exposed through the gateway. Preview assets are served under `/_preview/` through that port, with explicit routing on HTML, CSS, module imports and common script navigation URLs. Management requests accept the configured public origin and the actual local upstream origin, including the gateway's Host/Origin rewrite. This does not trust arbitrary forwarded headers.

Prototype frames use an opaque sandbox in this mode: scripts cannot access the parent document or management credential. Public assets allow the frame's `null` origin for module loading; the authenticated API continues to reject it. Style publications use iframe restoration instead of history-based in-place updates. Internal candidate validation uses the local preview listener, so it does not depend on the gateway or development TLS certificate.
