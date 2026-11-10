import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { workflow } from "../browser/workflow.mjs";
const exec = promisify(execFile),
  root = process.cwd();
await mkdir(path.join(root, "dist"), { recursive: true });
const { stdout } = await exec("npm", ["pack", "--pack-destination", "dist", "--json", "--ignore-scripts"], {
  cwd: root,
});
const [pack] = JSON.parse(stdout);
const tarball = path.resolve(root, "dist", pack.filename);
assert(pack.files.every(file => !file.path.endsWith(".tgz")), "Release archives must not be nested in the npm package");
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
      "--offline",
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
  console.log(
    `Tarball install passed: dist/${pack.filename}; ${pack.files.length} public files; consumer has no dev dependencies.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
