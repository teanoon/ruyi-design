// Built CLI contract checks: invalid explicit configuration stops before browser launch.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const exec = promisify(execFile);
const cli = path.resolve("dist/cli/index.js");
const project = await mkdtemp(path.join(os.tmpdir(), "doctor-cli-"));
const env = { ...process.env, RUYI_DESIGN_BROWSER_CHANNEL: "invalid", RUYI_DESIGN_BROWSER_EXECUTABLE: "" };
async function run(args = []) {
  try {
    const result = await exec(process.execPath, [cli, "doctor", "--project", project, ...args], { env });
    return { ...result, code: 0 };
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
  }
}
try {
  const normal = await run();
  assert.equal(normal.code, 1);
  assert.equal(normal.stderr, "");
  assert(normal.stdout.startsWith("如意设计 · Ruyi Design\n检查结果：失败\n"));
  assert(normal.stdout.includes("配置冲突"));
  assert(!normal.stdout.includes("playwright install"));
  assert(normal.stdout.includes("首次启动评审时创建"));
  assert.deepEqual(await readdir(project), []);
  const json = await run(["--json"]);
  const report = JSON.parse(json.stdout);
  assert.equal(json.code, 1);
  assert.equal(json.stderr, "");
  assert.equal(report.status, "error");
  assert.equal(report.checks.browser.status, "failed");
  assert.equal(report.browser.available, false);
  assert.equal(report.browser.attempts[0].source, "explicit");
  assert.deepEqual(report.recommendations.map(r => r.code), ["fix_browser_configuration"]);
  assert.equal(report.browserInstall, undefined);
  assert(!json.stdout.includes("\u001b"));
  const verbose = await run(["--verbose"]);
  assert.equal(verbose.code, 1);
  assert(verbose.stdout.startsWith(normal.stdout.trimEnd()));
  assert(verbose.stdout.includes("mutually exclusive"));
  const combined = await run(["--json", "--verbose"]);
  assert.equal(combined.code, 1);
  assert.equal(combined.stderr, "");
  assert.deepEqual(JSON.parse(combined.stdout), report);
  await mkdir(path.join(project, ".ruyi-design"));
  await mkdir(path.join(project, ".uxai-review"));
  const ambiguous = await run(["--json"]);
  const dataError = JSON.parse(ambiguous.stdout);
  assert.equal(ambiguous.code, 1);
  assert.equal(dataError.checks.data.status, "failed");
  assert.equal(dataError.checks.browser.status, "not_checked");
  assert.equal(dataError.browser, undefined);
  assert(dataError.checks.data.message.includes(path.join(project, ".uxai-review")));
  assert.deepEqual(dataError.recommendations.map(r => r.code), ["resolve_data_directory"]);
  const dataText = await run();
  assert(dataText.stdout.includes("浏览器启动验证：未检查"));
  assert(!dataText.stdout.includes("playwright install"));
  await rm(path.join(project, ".uxai-review"), { recursive: true });
  const design = path.join(project, "design");
  await mkdir(design);
  await writeFile(path.join(design, "manifest.json"), "{invalid");
  const invalidCatalog = await run(["--json", "--design", design]);
  const catalogError = JSON.parse(invalidCatalog.stdout);
  assert.equal(invalidCatalog.code, 1);
  assert.equal(catalogError.checks.catalog.status, "failed");
  assert(catalogError.recommendations.some(r => r.code === "fix_catalog"));
  assert.equal(invalidCatalog.stderr, "");
  const help = await exec(process.execPath, [cli, "--help"], { env });
  for (const flag of ["--json", "--verbose"]) assert(help.stdout.includes(flag));
  console.log("Doctor CLI passed: redirected text, pure JSON, verbose, combined flags, failure exit codes, data ambiguity and invalid catalog; no browser launched.");
} finally {
  await rm(project, { recursive: true, force: true });
}
