import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { command } from "../../scripts/release.mjs";
import { releaseTarget } from "../../scripts/release-ref.mjs";

async function repository(version, check) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-release-target-"));
  const run = (file, args) => command(file, args, { cwd: root, capture: true });
  const git = (...args) => run("git", args);
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Release test");
    git("config", "user.email", "release-test@example.invalid");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ version }));
    git("add", "package.json"); git("commit", "-m", "fixture");
    const sha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", sha);
    const event = { GITHUB_REPOSITORY: "teanoon/ruyi-design", GITHUB_EVENT_NAME: "push", GITHUB_REF: `refs/tags/v${version}`, GITHUB_SHA: sha, RELEASE_DELETED: "false" };
    await check({ root, run, git, sha, event });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("tag release resolves lightweight and annotated tags to the pushed main commit", () => repository("0.3.0", async ({ git, sha, run, event }) => {
  git("tag", "v0.3.0");
  assert.deepEqual(releaseTarget(event, run), { sha, version: "0.3.0", tag: "latest" });
  git("tag", "-d", "v0.3.0"); git("tag", "-a", "v0.3.0", "-m", "release");
  assert.deepEqual(releaseTarget(event, run), { sha, version: "0.3.0", tag: "latest" });
  assert.equal(releaseTarget({ ...event, GITHUB_SHA: git("rev-parse", "refs/tags/v0.3.0") }, run).sha, sha);
}));

test("workflow entrypoint emits the resolved version and channel without dispatch inputs", () => repository("0.3.0", async ({ root, git, sha, event }) => {
  git("tag", "v0.3.0");
  const output = path.join(root, "github-output");
  execFileSync(process.execPath, [fileURLToPath(new URL("../../scripts/release-ref.mjs", import.meta.url))], {
    cwd: root, env: { ...process.env, ...event, GITHUB_OUTPUT: output, RELEASE_REF: "", RELEASE_VERSION: "", RELEASE_TAG: "", RELEASE_CONFIRMED: "" }, encoding: "utf8",
  });
  assert.equal(await readFile(output, "utf8"), `sha=${sha}\nversion=0.3.0\ntag=latest\n`);
}));

test("prerelease tag defaults to next and manual dispatch retains explicit channel", () => repository("0.4.0-beta.1", async ({ git, sha, event, run }) => {
  git("tag", "v0.4.0-beta.1");
  assert.deepEqual(releaseTarget(event, run), { sha, version: "0.4.0-beta.1", tag: "next" });
  const manual = { ...event, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", RELEASE_REF: "main", RELEASE_VERSION: "0.4.0-beta.1", RELEASE_TAG: "beta", RELEASE_CONFIRMED: "true" };
  assert.deepEqual(releaseTarget(manual, run), { sha, version: "0.4.0-beta.1", tag: "beta" });
  assert.throws(() => releaseTarget({ ...manual, RELEASE_TAG: "latest" }, run), /prereleases/);
  assert.throws(() => releaseTarget({ ...manual, RELEASE_CONFIRMED: "false" }, run), /confirmation/);
  assert.throws(() => releaseTarget({ ...manual, GITHUB_REF: event.GITHUB_REF }, run), /main/);
}));

test("branch pushes, deleted tags, PR events, other repos and malformed tags never select a release", () => repository("0.3.0", async ({ event, run, git }) => {
  git("tag", "v0.3.0");
  for (const change of [
    { GITHUB_REF: "refs/heads/main" }, { RELEASE_DELETED: "true" },
    { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_REPOSITORY: "other/fork" },
    { GITHUB_REF: "refs/tags/vnightly" }, { GITHUB_REF: "refs/tags/v0.3.0\nversion=9.0.0" },
    { GITHUB_SHA: "" }, { GITHUB_SHA: "--help" },
  ]) assert.throws(() => releaseTarget({ ...event, ...change }, run));
}));

test("tag release rejects version mismatch, moved tags and commits outside main", () => repository("0.3.0", async ({ root, event, run, git }) => {
  git("tag", "v9.0.0");
  assert.throws(() => releaseTarget({ ...event, GITHUB_REF: "refs/tags/v9.0.0" }, run), /does not match/);
  await writeFile(path.join(root, "extra"), "new commit");
  git("add", "extra"); git("commit", "-m", "new commit");
  git("tag", "v0.3.0");
  // Tag points outside trusted main until main is advanced.
  assert.throws(() => releaseTarget({ ...event, GITHUB_SHA: git("rev-parse", "HEAD") }, run), /merge-base/);
  git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
  assert.throws(() => releaseTarget(event, run), /triggering event commit/);
}));
