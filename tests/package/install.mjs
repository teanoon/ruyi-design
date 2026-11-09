import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, readFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { workflow } from "../browser/workflow.mjs";
const exec = promisify(execFile),
  root = process.cwd();
const { stdout } = await exec("npm", ["pack", "--json", "--ignore-scripts"], {
  cwd: root,
});
const [pack] = JSON.parse(stdout);
const tarball = path.resolve(pack.filename);
for (const file of pack.files)
  assert(
    !/^(src|tests|openspec|node_modules|\.codex-home|\.uxai-review)\//.test(
      file.path,
    ),
    file.path,
  );
for (const expected of [
  "dist/cli/index.js",
  "dist/workspace/index.html",
  "dist/bridge/bridge.js",
  "skills/prototype-review/SKILL.md",
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
  const installed = path.join(temp, "node_modules/uxai-review");
  await access(path.join(temp, "node_modules/.bin/uxai-review"));
  const doctor = await exec(
    path.join(temp, "node_modules/.bin/uxai-review"),
    ["doctor"],
    { cwd: temp },
  );
  assert(JSON.parse(doctor.stdout).workspace);
  const pkg = JSON.parse(
    await readFile(path.join(installed, "package.json"), "utf8"),
  );
  assert(!pkg.scripts.postinstall);
  await workflow({
    cli: path.join(installed, "dist/cli/index.js"),
    starter: path.join(installed, "examples/starter/design"),
    screenshot: false,
  });
  console.log(
    `Tarball install passed: ${pack.filename}; ${pack.files.length} public files; consumer has no dev dependencies.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
