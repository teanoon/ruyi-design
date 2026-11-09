import path from "node:path";
import { existsSync } from "node:fs";
import { BRAND } from "../../contracts/brand.js";
import { ensure } from "../errors.js";

export function resolveDataRoot(project: string, explicit?: string) {
  if (explicit) return { path: path.resolve(explicit), source: "explicit" };
  const candidates = [BRAND.dataDirectory, BRAND.previousDataDirectory, BRAND.legacyDataDirectory]
    .map((directory) => path.join(project, directory));
  const existing = candidates.filter((directory) => existsSync(directory));
  ensure(existing.length <= 1, "ambiguous_data_root",
    `Multiple review data directories exist: ${existing.join(", ")}. Pass dataRoot explicitly; no data was opened or changed.`, 409);
  return existing.length
    ? { path: existing[0], source: existing[0] === candidates[0] ? "current" : "legacy" }
    : { path: candidates[0], source: "new" };
}
