import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, symlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const exec = promisify(execFile);
// packageJson must belong to an isolated test installation: it is temporarily edited.
export async function verifyRuntime({ cli, packageJson, guidePath }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-runtime-"));
  const design = path.join(root, "design");
  const original = await readFile(packageJson, "utf8");
  const pkg = JSON.parse(original);
  let client;
  const connect = async () => {
    client = new Client({ name: "runtime-acceptance", version: "1" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp"], cwd: root, stderr: "pipe" }));
  };
  const call = async (name, args) => {
    const result = await client.callTool({ name: `ruyi_design_${name}`, arguments: args });
    assert(!result.isError, JSON.stringify(result.content));
    return result.structuredContent ?? JSON.parse(result.content[0].text);
  };
  const start = () => call("start_review", { projectRoot: root, designRoot: design });
  const context = info => call("get_review_context", { sessionId: info.sessionId });
  const request = async (info, route, options = {}) => {
    const url = new URL(info.reviewUrl);
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    const response = await fetch(`${url.origin}/api/sessions/${info.sessionId}/${route}`, {
      ...options, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    assert(response.ok, `${route}: ${response.status}`);
    return response.json();
  };
  try {
    await mkdir(design);
    await writeFile(path.join(design, "manifest.json"), JSON.stringify({ schemaVersion: 1, id: "runtime", name: "Runtime", devices: [{ id: "desktop", name: "Desktop", width: 1000, height: 800 }], pages: [{ id: "home", name: "Home", states: [{ id: "default", name: "Default", entries: { desktop: { path: "index.html" } } }] }] }));
    await writeFile(path.join(design, "index.html"), '<html><head><title>Runtime</title></head><body><button id="button">Review</button></body></html>');
    await connect();
    assert.equal(client.getServerVersion().version, pkg.version);
    const info = await start(), first = await context(info);
    assert.deepEqual(info.runtime, first.runtime);
    assert.deepEqual((await request(info, "context")).runtime, first.runtime);
    assert.deepEqual((await context(info)).runtime, first.runtime);
    assert.deepEqual((await start()).runtime, first.runtime);
    assert.equal(first.runtime.packageVersion, pkg.version);
    assert(Number.isInteger(first.runtime.pid) && first.runtime.pid > 0);
    assert.match(first.runtime.instanceId, /^[0-9a-f-]{36}$/);
    assert.equal(new Date(first.runtime.startedAt).toISOString(), first.runtime.startedAt);
    assert.equal(first.comments.length, 0); assert.equal(first.batches.length, 0);
    const guide = (await client.readResource({ uri: "ruyi-design://guides/review" })).contents[0].text;
    assert.equal(guide, await readFile(guidePath, "utf8"));
    assert(guide.includes("do not ask for an extra reopen click"));
    const comment = await request(info, "comments", { method: "POST", body: JSON.stringify({ text: "Persist through restart", target: { kind: "page", objectId: "home", stateId: "default", deviceId: "desktop", revisionId: info.revisionId } }) });
    const saved = await context(info);
    assert.equal(saved.comments[0].id, comment.id);
    await call("end_review", { sessionId: info.sessionId });
    const reopened = await start();
    assert.equal(reopened.sessionId, info.sessionId);
    assert.deepEqual(reopened.runtime, info.runtime, "Reopening a review is not a process restart");
    await client.close(); client = undefined;
    await connect();
    const restarted = await start(), restored = await context(restarted);
    assert.notEqual(restarted.runtime.instanceId, info.runtime.instanceId);
    assert.equal(restarted.runtime.packageVersion, pkg.version);
    assert.equal(restarted.sessionId, info.sessionId);
    assert.equal(restarted.revisionId, info.revisionId);
    assert.deepEqual(restored.comments, saved.comments);
    assert.deepEqual(restored.batches, saved.batches);

    // Emulate an in-place upgrade in this disposable installation only.
    const upgradedVersion = `${pkg.version.split("-")[0]}-runtime-test.1`;
    await writeFile(packageJson, JSON.stringify({ ...pkg, version: upgradedVersion }));
    assert.deepEqual((await context(restarted)).runtime, restarted.runtime, "Loaded version must not follow on-disk changes");
    const { stdout } = await exec(process.execPath, [cli, "doctor", "--project", root, "--json"], {
      cwd: root, env: { ...process.env, RUYI_DESIGN_BROWSER_CHANNEL: "invalid", RUYI_DESIGN_BROWSER_EXECUTABLE: "" },
    }).catch(error => { assert.equal(error.code, 1); return error; });
    assert.equal(JSON.parse(stdout).packageVersion, upgradedVersion, "Doctor sees its own installation, not the running MCP");
    await client.close(); client = undefined;
    await connect();
    assert.equal(client.getServerVersion().version, upgradedVersion);
    const upgraded = await start();
    assert.equal(upgraded.runtime.packageVersion, upgradedVersion);
    assert.notEqual(upgraded.runtime.instanceId, restarted.runtime.instanceId);
    assert.equal(upgraded.sessionId, info.sessionId);
    assert.deepEqual((await context(upgraded)).comments, saved.comments);
    console.log("Runtime diagnostics passed: handshake/package version, MCP/HTTP parity, stable live identity, same-session restarts, frozen startup version, local doctor distinction and guide parity.");
  } finally {
    try { await client?.close(); }
    finally { await writeFile(packageJson, original); await rm(root, { recursive: true, force: true }); }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = path.resolve(".");
  const installation = await mkdtemp(path.join(os.tmpdir(), "ruyi-runtime-install-"));
  try {
    for (const name of ["dist", "skills"]) await cp(path.join(source, name), path.join(installation, name), { recursive: true, filter: file => !file.endsWith(".tgz") });
    await cp(path.join(source, "package.json"), path.join(installation, "package.json"));
    await symlink(path.join(source, "node_modules"), path.join(installation, "node_modules"), "dir");
    await verifyRuntime({ cli: path.join(installation, "dist/cli/index.js"), packageJson: path.join(installation, "package.json"), guidePath: path.join(installation, "skills/ruyi-design-review/SKILL.md") });
  } finally { await rm(installation, { recursive: true, force: true }); }
}
