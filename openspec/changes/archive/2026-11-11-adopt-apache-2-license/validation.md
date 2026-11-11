# Validation · 2026-11-11

- `npm run typecheck`: passed.
- `npm test`: 65 tests passed in 9 files. The sandbox blocked a local listener on the first attempt; the suite passed with local-listener permissions.
- `npm run build`: passed, workspace and bridge built successfully.
- `npm run test:release`: 16 tests passed. Includes package/lock license consistency, old/incorrect license rejection, missing/modified/truncated LICENSE rejection, CRLF handling, missing third-party notices rejection, preservation of upstream Vite/Zod MIT text and existing publication/integrity gates. Registry reads and uploads in this suite are mocked; no real upload occurred.
- `npm run test:package -- --skip-browser-checks`: passed against the final tarball, 75 public files. LICENSE and THIRD_PARTY_NOTICES.md match the source before and after installation; Apache-2.0 metadata, installed CLI, MCP handshake, nine tools and skill setup passed without consumer dev dependencies. Browser checks were explicitly skipped for this licensing-only change.
- An in-memory Vite diagnostic build inspected actual emitted chunk module IDs: only Zod appears under node_modules, plus the Vite modulepreload virtual helper. Both MIT notices are shipped. The bridge closure contains project modules. Review scope is documented in `docs/licensing.md`.
- `cmp LICENSE /tmp/ruyi-apache-2.0.txt`: matched the downloaded Apache official text exactly. Future checks use the pinned normalized SHA-256 in the release script, not this temporary file.
- Package and lock versions remain 0.2.0. All non-root lock dependency entries are unchanged. The remaining UNLICENSED references in active tests are negative cases; `docs/validation.md` records the historical 0.1.0 candidate, and archived changes retain historical facts.
- `openspec validate adopt-apache-2-license --strict` and `git diff --check`: passed.

Final local tarball: `dist/littlehobby-ruyi-design-0.2.0.tgz` (ignored build artifact).

SHA-512: `710982ce9fda53387951b929067ea3c98983c0f40a4d3fc09c73d2f8f7c60ddc0521096d9a25ff74537df7d03585b0d55098e396a0393aff74e05c3cc9be79cd`.

No version bump, remote npm publication or registry metadata change was performed. The package-and-mcp delta was subsequently synced to the main spec during closeout, and all seven main specs passed strict validation before archive.
