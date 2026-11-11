import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";
import { packageVersion, readPackageVersion, runtime } from "../../src/core/runtime.js";

it("loads this package version and keeps a read-only process identity", async () => {
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  expect(packageVersion).toBe(pkg.version);
  expect(runtime).toMatchObject({ packageVersion: pkg.version, pid: process.pid });
  expect(runtime.instanceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(new Date(runtime.startedAt).toISOString()).toBe(runtime.startedAt);
  expect(Object.isFrozen(runtime)).toBe(true);
  const again = await import("../../src/core/runtime.js");
  expect(again.runtime).toBe(runtime);
});

it("reports invalid or missing package metadata explicitly", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-version-"));
  const file = pathToFileURL(path.join(root, "package.json"));
  try {
    expect(() => readPackageVersion(file)).toThrow("Cannot read Ruyi Design package version");
    for (const value of ["{", "null", "{}", '{"version":1}', '{"version":""}', '{"version":"01.2.3"}', '{"version":"1.2.3-beta.01"}']) {
      await writeFile(file, value);
      expect(() => readPackageVersion(file)).toThrow("Cannot read Ruyi Design package version");
    }
    await writeFile(file, '{"version":"1.2.3-beta.1+build.4"}');
    expect(readPackageVersion(file)).toBe("1.2.3-beta.1+build.4");
    expect(runtime.packageVersion).toBe(packageVersion);
  } finally { await rm(root, { recursive: true, force: true }); }
});
