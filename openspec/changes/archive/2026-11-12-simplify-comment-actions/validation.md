# Prototype validation · 2026-11-11

## Published candidate

- Session: `7edf66f6-24ff-4cfe-b3d5-e54bf82f8473` (existing product review session).
- Base revision: `6c0bfd72-fec4-4c32-972c-6c604b2cee24`.
- Candidate revision: `7d1ee1a1-2db4-4e99-81e6-c739d7b76a04`.
- Publication: `source=conversation`, request `开始实现`, key `simplify-comment-actions-prototype-2026-11-11-v1`.
- Current gateway base: `https://design-4173.dev.test:34000/?port=4173`. The gateway now requires the port in the hostname; the old `design.dev.test` form returned HTTP 400 with the new format instruction. Review listeners were rebound to the new base using the same persisted session and candidate revision. Do not record the credential fragment here.
- All 29 saved review comments and all 11 existing batches matched the pre-edit baseline exactly after publication and listener rebinding. No comments were fabricated, resolved or consumed.

## Checks

- `node --check design/pages/app.js` and `node --check design/components/ui.js`: passed.
- Isolated browser acceptance (`test-results/comment-design/check.mjs`, ignored): passed. Covers exact action lists and order at 1280px and 390px; no More/add-independent-comment/archive buttons; unique element discussion selection; read-only opening of archived feedback; reply reopening; cancellation preserving saved threads; active queued replies not changing processing status; original-version/return preserving an unsaved reply; return highlighting; keyboard confirmation; legacy duplicate display/default selection; explicit deleted-container return.
- All 78 declared page/state/device and component-example entries loaded without page JavaScript exceptions. Publication validation also passed all declared entries before switching the active revision.
- Actual gateway acceptance (`test-results/comment-design/live.mjs`, ignored): HTTP 200, actual published candidate controls present in the existing workspace, no page JavaScript errors.
- Desktop/mobile, reopened and original-view screenshots were visually inspected. Screenshots remain under ignored `test-results/comment-design/`, including `live-gateway.png`.
- `openspec validate simplify-comment-actions --strict` and `git diff --check`: passed.

## Approval checkpoint (historical; superseded by approval below)

Only design assets, their documentation and this change's records have changed. Actual `src/` runtime, shared runtime contracts and production tests have not been modified in this phase. Design-only simulations do not claim server-side uniqueness enforcement or real concurrent-request protection; those remain in the post-approval implementation tasks.

Tasks 1.1 and 1.2 are complete (2/12). Task 1.3 remains pending: the user must approve this specific candidate revision before runtime implementation. In accordance with `product-brand`'s Approved prototype before runtime implementation requirement, the previous design approval does not approve this new candidate.

## Design approval

User explicitly approved candidate `7d1ee1a1-2db4-4e99-81e6-c739d7b76a04` with “审核通过”. The approval applies to simplify-comment-actions and opens the runtime implementation stage. Original review records remain unchanged.

## Runtime implementation and acceptance

Implemented after the explicit candidate approval above. All 12 tasks are complete.

- Shared element identity and action derivation now drive runtime selection and card operations. Exact matching includes object/state/device/example, prefers stable review IDs and otherwise compares full selectors. Legacy duplicates remain intact; no data migration or history rewrite was performed.
- Duplicate creates are rejected transactionally with HTTP 409 `comment_exists` and the existing ID. Two-browser acceptance verifies the losing input remains available for an explicit reply conversion.
- New-comment deletion and `cancel_reopen` are distinct. Active queued/processing batches reject edits and lifecycle changes while accepting replies without altering the frozen batch input.
- Historical viewing uses the same canvas with a read-only banner. Native input changes are blocked; the right-panel unsaved reply survives new publication and return. Deleted-container return, unavailable entry warnings and restart persistence passed.
- Runtime desktop/mobile action cards were visually compared with the approved prototype. All applicable actions remain visible; narrow cards wrap without overflow or a More menu. Screenshots: `test-results/comment-runtime/review-1280.png` and `review-390.png` (ignored).
- `npm run typecheck`, `npm test` (75 tests in 12 files), and `npm run build`: passed.
- Browser regression: `test:comments`, `test:archive`, `test:editing`, `test:deleted`, `test:focus`, `test:navigation` (60 pages) and `test:design` (78 entries): passed. Supplemental `test:shortcuts` passed both direct cross-origin and opaque gateway flows; the non-streaming gateway fixture reloads after publication before historical comparison. Comments include the full status matrix, legacy selection, two-browser race, frozen queue, original-version input protection, publication during comparison, missing entry return and same-session restart.
- `npm run test:release`: 21/21 passed against isolated simulated registry fixtures; no real npm publication was performed.
- `npm run test:package -- --skip-browser-checks`: passed, 77 public files. CLI/MCP handshake, HTTP parity, stable runtime identity, same-session restart, frozen startup version and packaged skill/guide checks passed. Browser coverage was run separately above.
- Final local tarball: `dist/littlehobby-ruyi-design-0.3.1.tgz`; SHA-256 `e29564ec24212a9d1f59c2294220f4b8fe1e05eb5b7fddce7892fab5365703b4`.
- Source and installed repository skill mirrors match. Current user/MCP/skill instructions and the design checklist describe the approved behavior; older dated validation entries remain historical records.
- `git diff --check` and `openspec validate simplify-comment-actions --strict`: passed.

The existing connected MCP process was deliberately not restarted. Its loaded server code remains the earlier implementation; restart it to load the new backend behavior. No main-spec sync, archive, version bump, commit, tag, push or npm publish was performed in this implementation step. Existing live review comments and batches remain unchanged.

## Closeout · 2026-11-12

User requested synchronization, archiving, version increment and commit. Persisted the future closeout confirmation preference in root `AGENTS.md`.

- Synchronized both review-feedback and product-brand main specs, verified every added/modified requirement matches and removed requirements are absent; all seven main specs pass strict validation.
- All 12 tasks and all planning artifacts complete; archived to `openspec/changes/archive/2026-11-12-simplify-comment-actions` with no remaining active changes.
- Incremented package and lockfile versions from 0.3.1 to 0.3.2.
- Rechecked typecheck, 75 unit/HTTP tests, build, 21 release tests and the installed package at 0.3.2: all passed. Package has 77 public files; SHA-256 `41e11d7339ccf48e31349b1ee14eeb22af9e59970427baa3919d8c739a2437b0`.
- Prepared a local commit covering implementation, approved prototype, documentation, tests, synchronized specs, archive, version and project workflow preference. No tag, push or npm publication is part of this closeout. The connected MCP process remains unchanged and requires restart for new backend rules.
