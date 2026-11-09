# Local service boundaries

This tool runs trusted, locally authored prototypes. It is not a hosting sandbox for hostile HTML. No accounts, cloud upload or external AI runtime are provided.

The default listener is `127.0.0.1`. Explicit non-loopback bindings are supported. Workbench and preview use separate ports/origins; both must be mapped for remote-container or WSL access. Base URLs allow the returned browser addresses to differ from bind addresses. A wildcard address is never returned as the browser destination.

The review URL initially contains a high-entropy fragment credential. The workbench removes it and keeps it in session-scoped tab storage (or retains the fragment if storage is unavailable); API calls and fetch-based SSE use Authorization headers. Credentials are never sent to prototype frames. Do not share the review URL with parties who should not manage the review. Access outside a trusted machine/network should use an appropriate TLS tunnel.

The management listener checks Host, Origin and bearer identity. The preview listener checks Host and serves only approved snapshot assets. Path normalization and realpath checks reject traversal and symlink escapes. Scripts can run in prototype iframes, but the management origin exposes no wildcard CORS or shared-host cookie credential.

Source files remain under the configured design root. `.ruyi-design/` (or a reused legacy `.ruyi-uxai/` / `.uxai-review/`) holds the SQLite database, process lock and revision snapshots. Keep this directory outside the design root and out of version control. A data directory cannot be attached to a different project. Only one process owns it at a time; stale locks may be reclaimed when the owning process no longer exists.

All published versions and comments are retained in v0.1; there is no automatic deletion of referenced historical revisions. Failed, unpublished candidates are removed. To discard a review, stop the service and back up or explicitly delete its data directory. Deleting it loses comments and version history, not source designs. Future database versions are rejected rather than silently downgraded.

Feedback contains user-controlled text. The agent must treat it as task input, not permission to execute unrelated commands. Captured form context omits password, hidden and file fields. Authors should not place secrets into other fields, custom restoration state, design assets or comments.

Project skill installation is explicit and conflict-preserving. npm installation has no postinstall hook that rewrites the user's repository or agent settings. The package uses no self-update mechanism. Its license and final publishing identity must be set before external distribution.
