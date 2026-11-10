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
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.GITHUB_REPOSITORY !== "teanoon/ruyi-design" || process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Dispatch this workflow from teanoon/ruyi-design main");
    const sha = releaseRef(process.env.RELEASE_REF, process.env.RELEASE_VERSION);
    await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
    console.log(`Approved release commit: ${sha}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
