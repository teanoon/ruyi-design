import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { safeFile, loadCatalog } from "../catalog/index.js";
import { ensure } from "../errors.js";
import type { Manifest } from "../../contracts/catalog.js";

const allowed = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".mp4",
  ".webm",
]);
export async function assetFiles(
  root: string,
  directory = "",
): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await assetFiles(root, rel)));
    else if (allowed.has(path.extname(entry.name).toLowerCase())) {
      await safeFile(root, rel);
      files.push(rel);
    }
  }
  return files.sort();
}
export async function fingerprint(root: string) {
  const hashes: Record<string, string> = {};
  for (const file of await assetFiles(root))
    hashes[file] = createHash("sha256")
      .update(await readFile(await safeFile(root, file)))
      .digest("hex");
  return hashes;
}
export type Revision = {
  id: string;
  manifest: Manifest;
  hashes: Record<string, string>;
  created: number;
  batchId?: string;
  source?: "feedback" | "conversation";
  request?: string;
  baseRevision?: string;
  key?: string;
  mode: "styles" | "reload";
};
export async function snapshot(
  root: string,
  dataRoot: string,
): Promise<Revision> {
  const before = await fingerprint(root);
  const id = randomUUID();
  const dest = path.join(dataRoot, "revisions", id);
  try {
    for (const file of Object.keys(before)) {
      const out = path.join(dest, file);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, await readFile(await safeFile(root, file)));
    }
    ensure(
      JSON.stringify(before) === JSON.stringify(await fingerprint(root)) &&
        JSON.stringify(before) === JSON.stringify(await fingerprint(dest)),
      "source_changed",
      "Source changed during snapshot; retry",
      409,
    );
    return {
      id,
      manifest: await loadCatalog(dest),
      hashes: before,
      created: Date.now(),
      mode: "reload",
    };
  } catch (e) {
    await rm(dest, { recursive: true, force: true });
    throw e;
  }
}
export function changeMode(before: Revision, after: Revision) {
  const changed = new Set(
    [...Object.keys(before.hashes), ...Object.keys(after.hashes)].filter(
      (k) => before.hashes[k] !== after.hashes[k],
    ),
  );
  return [...changed].every((p) => p.endsWith(".css"))
    ? ("styles" as const)
    : ("reload" as const);
}
