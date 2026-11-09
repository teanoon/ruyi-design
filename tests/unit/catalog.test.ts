import { describe, it, expect } from "vitest";
import { mkdtemp, cp, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadCatalog,
  validateReferences,
  safeFile,
} from "../../src/core/catalog/index.js";
import { manifestSchema, combinations } from "../../src/contracts/catalog.js";
import { snapshot } from "../../src/core/revisions/index.js";
import { isBridgeMessage } from "../../src/contracts/bridge.js";

describe("prototype catalog", () => {
  it("loads the shared starter, only declares valid device combinations and preserves component reuse", async () => {
    const m = await loadCatalog(path.resolve("examples/starter/design"));
    expect(m.pages.map((p) => p.id)).toEqual([
      "login",
      "home",
      "project",
      "settings",
    ]);
    expect(
      combinations(m).filter(
        (c) =>
          c.kind === "component" &&
          c.objectId === "button" &&
          c.deviceId === "mobile",
      ),
    ).toHaveLength(3);
    expect(m.pages[0].components).toContain("button");
  });
  it("rejects duplicate IDs, unsupported versions and missing device/component references", async () => {
    const m = await loadCatalog(path.resolve("examples/starter/design"));
    expect(() =>
      validateReferences({ ...m, devices: [...m.devices, m.devices[0]] }),
    ).toThrow("Duplicate");
    expect(() => manifestSchema.parse({ ...m, schemaVersion: 2 })).toThrow();
    expect(() => validateReferences({ ...m, devices: [m.devices[0]] })).toThrow(
      "mobile",
    );
    expect(() => validateReferences({ ...m, components: [] })).toThrow(
      "components",
    );
  });
  it("rejects path traversal and symlink escapes and excludes private files from snapshots", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "uxai-catalog-"));
    try {
      const root = path.join(temp, "design");
      await cp("examples/starter/design", root, { recursive: true });
      await writeFile(path.join(temp, "outside.js"), "private");
      await symlink(
        path.join(temp, "outside.js"),
        path.join(root, "escape.js"),
      );
      await expect(safeFile(root, "../outside.js")).rejects.toThrow("outside");
      await expect(safeFile(root, "escape.js")).rejects.toThrow("outside");
      await expect(snapshot(root, path.join(temp, "data"))).rejects.toThrow();
      await rm(path.join(root, "escape.js"));
      await writeFile(path.join(root, ".env"), "SECRET");
      const rev = await snapshot(root, path.join(temp, "data"));
      expect(rev.hashes[".env"]).toBeUndefined();
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
  it("validates the bridge envelope", () => {
    expect(isBridgeMessage({ version: 1, channel: "uxai-review", frameId: "x", type: "ready" })).toBe(false);
    expect(
      isBridgeMessage({
        version: 1,
        channel: "ruyi-design",
        frameId: "x",
        type: "ready",
      }),
    ).toBe(true);
    expect(
      isBridgeMessage({
        version: 2,
        channel: "ruyi-design",
        frameId: "x",
        type: "ready",
      }),
    ).toBe(false);
  });
});
