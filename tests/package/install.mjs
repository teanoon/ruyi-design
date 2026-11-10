import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { workflow } from "../browser/workflow.mjs";
const exec = promisify(execFile),
  root = process.cwd();
let tarball, pack;
if (process.argv[2]) {
  assert.equal(process.argv.length, 3, "Pass a single tarball path");
  tarball = path.resolve(process.argv[2]);
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
  const doctor = await exec(
    path.join(temp, "node_modules/.bin/ruyi-design"),
    ["doctor"],
    { cwd: temp },
  );
  assert(JSON.parse(doctor.stdout).workspace);
  assert(JSON.parse(doctor.stdout).browser.available);
  const pkg = JSON.parse(
    await readFile(path.join(installed, "package.json"), "utf8"),
  );
  assert.equal(pkg.name, "@littlehobby/ruyi-design");
  assert(!pkg.scripts.postinstall);
  const binary = path.join(temp, "node_modules/.bin/ruyi-design");
  const setup = JSON.parse((await exec(binary, ["setup", "--client", "codex", "--project", temp], { cwd: temp })).stdout);
  assert(setup.written > 0);
  assert.equal(JSON.parse((await exec(binary, ["setup", "--client", "codex", "--project", temp], { cwd: temp })).stdout).written, 0);
  assert((await readFile(path.join(temp, ".agents/skills/ruyi-design-review/SKILL.md"), "utf8")).includes("name: ruyi-design-review"));
  await workflow({
    cli: path.join(installed, "dist/cli/index.js"),
    starter: path.join(installed, "examples/starter/design"),
    screenshot: false,
  });
  assert.equal(await digest(), before, "Acceptance must not alter the tarball");
  console.log(
    `Tarball install passed: dist/${pack.filename}; ${pack.files.length} public files; consumer has no dev dependencies.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
