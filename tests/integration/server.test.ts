import { describe, it, expect } from "vitest";
import {
  mkdtemp,
  cp,
  rm,
  readFile,
  writeFile,
  symlink,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ReviewServer, startSchema } from "../../src/server/index.js";
import { setup } from "../../src/skills/index.js";

describe("HTTP workspace and revisions", () => {
  it("scopes hosts, origins, tokens, snapshots, explicit ports and restores after close", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uxai-server-"));
    await cp("examples/starter/design", path.join(root, "design"), {
      recursive: true,
    });
    let server: ReviewServer | undefined;
    try {
      server = await ReviewServer.start(
        startSchema.parse({
          projectRoot: root,
          designRoot: path.join(root, "design"),
          host: "0.0.0.0",
        }),
      );
      const info = server.info();
      expect(info.reviewUrl).not.toContain("0.0.0.0");
      const prefix = `/api/sessions/${info.sessionId}`;
      const authorization = `Bearer ${server.token}`;
      expect(
        (
          await server.control.inject({
            url: prefix + "/context",
            headers: { host: new URL(server.base).host },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await server.control.inject({
            url: prefix + "/context",
            headers: {
              host: new URL(server.base).host,
              origin: "https://evil.test",
              authorization,
            },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await server.control.inject({
            url: prefix + "/context",
            headers: { host: new URL(server.base).host, authorization },
          })
        ).statusCode,
      ).toBe(200);
      expect(server.session.context().activity).toBe("idle");
      const headers = { host: new URL(server.base).host, authorization };
      const historical = await server.control.inject({ url: `${prefix}/revisions/${info.revisionId}`, headers });
      expect(historical.statusCode).toBe(200);
      expect(historical.json().manifest.pages[0].id).toBe("login");
      expect((await server.control.inject({ url: `${prefix}/revisions/unknown`, headers })).statusCode).toBe(404);
      expect((await server.control.inject({ url: `${prefix}/revisions/${info.revisionId}`, headers: { host: new URL(server.base).host } })).statusCode).toBe(401);
      const saved = await server.control.inject({
        method: "POST", url: prefix + "/comments", headers,
        payload: { text: "Saved without starting AI", target: { kind: "token", objectId: "primary", revisionId: info.revisionId } },
      });
      expect(saved.statusCode).toBe(200);
      const read = await server.control.inject({ url: prefix + "/context", headers });
      expect(read.json().comments).toHaveLength(1);
      expect(read.json().batches).toHaveLength(0);
      const removed = await server.control.inject({ method: "POST", url: prefix + "/batches", headers, payload: { idempotencyKey: "old-ui-submit" } });
      expect(removed.statusCode).toBe(404);
      expect(server.session.context().batches).toHaveLength(0);
      const otherRoot = await mkdtemp(path.join(os.tmpdir(), "uxai-port-"));
      try {
        await cp("examples/starter/design", path.join(otherRoot, "design"), {
          recursive: true,
        });
        await expect(
          ReviewServer.start(
            startSchema.parse({
              projectRoot: otherRoot,
              designRoot: path.join(otherRoot, "design"),
              port: Number(new URL(server.base).port),
            }),
          ),
        ).rejects.toThrow();
      } finally {
        await rm(otherRoot, { recursive: true, force: true });
      }
      const before = await readFile(
        path.join(root, "design/pages/login.html"),
        "utf8",
      );
      const r = await fetch(
        `${server.previewBase}/r/${info.revisionId}/pages/login.html`,
      );
      expect(await r.text()).toContain("/bridge.js");
      expect(
        await readFile(path.join(root, "design/pages/login.html"), "utf8"),
      ).toBe(before);
      await writeFile(
        path.join(root, "design/pages/login.html"),
        before.replace("欢迎回来", "Unpublished"),
      );
      expect(
        await (
          await fetch(
            `${server.previewBase}/r/${info.revisionId}/pages/login.html`,
          )
        ).text(),
      ).toContain("欢迎回来");
      await server.close();
      server = undefined;
      const restored = await ReviewServer.start(
        startSchema.parse({
          projectRoot: root,
          designRoot: path.join(root, "design"),
        }),
      );
      server = restored;
      expect(restored.info().revisionId).toBe(info.revisionId);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  it("installs skills explicitly, is idempotent and preserves user edits", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uxai-setup-"));
    try {
      expect((await setup(root)).written).toBeGreaterThan(0);
      expect((await setup(root)).written).toBe(0);
      await writeFile(
        path.join(root, ".agents/skills/prototype-review/SKILL.md"),
        "user edits",
      );
      await expect(setup(root)).rejects.toThrow("differs");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("refuses nested skill destination symlinks before writing outside the project", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uxai-setup-link-"));
    const outside = await mkdtemp(
      path.join(os.tmpdir(), "uxai-setup-outside-"),
    );
    try {
      const skill = path.join(root, ".agents/skills/prototype-review");
      await mkdir(skill, { recursive: true });
      await symlink(outside, path.join(skill, "references"));
      await expect(setup(root)).rejects.toThrow("symlink");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
