import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMetadata, registry, packageName, assertUnpublished, cleanCommit, command, artifactInfo, verifyArtifact, publish, publishArguments, verifyRemote, prepare } from "../../scripts/release.mjs";
import { releaseRef } from "../../scripts/release-ref.mjs";

const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
const data = (versions = {}, tags = {}) => ({ name: packageName, versions, "dist-tags": tags });
const response = (status, value) => async () => ({ status, ok: status === 200, json: async () => value });
test("metadata validates identity, lock, version, tag, registry and license", () => {
  assert.equal(validateMetadata(pkg, lock), "latest");
  for (const [p, l, version, tag] of [
    [{ ...pkg, name: "other" }, lock],
    [pkg, { ...lock, version: "2.0.0" }],
    [pkg, { ...lock, packages: { "": { ...lock.packages[""], version: "2.0.0" } } }],
    [pkg, lock, "2.0.0"], [pkg, lock, pkg.version, "next"], [pkg, lock, pkg.version, "--tag"],
    [{ ...pkg, license: "MIT" }, lock], [{ ...pkg, publishConfig: {} }, lock],
  ]) assert.throws(() => validateMetadata(p, l, version, tag));
  const pre = { ...pkg, version: "0.2.0-beta.1" };
  const preLock = { ...lock, version: pre.version, packages: { "": { ...lock.packages[""], version: pre.version } } };
  assert.equal(validateMetadata(pre, preLock), "next");
  assert.throws(() => validateMetadata(pre, preLock, pre.version, "latest"));
});
test("only a registry 404 or an absent version permits preparation", async () => {
  await assertUnpublished(pkg.version, response(404));
  await assertUnpublished(pkg.version, response(200, data()));
  await assert.rejects(assertUnpublished(pkg.version, response(200, data({ [pkg.version]: {} }))), /already exists/);
  for (const status of [401, 403, 500]) await assert.rejects(assertUnpublished(pkg.version, response(status)), /Registry check failed/);
  await assert.rejects(assertUnpublished(pkg.version, response(200, {})), /Malformed/);
  await assert.rejects(assertUnpublished(pkg.version, async () => { throw new Error("network failure"); }), /network failure/);
});
test("dirty or untracked source fails before any acceptance or upload", async () => {
  assert.throws(() => cleanCommit(() => "?? unexpected"), /clean committed/);
  assert.equal(cleanCommit((_c, args) => args[0] === "status" ? "" : "a".repeat(40)), "a".repeat(40));
  await assert.rejects(prepare({ run: () => " M source" }), /clean committed/);
});
test("release refs exclude PRs, injection, mismatched tags and commits outside main", () => {
  const sha = "a".repeat(40), calls = [];
  const run = (_c, args) => { calls.push(args); return args[0] === "show" ? JSON.stringify(pkg) : args[0] === "rev-parse" ? sha : ""; };
  for (const ref of ["main", "refs/heads/main", sha, `v${pkg.version}`]) assert.equal(releaseRef(ref, pkg.version, run), sha);
  assert(calls.some(args => args[0] === "merge-base" && args.at(-1) === "refs/remotes/origin/main"));
  for (const ref of ["refs/pull/1/head", "--help", "$(touch file)", "v99.0.0", "feature"]) assert.throws(() => releaseRef(ref, pkg.version, run));
  assert.throws(() => releaseRef("main", "99.0.0", run), /does not match/);
  assert.throws(() => releaseRef(sha, pkg.version, (_c, args) => { if (args[0] === "merge-base") throw new Error("not ancestor"); return sha; }), /not ancestor/);
});

async function fixture(runTest) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-release-fixture-"));
  try {
    await mkdir(path.join(root, "dist")); await mkdir(path.join(root, "package"));
    await writeFile(path.join(root, "package.json"), JSON.stringify(pkg));
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify(lock));
    await writeFile(path.join(root, "package/package.json"), JSON.stringify(pkg));
    const tarball = path.join(root, "dist/fixture.tgz");
    command("tar", ["-czf", tarball, "package"], { cwd: root, capture: true });
    const { pkg: _p, ...info } = await artifactInfo(tarball);
    const manifest = { schemaVersion: 1, commit: "a".repeat(40), ...info, tarball: "fixture.tgz", registry, access: "public", tag: "latest", checks: Object.fromEntries(["typecheck", "unit", "release", "browser", "conversation", "gateway", "discovery", "install", "dryRun"].map(k => [k, true])) };
    const manifestPath = path.join(root, "dist/release.json");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await runTest({ root, tarball, manifest, manifestPath });
  } finally { await rm(root, { recursive: true, force: true }); }
}
test("artifact changes, corruption, omitted acceptance and path traversal fail verification", () => fixture(async ({ root, tarball, manifest }) => {
  assert.equal(await verifyArtifact(manifest, root), tarball);
  for (const change of [{ sha512: "different" }, { files: [] }, { version: "2.0.0" }, { checks: {} }, { tarball: "../fixture.tgz" }, { registry: "https://other.test/" }])
    await assert.rejects(verifyArtifact({ ...manifest, ...change }, root));
  await writeFile(tarball, "corrupt bytes");
  await assert.rejects(verifyArtifact(manifest, root));
}));
test("publication gates permissions, version, commit, conflict; uploads accepted bytes without lifecycle rebuild", () => fixture(async ({ root, tarball, manifest, manifestPath }) => {
  const uploads = [];
  const run = (file, args, options) => {
    if (file === "git") return args[0] === "status" ? "" : manifest.commit;
    if (file === "npm") { uploads.push(args); return ""; }
    return command(file, args, options);
  };
  const opts = { root, manifestPath, confirmLicense: true, confirmScope: true, confirmVersion: pkg.version, run, env: {} };
  await assert.rejects(publish({ ...opts, confirmLicense: false }), /confirm-license/);
  await assert.rejects(publish({ ...opts, confirmScope: false }), /confirm-scope/);
  await assert.rejects(publish({ ...opts, confirmVersion: "9.0.0" }), /version/);
  await assert.rejects(publish({ ...opts, env: { GITHUB_ACTIONS: "true" } }), /OIDC/);
  await assert.rejects(publish({ ...opts, env: { GITHUB_ACTIONS: "true", ACTIONS_ID_TOKEN_REQUEST_URL: "fixture", NPM_TOKEN: "fixture" } }), /token fallback/);
  await assert.rejects(publish({ ...opts, run: (file, args, options) => file === "git" ? args[0] === "status" ? "" : "b".repeat(40) : run(file, args, options) }), /commit/);
  await assert.rejects(publish({ ...opts, fetcher: response(200, data({ [pkg.version]: {} })) }), /already exists/);
  await assert.rejects(publish({ ...opts, fetcher: response(503) }), /Registry/);
  assert.equal(uploads.length, 0);
  let reads = 0;
  const remote = data({ [pkg.version]: { name: pkg.name, version: pkg.version, dist: { integrity: manifest.integrity } } }, { latest: pkg.version });
  await publish({ ...opts, fetcher: async () => (++reads === 1 ? response(404)() : response(200, remote)()) });
  assert.deepEqual(uploads, [publishArguments(tarball, "latest")]);
  assert(uploads[0].includes("--ignore-scripts"));
  assert(!uploads[0].includes("--dry-run"));
  // Simulated npm failure must not proceed to remote success.
  let checks = 0;
  await assert.rejects(publish({ ...opts, fetcher: async () => { checks++; return response(404)(); }, run: (file, args, options) => { if (file === "npm") throw new Error("upload failed"); return run(file, args, options); } }), /upload failed/);
  assert.equal(checks, 1);
}));
test("upload fails if archive is replaced during registry preflight", () => fixture(async ({ root, tarball, manifestPath, manifest }) => {
  let uploaded = false;
  await assert.rejects(publish({ root, manifestPath, confirmLicense: true, confirmScope: true, confirmVersion: pkg.version, env: {},
    run: (file, args, options) => { if (file === "git") return args[0] === "status" ? "" : manifest.commit; if (file === "npm") { uploaded = true; return ""; } return command(file, args, options); },
    fetcher: async () => { await writeFile(tarball, "replaced"); return response(404)(); },
  }));
  assert.equal(uploaded, false);
}));
test("remote verification rejects wrong integrity, version, name or dist-tag", () => fixture(async ({ manifest }) => {
  const version = { name: pkg.name, version: pkg.version, dist: { integrity: manifest.integrity } };
  await verifyRemote(manifest, response(200, data({ [pkg.version]: version }, { latest: pkg.version })));
  for (const change of [{ name: "wrong" }, { version: "wrong" }, { dist: { integrity: "wrong" } }])
    await assert.rejects(verifyRemote(manifest, response(200, data({ [pkg.version]: { ...version, ...change } }, { latest: pkg.version }))), /does not match/);
  await assert.rejects(verifyRemote(manifest, response(200, data({ [pkg.version]: version }, { latest: "wrong" }))), /does not match/);
}));
