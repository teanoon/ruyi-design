import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  manifestSchema,
  combinations,
  type Manifest,
} from "../../contracts/catalog.js";
import { ensure } from "../errors.js";

export async function safeFile(root: string, relative: string) {
  ensure(
    !relative.includes("\0") && !relative.includes("\\"),
    "invalid_path",
    "Invalid path",
  );
  const base = await realpath(root);
  const file = await realpath(path.resolve(base, relative));
  ensure(
    file.startsWith(base + path.sep),
    "outside_root",
    "Asset is outside the approved design root",
    403,
  );
  ensure((await stat(file)).isFile(), "not_file", "Expected a file");
  return file;
}
export function validateReferences(m: Manifest) {
  const unique = (values: string[], at: string) =>
    ensure(
      new Set(values).size === values.length,
      "duplicate_id",
      `Duplicate ID in ${at}`,
    );
  unique(
    m.devices.map((d) => d.id),
    "devices",
  );
  unique(
    m.pages.map((p) => p.id),
    "pages",
  );
  unique(
    m.components.map((c) => c.id),
    "components",
  );
  unique(
    m.tokens.map((t) => t.id),
    "tokens",
  );
  for (const p of m.pages) {
    unique(
      p.states.map((s) => s.id),
      `pages.${p.id}.states`,
    );
    for (const c of p.components)
      ensure(
        m.components.some((x) => x.id === c),
        "missing_reference",
        `pages.${p.id}.components: ${c}`,
      );
  }
  for (const c of m.components)
    unique(
      c.examples.map((e) => e.id),
      `components.${c.id}.examples`,
    );
  for (const c of combinations(m))
    ensure(
      m.devices.some((d) => d.id === c.deviceId),
      "missing_device",
      `${c.objectId}: ${c.deviceId}`,
    );
  return m;
}
export async function loadCatalog(root: string): Promise<Manifest> {
  const m = validateReferences(
    manifestSchema.parse(
      JSON.parse(await readFile(await safeFile(root, "manifest.json"), "utf8")),
    ),
  );
  for (const entry of combinations(m)) {
    ensure(
      entry.entry.path.endsWith(".html"),
      "invalid_entry",
      `${entry.name}: HTML entry required`,
    );
    await safeFile(root, entry.entry.path);
  }
  for (const c of m.components)
    for (const p of c.implementation) await safeFile(root, p);
  return m;
}
