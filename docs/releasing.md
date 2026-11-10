# Releasing the npm package

This process publishes `@littlehobby/ruyi-design` to npmjs. Design publication through `ruyi_design_publish_revision` is a separate local preview operation.

Use Node 24+, npm 11.5.1+ (the workflow pins npm 11.17.0 for upload), Git and `tar`. Install dependencies with `npm ci --ignore-scripts`. Browser tests require an installed Playwright Chromium; on Linux CI use `npx --no-install playwright install --with-deps chromium`. Consumer runtime browser discovery does not download anything. Set browser selection in the MCP environment as described in [Getting started](getting-started.md).

## Prepare a committed version

Choose the version deliberately; the scripts never increment it. Use `npm version <version> --no-git-tag-version` to update package.json and package-lock.json together, review and commit the changes. The working tree must be completely clean, including untracked files. Stable versions use `latest`; prereleases default to `next` and may use another non-latest tag. Existing npm versions cannot be overwritten.

```bash
npm run release:prepare -- --version 0.1.0 --tag latest
```

Preparation checks the exact Git commit, package/lock identity, repository, public registry/access and unchanged `UNLICENSED` license. A read-only npmjs lookup rejects duplicate versions and fails on network/permission errors; only HTTP 404 means the package is absent. It runs typecheck, unit/release tests, browser/MCP workflow, conversation, gateway and discovery regressions. It then builds through `pack:local`/`prepack`, installs that exact archive in a temporary project without dev dependencies, exercises CLI/skill/MCP/browser behavior and runs:

```bash
npm publish /absolute/path/to/dist/littlehobby-ruyi-design-0.1.0.tgz --dry-run --ignore-scripts --access public --registry=https://registry.npmjs.org/ --tag latest
```

No upload occurs. A dry-run checks the archive and publication options; it does not establish account permissions, license approval or OIDC trust. The resulting `dist/release-0.1.0.json` records Git SHA, package name/version, tag, public file list, SHA-512/integrity and acceptance results. Archives and release manifests are excluded from the package. No credentials or absolute local paths are recorded in the manifest.

You can repeat consumer acceptance without rebuilding:

```bash
node tests/package/install.mjs /absolute/path/to/dist/littlehobby-ruyi-design-0.1.0.tgz
```

Keep the manifest and archive together. Any archive change requires preparation/acceptance again. Upload verifies the current clean checkout matches the manifest commit, the explicit version matches, the accepted bytes and file list are unchanged, all checks passed and the version is still unpublished. It disables lifecycle scripts so npm does not silently rebuild the archive. After upload it checks the remote name, version, dist-tag and `dist.integrity`. A failed post-upload check requires inspection of registry state; do not blindly retry or choose another version/tag.

## Manual first publication

Before uploading, the maintainer must confirm public distribution under the current `UNLICENSED` license is intended. This workflow does not select or grant a new license. Confirm control of the `@littlehobby` scope and write permission for this package, and configure npm account 2FA. Log in interactively using `npm login --registry=https://registry.npmjs.org/`; check the account with `npm whoami --registry=https://registry.npmjs.org/`. npm handles authentication/2FA; do not commit credentials or pass secrets through release manifests.

After reviewing the prepared commit, file list and digest, explicitly upload:

```bash
npm run release:publish -- --manifest dist/release-0.1.0.json --confirm-license --confirm-scope --confirm-version 0.1.0
```

The confirmation flags attest that the operator has checked those prerequisites; they do not themselves grant scope rights. The first package is created by this manual maintainer action. Actual npm publication is outside implementation/testing of this repository change.

## Subsequent GitHub OIDC publication

Configure these external prerequisites as maintainer actions:

1. Create the first npm package manually and confirm scope access and license intent.
2. In `teanoon/ruyi-design`, create a GitHub environment named `npmjs`, add required reviewers and restrict deployment branches to `main`. Protect main and release tags.
3. In the npm package's Trusted Publisher settings, select GitHub Actions: owner `teanoon`, repository `ruyi-design`, workflow filename `publish.yml`, environment `npmjs`. These names are case-sensitive. The workflow must already exist on main. Check npm's current expiry rules when configuring a new trust relationship.
4. Use GitHub-hosted Ubuntu runners. Trusted publishing currently requires npm 11.5.1+ and Node 22.14+; this repository uses Node 24 and npm 11.17.0. The prepare job explicitly installs the validation browser. No npm login token is configured for CI.

Dispatch **Publish npm package** from the main branch, enter the exact version, `main`, a full main-reachable commit SHA or matching `vVERSION` tag, and a dist-tag. Confirm public distribution and scope permission in the dispatch input. Ordinary push/PR events never publish. The trusted main checkout resolves the target, checks main ancestry and package version before executing target code. A PR ref or unrelated commit is rejected.

Preparation uploads the accepted tarball and manifest as a single run artifact named by the resolved SHA. The upload job checks out that same SHA, downloads the artifact and uses protected `npmjs` approval plus `id-token: write`/`contents: read`. It does not rebuild or install project dependencies. The upload uses an empty npm user configuration and no npm token; missing trust fails instead of silently switching authentication. Review the preparation logs, SHA and manifest digest before approving the environment deployment.

External npm/GitHub settings are not created by scripts or by local tests. Until first publication, trust and environment protection are configured, local preparation and dry-run remain available but real CI upload is not ready.

References checked during implementation: [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype).
