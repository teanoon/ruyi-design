import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

export const registry = "https://registry.npmjs.org/";
export const packageName = "@littlehobby/ruyi-design";
const coreChecks = ["typecheck", "unit", "release", "install", "dryRun"];
const browserChecks = ["browser", "conversation", "gateway", "discovery"];
export function command(file, args, { cwd = process.cwd(), capture = false } = {}) {
  const result = spawnSync(file, args, { cwd, encoding: "utf8", stdio: capture ? "pipe" : "inherit", timeout: 600000 });
  if (result.error || result.status !== 0) throw new Error(`${file} ${args[0]} failed (${result.status ?? result.error?.code})${capture ? `: ${result.stderr?.trim()}` : ""}`);
  return result.stdout?.trim();
}
export function validateMetadata(pkg, lock, version = pkg.version, tag = pkg.version.includes("-") ? "next" : "latest") {
  if (pkg.name !== packageName || lock.name !== pkg.name || lock.version !== pkg.version || lock.packages?.[""]?.name !== pkg.name || lock.packages?.[""]?.version !== pkg.version)
    throw new Error("Package and lock name/version must agree");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?$/.test(pkg.version) || version !== pkg.version)
    throw new Error("Expected version must match the package semantic version");
  if (!/^[a-z][a-z0-9._-]*$/.test(tag) || (pkg.version.includes("-") ? tag === "latest" : tag !== "latest"))
    throw new Error("Stable versions require latest; prereleases require a non-latest dist-tag");
  if (pkg.private || pkg.license !== "UNLICENSED" || pkg.publishConfig?.registry !== registry || pkg.publishConfig?.access !== "public" || pkg.repository?.url !== "git+https://github.com/teanoon/ruyi-design.git")
    throw new Error("Release metadata must retain UNLICENSED, public npmjs access and the project repository");
  return tag;
}
export async function registryPackage(fetcher = fetch) {
  const response = await fetcher(`${registry}${encodeURIComponent(packageName)}`, { signal: AbortSignal.timeout(15000), headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry check failed: HTTP ${response.status}`);
  const data = await response.json();
  if (data.name !== packageName || !data.versions || !data["dist-tags"]) throw new Error("Malformed registry response");
  return data;
}
export async function assertUnpublished(version, fetcher = fetch) {
  const data = await registryPackage(fetcher);
  if (data?.versions[version]) throw new Error(`Version ${version} already exists on npmjs`);
}
export function cleanCommit(run = command, cwd = process.cwd()) {
  if (run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, capture: true }))
    throw new Error("Release preparation requires a clean committed tree, including untracked files");
  return run("git", ["rev-parse", "HEAD"], { cwd, capture: true });
}
export function publishArguments(tarball, tag, dryRun = false) {
  return ["publish", tarball, "--ignore-scripts", "--access", "public", `--registry=${registry}`, "--tag", tag, ...(dryRun ? ["--dry-run"] : [])];
}
export async function artifactInfo(tarball, run = command) {
  const bytes = await readFile(tarball);
  const sha512 = createHash("sha512").update(bytes).digest();
  const files = run("tar", ["-tzf", tarball], { capture: true }).split("\n").filter(f => !f.endsWith("/"));
  for (const file of files) {
    if (!file.startsWith("package/") || file.split("/").includes("..") || /\.(tgz|db|sqlite(?:3)?)(?:-|$)/.test(file) || /^package\/(src|tests|openspec|node_modules|\.\w)/.test(file) || /^package\/dist\/release-.*\.json$/.test(file))
      throw new Error(`Unexpected package file: ${file}`);
  }
  const pkg = JSON.parse(run("tar", ["-xOzf", tarball, "package/package.json"], { capture: true }));
  return { name: pkg.name, version: pkg.version, sha512: sha512.toString("hex"), integrity: `sha512-${sha512.toString("base64")}`, files: files.map(f => f.slice(8)).sort(), pkg };
}
export async function verifyArtifact(manifest, root, run = command) {
  if (!manifest.tarball || path.basename(manifest.tarball) !== manifest.tarball || !manifest.tarball.endsWith(".tgz")) throw new Error("Invalid manifest tarball path");
  const tarball = path.join(root, "dist", manifest.tarball);
  const info = await artifactInfo(tarball, run);
  if (manifest.name !== packageName || info.name !== manifest.name || info.version !== manifest.version || info.sha512 !== manifest.sha512 || info.integrity !== manifest.integrity || JSON.stringify(info.files) !== JSON.stringify(manifest.files))
    throw new Error("Artifact identity, file list or digest changed; repeat acceptance");
  const profile = manifest.validationProfile ?? "full";
  if (manifest.registry !== registry || manifest.access !== "public" || manifest.schemaVersion !== 1 || !["full", "package"].includes(profile) || coreChecks.some(k => manifest.checks?.[k] !== true) || browserChecks.some(k => manifest.checks?.[k] !== (profile === "package" ? "skipped" : true)))
    throw new Error("Manifest has not passed all release checks");
  return tarball;
}
function verifyRemoteMetadata(manifest, data) {
  const version = data?.versions[manifest.version];
  if (version?.name !== manifest.name || version.version !== manifest.version || version.dist?.integrity !== manifest.integrity || data["dist-tags"][manifest.tag] !== manifest.version)
    throw new Error("Published name/version, dist-tag or integrity does not match; investigate registry state before retrying");
}
export async function verifyRemote(manifest, fetcher = fetch) {
  verifyRemoteMetadata(manifest, await registryPackage(fetcher));
}
export async function waitForRemote(manifest, { fetcher = fetch, timeoutMs = 15 * 60 * 1000, pollMs = 30000, sleep = delay, now = Date.now, log = console.log } = {}) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const data = await registryPackage(fetcher);
    if (data?.versions[manifest.version]) {
      verifyRemoteMetadata(manifest, data);
      return;
    }
    const remaining = deadline - now();
    if (remaining <= 0)
      throw new Error(`Upload was accepted but ${manifest.name}@${manifest.version} is not available yet. Do not upload it again; inspect npm processing status and verify the accepted artifact later.`);
    log(`Upload accepted; waiting for npm processing of ${manifest.name}@${manifest.version}. No additional upload will be attempted.`);
    await sleep(Math.min(pollMs, remaining));
  }
}
export async function prepare({ root = process.cwd(), version, tag, run = command, fetcher = fetch, browserChecks: includeBrowserChecks = true } = {}) {
  const commit = cleanCommit(run, root);
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  tag = validateMetadata(pkg, lock, version, tag);
  await assertUnpublished(pkg.version, fetcher);
  const checks = Object.fromEntries(browserChecks.map(check => [check, includeBrowserChecks ? false : "skipped"]));
  for (const [check, script] of [["typecheck", "typecheck"], ["unit", "test"], ["release", "test:release"], ["browser", "test:browser"], ["conversation", "test:conversation"], ["gateway", "test:gateway"], ["discovery", "test:discovery"]]) {
    if (!includeBrowserChecks && browserChecks.includes(check)) continue;
    // Browser scripts use the built runtime.
    if (check === "browser") run("npm", ["run", "build"], { cwd: root });
    run("npm", ["run", script], { cwd: root }); checks[check] = true;
  }
  await mkdir(path.join(root, "dist"), { recursive: true });
  run("npm", ["run", "pack:local"], { cwd: root });
  const filename = `littlehobby-ruyi-design-${pkg.version}.tgz`;
  const tarball = path.join(root, "dist", filename);
  const info = await artifactInfo(tarball, run);
  if (info.name !== pkg.name || info.version !== pkg.version) throw new Error("Packed identity mismatch");
  run(process.execPath, ["tests/package/install.mjs", tarball, ...(!includeBrowserChecks ? ["--skip-browser-checks"] : [])], { cwd: root }); checks.install = true;
  run("npm", publishArguments(tarball, tag, true), { cwd: root }); checks.dryRun = true;
  if (cleanCommit(run, root) !== commit || (await artifactInfo(tarball, run)).sha512 !== info.sha512) throw new Error("Source or archive changed during acceptance");
  const { pkg: _pkg, ...artifact } = info;
  const manifest = { schemaVersion: 1, commit, ...artifact, tarball: filename, registry, access: "public", tag, validationProfile: includeBrowserChecks ? "full" : "package", checks };
  const output = path.join(root, "dist", `release-${pkg.version}.json`);
  await writeFile(output, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Release prepared without upload: ${output}\n${info.integrity}`);
  return manifest;
}
export async function publish({ root = process.cwd(), manifestPath, confirmLicense, confirmScope, confirmVersion, run = command, fetcher = fetch, env = process.env, verificationOptions = {} } = {}) {
  if (!confirmLicense || !confirmScope || !confirmVersion) throw new Error("Publishing requires --confirm-license --confirm-scope --confirm-version <version>");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  validateMetadata(pkg, lock, confirmVersion, manifest.tag);
  if (manifest.version !== confirmVersion || manifest.commit !== cleanCommit(run, root)) throw new Error("Manifest version/commit must match the approved checkout");
  if (env.GITHUB_ACTIONS === "true" && (env.NODE_AUTH_TOKEN || env.NPM_TOKEN || !env.ACTIONS_ID_TOKEN_REQUEST_URL)) throw new Error("CI upload requires OIDC without npm token fallback");
  const tarball = await verifyArtifact(manifest, root, run);
  await assertUnpublished(manifest.version, fetcher);
  // Recheck immediately before upload, after the network preflight.
  await verifyArtifact(manifest, root, run);
  run("npm", publishArguments(tarball, manifest.tag), { cwd: root });
  await waitForRemote(manifest, { ...verificationOptions, fetcher });
  console.log(`Published and verified ${manifest.name}@${manifest.version} (${manifest.tag})`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { version: { type: "string" }, tag: { type: "string" }, manifest: { type: "string" }, "skip-browser-checks": { type: "boolean" }, "confirm-license": { type: "boolean" }, "confirm-scope": { type: "boolean" }, "confirm-version": { type: "string" } } });
    if (positionals.length !== 1) throw new Error("Use prepare or publish");
    if (positionals[0] === "prepare") await prepare({ version: values.version, tag: values.tag, browserChecks: !values["skip-browser-checks"] });
    else if (positionals[0] === "publish") await publish({ manifestPath: values.manifest, confirmLicense: values["confirm-license"], confirmScope: values["confirm-scope"], confirmVersion: values["confirm-version"] });
    else throw new Error("Use prepare or publish");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
