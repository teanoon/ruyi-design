import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/** Resolve this package, never the consumer's cwd. Read once at process startup. */
export function readPackageVersion(file = new URL("../../package.json", import.meta.url)): string {
  try {
    const { version } = JSON.parse(readFileSync(file, "utf8"));
    if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/.test(version))
      throw new Error("version must be a semantic version string");
    return version;
  } catch (error) {
    throw new Error(`Cannot read Ruyi Design package version: ${(error as Error).message}`);
  }
}

export const packageVersion = readPackageVersion();
export const runtime = Object.freeze({
  packageVersion,
  instanceId: randomUUID(),
  pid: process.pid,
  startedAt: new Date().toISOString(),
});
