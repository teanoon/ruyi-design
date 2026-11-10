# Implementation validation — 2026-11-10

Completed the 14 implementation tasks without publishing to npmjs or pushing to GitHub.

## Environment and source

- Linux/WSL, Node 24.19.0, npm 11.17.0, Playwright 1.65.0.
- Real browser: existing Playwright Chromium 158.0.8127.18. PATH discovery and explicit executable selection used that installed binary in isolated instances.
- Windows/macOS paths, channel launch behavior, configuration errors, permissions, deduplication, late launch cleanup and discovery/probe timeouts were checked using injected fixtures. Real Chrome/Edge and native Windows/macOS were not available in this environment.
- Full preparation ran in a temporary clean Git checkout of the implementation, tests, package metadata, workflow and shipped documentation. Snapshot commit: `8fcc8800878bf6c6bd8a84dbd6f332e8ca35f00e`. Those files were byte-compared with the working repository.
- The working repository was not committed. Its preparation command correctly rejects the dirty tree. The copied manifest is evidence for the temporary validation snapshot; commit the actual repository and run preparation again before a real release.

## Checks passed

- `npm run typecheck` and `npm run build`.
- `npm test`: 45 tests across 7 files.
- `npm run test:release`: 8 tests, including metadata/version/lock checks, duplicate versions and registry errors, clean-tree enforcement, main-reachable ref selection, permission confirmations, OIDC/token refusal, digest corruption/replacement, upload failure and remote integrity/tag mismatches. Uploads in these tests used a mock command and mock registry.
- `npm run test:browser`: real stdio MCP, nine tools, feedback publication, CSS/JS restoration, failed candidate protection and history across restart.
- `npm run test:conversation`: explicit request, unchanged comments/batches, idempotency, failed candidate retry and restart.
- `npm run test:gateway`: rewritten Host/Origin, isolated prototype, navigation and real publication with internal candidate validation plus automatic workspace update. The test proxy now streams the event response instead of buffering it through inject.
- `npm run test:discovery`: automatic fallback, PATH browser without bundled browser, explicit executable, doctor success with legacy chromium=false, feedback/conversation publication success and atomic protection on browser absence, JS errors and missing resources.
- Explicit tarball acceptance: `node tests/package/install.mjs <absolute-tarball>`, no repack, independent consumer installation with no dev dependencies, CLI doctor, skill setup, full MCP/browser workflow and unchanged SHA-512.
- `node scripts/release.mjs prepare --version 0.1.0 --tag latest`: completed all checks, pack, same-file installation and npm dry-run. Only registry reads and dry-run were performed.
- Workflow YAML parsed with PyYAML and structurally checked: workflow_dispatch only; main and confirmation gate; trusted ref validation before target checkout; SHA-bound artifact handoff; publish needs prepare; npmjs environment; contents:read/id-token:write limited to upload; no rebuild in upload. Ref behavior is covered by release tests. Hosted Actions was not triggered and external environment/trust settings were not created.
- OpenSpec strict validation and whitespace checks of tracked and untracked changes passed.

## Accepted artifact

- Name/version: `@littlehobby/ruyi-design@0.1.0`
- Tarball: `dist/littlehobby-ruyi-design-0.1.0.tgz`
- Size: 117315 bytes; 68 public files.
- Integrity: `sha512-TOUNqc43AM0ZKFvf2beyshKbWVlvgvfRNM4GDVmBxMyA8detU1NWAbcL6AGVpYxTB8IA42C4Vd6l0tMDiuFLuw==`
- SHA-512: `4ce50da9ce3700cd19285bdfd9b7b2b2129b59596f82f7d134ce060d5981c4cc80f1d7ad53535601b70be80195a58c5307c200e360b855dea5d2d3038ae14bbb`
- Acceptance manifest: `dist/release-0.1.0.json` (ignored local artifact).
- Old tarball and release-manifest exclusion fixtures were present during packing and were absent from the accepted archive. Source, tests, client configuration and review state were absent as well.

Actual first publication, scope/license approval, npm login/2FA, Trusted Publisher configuration and GitHub environment protection remain maintainer actions described in `docs/releasing.md`. They were not performed or claimed by this validation.
