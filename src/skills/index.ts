import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  lstat,
  realpath,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BRAND } from "../contracts/brand.js";
import { ensure } from "../core/errors.js";

export const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
export const skillRoot = path.join(packageRoot, "skills", BRAND.skill);
export async function guide() {
  return readFile(path.join(skillRoot, "SKILL.md"), "utf8");
}
async function files(root: string, dir = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(root, p)));
    else out.push(p);
  }
  return out;
}
export async function setup(project: string) {
  const root = await realpath(project),
    dest = path.join(root, ".agents/skills/ruyi-design-review");
  // Check every existing ancestor before writing; setup must not follow project symlinks.
  for (const part of [
    ".agents",
    ".agents/skills",
    ".agents/skills/ruyi-design-review",
  ]) {
    try {
      ensure(
        !(await lstat(path.join(root, part))).isSymbolicLink(),
        "setup_symlink",
        `Refusing symlink: ${part}`,
      );
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const source = await files(skillRoot);
  const pending: { file: string; body: Buffer }[] = [];
  for (const rel of source) {
    const file = path.join(dest, rel),
      body = await readFile(path.join(skillRoot, rel));
    let ancestor = root;
    for (const segment of path
      .relative(root, path.dirname(file))
      .split(path.sep)) {
      ancestor = path.join(ancestor, segment);
      try {
        ensure(
          !(await lstat(ancestor)).isSymbolicLink(),
          "setup_symlink",
          `Refusing symlink: ${ancestor}`,
        );
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    try {
      ensure(
        !(await lstat(file)).isSymbolicLink(),
        "setup_symlink",
        `Refusing symlink: ${file}`,
      );
      ensure(
        (await readFile(file)).equals(body),
        "setup_conflict",
        `Existing skill differs: ${file}`,
      );
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      pending.push({ file, body });
    }
  }
  for (const p of pending) {
    await mkdir(path.dirname(p.file), { recursive: true });
    await writeFile(p.file, p.body, { flag: "wx" });
  }
  const legacySkillPaths: string[] = [];
  for (const name of ["ruyi-uxai-review", "prototype-review"]) {
    const legacy = path.join(root, ".agents/skills", name);
    if (await lstat(legacy).catch(() => undefined)) legacySkillPaths.push(legacy);
  }
  return {
    skillPath: dest,
    written: pending.length,
    mcpCommand: `${BRAND.cli} mcp`,
    legacySkillPath: legacySkillPaths[0],
    legacySkillPaths,
    ...(legacySkillPaths.length ? { migration: "Review and disable the reported legacy skills after switching to ruyi-design-review; custom files are preserved." } : {}),
  };
}
