# Validation · 2026-11-11

- `npm run typecheck`: passed.
- `npm test`: 67 tests passed in 10 files. Includes shared version/identity validation, doctor text/JSON version on success and failure, authenticated HTTP runtime parity, setup customization/symlink protection, and existing queued/processing follow-up preservation tests.
- `npm run build`: passed; workspace and bridge assets remain unchanged.
- `npm run test:release`: 21/21 passed. Registry interactions and npm uploads in these tests are simulated; no actual publication occurred.
- `node tests/integration/brand-mcp.mjs`: passed; actual stdio handshake version matches package metadata, all nine tools and three resources remain available, guide Resource equals the packaged skill and legacy names are rejected.
- `node tests/integration/doctor-output.mjs`: passed; redirected text contains local package/version, JSON/verbose remain compatible, expected failures return exit code 1 without launching a browser.
- `node tests/integration/runtime-diagnostics.mjs`: passed in a disposable installation and unrelated consumer cwd. MCP start/context and authenticated HTTP return identical runtime. Repeated reads and closing/reopening a review preserve the same identity. A new MCP process changes instanceId while retaining sessionId, comments and revision. Changing the disposable installation's package version does not change the old process's runtime; a separate doctor sees the updated local version, and a new MCP loads it. Test metadata is restored afterward.
- `npm run test:comments`: passed; existing browser scenarios include follow-up replies automatically reopening archived comments, preserved history, independent element identity, cancellation, multiple comments and stable active/archive tabs.
- `npm run test:package -- --skip-browser-checks`: passed; final local tarball has 76 public files. The same runtime restart/upgrade and guide-parity acceptance runs against the actual installed package without consumer dev dependencies. Full installation browser checks were explicitly skipped; the targeted comment browser regression above passed separately.
- Packaged skill and repository-local `.agents/skills/ruyi-design-review/SKILL.md` match byte-for-byte. Existing consumers are not overwritten. A targeted search found no remaining normal-reply instruction requiring an extra reopen click in current skill/MCP guidance; manual reopen remains documented as an independent action.
- `openspec validate improve-runtime-diagnostics-and-review-guidance --strict` and `git diff --check`: passed.

Local tarball: `dist/littlehobby-ruyi-design-0.3.0.tgz` (ignored artifact).

SHA-512: `e6f1167e325aac600ac12814a67f9de18230a8fdca0558f8a7f4fd75fecc87b6b387d5893d5a4793f7ff9a9a35798738fce85b46e8d4a2b1b787aeaa2b0bbbf1`.

Package version and lockfile remain unchanged. Review storage and the feedback state machine are unchanged; runtime is composed only in service responses. No current review session was restarted or republished, no external client configuration was changed, and no Git commit, push, tag or npm release was performed. Main-spec synchronization and archive remain separate closeout operations.

## Closeout and 0.3.1 verification

The user subsequently authorized spec synchronization, archive, version bump, commit and a local tag. Two added requirements and one modified requirement were synced to package-and-mcp; all prior scenarios were retained. All seven main specs passed strict validation, the change passed strict validation, and all ten tasks were complete before archiving to `2026-11-11-improve-runtime-diagnostics-and-review-guidance`.

Package and lock root versions were upgraded together from 0.3.0 to 0.3.1. Re-ran `npm run test:release` (21 passed), `npm run build`, `node tests/integration/doctor-output.mjs` and `npm run test:package -- --skip-browser-checks` (76 public files); all passed for 0.3.1. The install test includes actual MCP version, HTTP/runtime parity, cross-process restart and local-doctor distinction checks. Prior implementation validation results above remain historical.

Final local 0.3.1 tarball SHA-512: `42877067c13da8db932178450f9afd3f95f6ccb15cd11720a9a42c021369c557eb20cb164c6f44c79c9c6d5409b6a3d075fa0764c919523f314b32e019c9bc2c`.

No remote push, GitHub workflow dispatch or npm upload was performed during closeout. The local annotated tag is `v0.3.1`; pushing that tag later is the separate publish trigger.
