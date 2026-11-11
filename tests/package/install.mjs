import { execFile } from "node:child_process";
import { promisify, parseArgs } from "node:util";
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { artifactInfo } from "../../scripts/release.mjs";
const exec = promisify(execFile),
  root = process.cwd();
const { values, positionals } = parseArgs({ allowPositionals: true, options: { "skip-browser-checks": { type: "boolean" } } });
assert(positionals.length <= 1, "Pass a single tarball path");
const browserChecks = !values["skip-browser-checks"];
let tarball, pack;
if (positionals[0]) {
  tarball = path.resolve(positionals[0]);
  const { stdout } = await exec("tar", ["-tzf", tarball]);
  pack = { filename: path.basename(tarball), files: stdout.trim().split("\n").filter(f => !f.endsWith("/")).map(f => {
    assert(f.startsWith("package/") && !f.split("/").includes(".."), f);
    return { path: f.slice(8) };
  }) };
} else {
  await mkdir(path.join(root, "dist"), { recursive: true });
  const { stdout } = await exec("npm", ["pack", "--pack-destination", "dist", "--json", "--ignore-scripts"], { cwd: root });
  [pack] = JSON.parse(stdout);
  tarball = path.resolve(root, "dist", pack.filename);
}
const digest = async () => createHash("sha512").update(await readFile(tarball)).digest("hex");
const before = await digest();
assert.equal((await artifactInfo(tarball)).pkg.license, "Apache-2.0");
for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
  const { stdout } = await exec("tar", ["-xOzf", tarball, `package/${file}`]);
  assert.equal(stdout, await readFile(path.join(root, file), "utf8"), `${file} must be preserved in the tarball`);
}
assert(pack.files.every(file => !file.path.endsWith(".tgz")), "Release archives must not be nested in the npm package");
assert(pack.files.every(file => !/^dist\/release-.*\.json$/.test(file.path)), "Release manifests must not enter the package");
for (const file of pack.files)
  assert(
    !/^(src|tests|openspec|node_modules|\.codex-home|\.ruyi-design|\.ruyi-uxai|\.uxai-review)\//.test(
      file.path,
    ),
    file.path,
  );
for (const expected of [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "dist/cli/index.js",
  "dist/workspace/index.html",
  "dist/bridge/bridge.js",
  "dist/contracts/shortcuts.js",
  "dist/workspace/ruyi-mark.svg",
  "dist/workspace/ruyi-mark-mono.svg",
  "dist/workspace/ruyi-wordmark.svg",
  "skills/ruyi-design-review/SKILL.md",
  "schemas/manifest.schema.json",
])
  assert(
    pack.files.some((f) => f.path === expected),
    expected,
  );
const temp = await mkdtemp(path.join(os.tmpdir(), "uxai-consumer-"));
try {
  await writeFile(
    path.join(temp, "package.json"),
    JSON.stringify({
      name: "review-consumer",
      version: "1.0.0",
      private: true,
    }),
  );
  await exec(
    "npm",
    [
      "install",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefer-offline",
      tarball,
    ],
    { cwd: temp, timeout: 120000 },
  );
  const installed = path.join(temp, "node_modules/@littlehobby/ruyi-design");
  await access(path.join(temp, "node_modules/.bin/ruyi-design"));
  await access(path.join(installed, "dist/workspace/index.html"));
  await access(path.join(installed, "dist/bridge/bridge.js"));
  const pkg = JSON.parse(
    await readFile(path.join(installed, "package.json"), "utf8"),
  );
  assert.equal(pkg.name, "@littlehobby/ruyi-design");
  assert.equal(pkg.license, "Apache-2.0");
  for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
    assert.equal(await readFile(path.join(installed, file), "utf8"), await readFile(path.join(root, file), "utf8"), `${file} must be preserved after installation`);
  assert(!pkg.scripts.postinstall);
  const binary = path.join(temp, "node_modules/.bin/ruyi-design");
  assert((await exec(binary, ["--help"], { cwd: temp })).stdout.includes("ruyi-design mcp"));
  const setup = JSON.parse((await exec(binary, ["setup", "--client", "codex", "--project", temp], { cwd: temp })).stdout);
  assert(setup.written > 0);
  assert.equal(JSON.parse((await exec(binary, ["setup", "--client", "codex", "--project", temp], { cwd: temp })).stdout).written, 0);
  assert((await readFile(path.join(temp, ".agents/skills/ruyi-design-review/SKILL.md"), "utf8")).includes("name: ruyi-design-review"));
  const mcp = new Client({ name: "package-install-test", version: "1" });
  try {
    await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(installed, "dist/cli/index.js"), "mcp"], cwd: temp, env: process.env, stderr: "pipe" }));
    assert.equal(mcp.getServerVersion().name, "ruyi-design-mcp");
    const tools = (await mcp.listTools()).tools;
    assert.equal(tools.length, 9);
    assert(tools.some(tool => tool.name === "ruyi_design_publish_revision"));
    assert((await mcp.readResource({ uri: "ruyi-design://guides/review" })).contents[0].text.includes("ruyi_design_publish_revision"));
  } finally { await mcp.close(); }
  if (browserChecks) {
    const doctor = JSON.parse((await exec(binary, ["doctor", "--json"], { cwd: temp })).stdout);
    assert(doctor.workspace && doctor.browser.available);
    const { workflow } = await import("../browser/workflow.mjs");
    await workflow({ cli: path.join(installed, "dist/cli/index.js"), starter: path.join(installed, "examples/starter/design"), screenshot: false });
  }
  assert.equal(await digest(), before, "Acceptance must not alter the tarball");
  console.log(
    `Tarball install passed: dist/${pack.filename}; ${pack.files.length} public files; consumer has no dev dependencies; browser checks ${browserChecks ? "passed" : "skipped (CLI/MCP/skill checks passed)"}.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
