# Releasing the npm package

This process publishes `@littlehobby/ruyi-design` to npmjs. Design publication through `ruyi_design_publish_revision` is a separate local preview operation.

Use Node 24+, npm 11.5.1+ (the workflow pins npm 11.17.0 for upload), Git and `tar`. Install dependencies with `npm ci --ignore-scripts`. The GitHub package-release workflow does not install, discover or launch a browser. Optional local browser regressions require an installed Playwright Chromium. Consumer runtime browser selection is described in [Getting started](getting-started.md).

## Prepare a committed version

Choose the version deliberately; the scripts never increment it. Use `npm version <version> --no-git-tag-version` to update package.json and package-lock.json together, review and commit the changes. The working tree must be completely clean, including untracked files. Stable versions use `latest`; prereleases default to `next` and may use another non-latest tag. Existing npm versions cannot be overwritten.

```bash
npm run release:prepare -- --version 0.1.0 --tag latest
```

Preparation checks the exact Git commit, package/lock identity, repository, public registry/access and `Apache-2.0` license in both package and lock metadata. A read-only npmjs lookup rejects duplicate versions and fails on network/permission errors; only HTTP 404 means the package is absent. It runs typecheck, unit/release tests, browser/MCP workflow, conversation, gateway and discovery regressions. The packed artifact must contain the complete Apache-2.0 LICENSE and THIRD_PARTY_NOTICES.md, with matching license metadata. It then builds through `pack:local`/`prepack`, installs that exact archive in a temporary project without dev dependencies, exercises CLI/skill/MCP/browser behavior and runs:

```bash
npm publish /absolute/path/to/dist/littlehobby-ruyi-design-0.1.0.tgz --dry-run --ignore-scripts --access public --registry=https://registry.npmjs.org/ --tag latest
```

No upload occurs. A dry-run checks the archive and publication options; it does not establish account permissions, license approval or OIDC trust. The resulting `dist/release-0.1.0.json` records Git SHA, package name/version, tag, public file list, SHA-512/integrity and acceptance results. Archives and release manifests are excluded from the package. No credentials or absolute local paths are recorded in the manifest.

Local preparation defaults to the full browser-regression profile. The Actions workflow explicitly selects package-only acceptance:

```bash
npm run release:prepare -- --version 0.1.0 --tag latest --skip-browser-checks
```

This mode keeps typecheck, unit tests (including simulated browser-selection tests), release tests, build, file-boundary/digest checks, independent installation, CLI help, skill setup, stdio MCP handshake/tool/resource checks and npm dry-run. It does not call doctor or run browser, conversation, gateway or discovery integration suites. The manifest records `validationProfile: "package"` and marks those four checks as `"skipped"`; upload requires the core checks to pass and the declared profile to match. Full-profile and legacy full-validation manifests remain supported. Design revision publication in the product still performs its normal browser validation.

You can repeat consumer acceptance without rebuilding:

```bash
node tests/package/install.mjs /absolute/path/to/dist/littlehobby-ruyi-design-0.1.0.tgz
```

Add `--skip-browser-checks` to repeat only package/CLI/MCP/skill acceptance without doctor or a browser workflow. Omitting it retains the full installation test.

Keep the manifest and archive together. Any archive change requires preparation/acceptance again. Upload verifies the current clean checkout matches the manifest commit, the explicit version matches, the accepted bytes and file list are unchanged, all required checks for the declared validation profile passed and the version is still unpublished. It disables lifecycle scripts so npm does not silently rebuild the archive. After upload it waits up to 15 minutes, polling every 30 seconds for the version to become available after npm's publish-time scanning, then checks the remote name, version, dist-tag and `dist.integrity`. A missing package/version during that wait never causes another upload. A published metadata mismatch or registry error fails immediately. If processing times out, inspect registry state and continue read-only verification; do not rerun the publication or automatically choose another version/tag.

## Manual first publication

Before uploading, the maintainer must confirm public distribution under the current `Apache-2.0` license is intended. This workflow does not select or grant a new license. Confirm control of the `@littlehobby` scope and write permission for this package, and configure npm account 2FA. Log in interactively using `npm login --registry=https://registry.npmjs.org/`; check the account with `npm whoami --registry=https://registry.npmjs.org/`. npm handles authentication/2FA; do not commit credentials or pass secrets through release manifests.

After reviewing the prepared commit, file list and digest, explicitly upload:

```bash
npm run release:publish -- --manifest dist/release-0.1.0.json --confirm-license --confirm-scope --confirm-version 0.1.0
```

The confirmation flags attest that the operator has checked those prerequisites; they do not themselves grant scope rights. The first package is created by this manual maintainer action. Actual npm publication is outside implementation/testing of this repository change.

## Subsequent GitHub OIDC publication

Configure these external prerequisites as maintainer actions:

1. Create the first npm package manually and confirm scope access and license intent.
2. In `teanoon/ruyi-design`, create a GitHub environment named `npmjs`. Under deployment branches and tags, allow branch `main` for manual runs and tags matching `v*` for tag-triggered runs; allowing only main blocks tag deployments even when the tagged commit belongs to main. Protect main and release tags so only authorized maintainers can publish. Required reviewers are optional: configure them to approve every deployment, or omit that requirement for fully automatic tag publication.
3. In the npm package's Trusted Publisher settings, select GitHub Actions: owner `teanoon`, repository `ruyi-design`, workflow filename `publish.yml`, environment `npmjs`. Enable the allowed action for direct `npm publish`; stage-only trust does not authorize this workflow. These names are case-sensitive. The workflow must already exist on main. Check npm's current expiry rules when configuring a new trust relationship. Account-level setup may require a one-time browser/2FA confirmation; subsequent Actions publishes use OIDC instead of the maintainer's local npm login.
4. Use GitHub-hosted Ubuntu runners. Trusted publishing currently requires npm 11.5.1+ and Node 22.14+; this repository uses Node 24 and npm 11.17.0. The prepare job uses package-only acceptance and requires no browser installation. No npm login token is configured for CI.

### Publish by pushing a version tag

First commit the package.json and package-lock.json version change and push it to main. Once this workflow change is on main, tag the intended main commit and push that specific tag:

```bash
git switch main
git pull --ff-only origin main
# Confirm package.json and package-lock.json both contain 0.3.0.
git tag -a v0.3.0 -m "Release 0.3.0"
git push origin v0.3.0
```

Pushing `v0.3.0` selects version `0.3.0` and npm dist-tag `latest`. Prerelease tags such as `v0.4.0-beta.1` select `next`; use manual dispatch if a different prerelease channel is needed. Lightweight and annotated Git tags are both supported. Tags must match the package version, point to a commit reachable from origin/main and still resolve to the triggering event commit. Invalid/deleted tags, branch pushes and PR events do not publish. An already-published npm version fails preparation rather than being overwritten or silently republished.

Pushing a release tag is the maintainer's explicit authorization to distribute that version under the current Apache-2.0 license, with the maintainer responsible for package scope permission. This does not grant account permissions. Before pushing the tag, verify npm trust and the GitHub environment allow the intended deployment. The workflow keeps any configured environment approval; fully automatic publication requires no mandatory reviewer gate. No per-release npm browser confirmation or NPM_TOKEN is used.

The trusted main checkout resolves release inputs before target code is executed, then passes the resolved commit, version and dist-tag to preparation and publication. Ordinary pushes to main remain non-publishing. Do not move or reuse release tags; use a new version if another release is needed.

### Manual fallback

From main, open **Actions → Publish npm package → Run workflow**, enter the exact version, `main`, a full main-reachable commit SHA or matching `vVERSION` tag, and the npm dist-tag. Check the Apache-2.0/scope confirmation. Manual dispatch from a tag or another branch is rejected; the target ref may still be a matching version tag. It follows the same acceptance and environment gates as a tag push.

Preparation uploads the accepted tarball and manifest as a single run artifact named by the resolved SHA. The upload job checks out that same SHA, downloads the artifact and uses protected `npmjs` approval plus `id-token: write`/`contents: read`. It does not rebuild or install project dependencies. The upload uses an empty npm user configuration and no npm token; missing trust fails instead of silently switching authentication. Review the preparation logs, SHA and manifest digest before approving the environment deployment.

External npm/GitHub settings are not created by scripts or by local tests. Until first publication, trust and environment protection are configured, local preparation and dry-run remain available but real CI upload is not ready.

References checked during implementation: [GitHub push events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push), [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype).
