import { command } from "./release.mjs";
import { fileURLToPath } from "node:url";
import { appendFile } from "node:fs/promises";

// Run from the trusted main checkout before executing any target code.
export function releaseRef(ref, version, run = command) {
  const tag = `v${version}`;
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid version");
  const target = ref === "main" || ref === "refs/heads/main" ? "refs/remotes/origin/main"
    : ref === tag || ref === `refs/tags/${tag}` ? `refs/tags/${tag}`
    : /^[a-f0-9]{40}$/.test(ref) ? ref : undefined;
  if (!target) throw new Error("Ref must be main, a full commit SHA or the matching version tag");
  const sha = run("git", ["rev-parse", "--verify", `${target}^{commit}`], { capture: true });
  run("git", ["merge-base", "--is-ancestor", sha, "refs/remotes/origin/main"], { capture: true });
  const pkg = JSON.parse(run("git", ["show", `${sha}:package.json`], { capture: true }));
  if (pkg.version !== version) throw new Error("Requested version does not match target commit");
  return sha;
}
export function releaseTarget(env, run = command) {
  if (env.GITHUB_REPOSITORY !== "teanoon/ruyi-design") throw new Error("Release must run in teanoon/ruyi-design");
  let ref, version, tag;
  if (env.GITHUB_EVENT_NAME === "push") {
    if (!env.GITHUB_REF?.startsWith("refs/tags/v") || env.RELEASE_DELETED === "true")
      throw new Error("Only a non-deleted version tag push can publish");
    ref = env.GITHUB_REF;
    version = ref.slice("refs/tags/v".length);
    tag = version.includes("-") ? "next" : "latest";
    if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) throw new Error("Tag push requires the event SHA");
  } else if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    if (env.GITHUB_REF !== "refs/heads/main" || env.RELEASE_CONFIRMED !== "true")
      throw new Error("Manual release requires main and license/scope confirmation");
    ({ RELEASE_REF: ref, RELEASE_VERSION: version, RELEASE_TAG: tag } = env);
  } else throw new Error("Unsupported release event");
  const sha = releaseRef(ref, version, run);
  if (env.GITHUB_EVENT_NAME === "push") {
    const eventCommit = run("git", ["rev-parse", "--verify", `${env.GITHUB_SHA}^{commit}`], { capture: true });
    if (sha !== eventCommit) throw new Error("Version tag no longer matches the triggering event commit");
  }
  if (!/^[a-z][a-z0-9._-]*$/.test(tag ?? "") || (version.includes("-") ? tag === "latest" : tag !== "latest"))
    throw new Error("Stable versions require latest; prereleases require a non-latest dist-tag");
  return { sha, version, tag };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const target = releaseTarget(process.env);
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(target).map(([key, value]) => `${key}=${value}\n`).join(""));
    console.log(`Approved release: ${target.version} (${target.tag}) at ${target.sha}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
