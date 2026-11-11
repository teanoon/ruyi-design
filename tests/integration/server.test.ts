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
import { runtime } from "../../src/core/runtime.js";

describe("HTTP workspace and revisions", () => {
  it("rejects concurrent duplicate comments and protects queued mutations through HTTP", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-comment-http-"));
    await cp("examples/starter/design", path.join(root, "design"), { recursive: true });
    const server = await ReviewServer.start(startSchema.parse({ projectRoot: root, designRoot: path.join(root, "design") }));
    try {
      const manifest = server.session.active()!.manifest;
      const page = manifest.pages[0], state = page.states[0], deviceId = Object.keys(state.entries)[0];
      const target = { kind: "page", objectId: page.id, stateId: state.id, deviceId, revisionId: server.info().revisionId, context: { anchor: { selector: "#same" } } };
      const prefix = `/api/sessions/${server.info().sessionId}`;
      const headers = { host: new URL(server.base).host, authorization: `Bearer ${server.token}` };
      const replies = await Promise.all(["One", "Two"].map(text => server.control.inject({ method: "POST", url: `${prefix}/comments`, headers, payload: { text, target } })));
      expect(replies.map(r => r.statusCode).sort()).toEqual([200, 409]);
      const c = server.session.context().comments[0];
      expect(replies.find(r => r.statusCode === 409)!.json().error).toMatchObject({ code: "comment_exists", details: { existingCommentId: c.id } });
      server.session.feedback.prepare("freeze-http");
      for (const action of ["reopen", "cancel_reopen", "resolve", "archive"]) {
        const result = await server.control.inject({ method: "POST", url: `${prefix}/comments/${c.id}/review`, headers, payload: { action } });
        expect(result.statusCode).toBe(409);
        expect(result.json().error.code).toBe("batch_active");
      }
      for (const method of ["PATCH", "DELETE"] as const) {
        const result = await server.control.inject({ method, url: `${prefix}/comments/${c.id}`, headers, ...(method === "PATCH" ? { payload: { text: "Changed" } } : {}) });
        expect(result.statusCode).toBe(409);
      }
      expect(server.session.feedback.comment(c.id).text).toBe(c.text);
    } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
  });
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
      expect(info.runtime).toEqual(runtime);
      expect(server.context().runtime).toEqual(info.runtime);
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
      const context = (await server.control.inject({ url: `${prefix}/context`, headers })).json();
      expect(context.runtime).toEqual(info.runtime);
      expect(server.session.context()).not.toHaveProperty("runtime");
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
  it.each(["prototype-review", "ruyi-uxai-review"])("installs explicitly and preserves legacy %s customization", async (legacyName) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uxai-setup-"));
    try {
      const legacy = path.join(root, ".agents/skills", legacyName);
      await mkdir(legacy, { recursive: true });
      await writeFile(path.join(legacy, "custom.md"), "keep user customization");
      const installed = await setup(root);
      expect(installed.written).toBeGreaterThan(0);
      expect(installed.legacySkillPath).toBe(legacy);
      expect(await readFile(path.join(legacy, "custom.md"), "utf8")).toBe("keep user customization");
      expect((await setup(root)).written).toBe(0);
      await writeFile(
        path.join(root, ".agents/skills/ruyi-design-review/SKILL.md"),
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
      const skill = path.join(root, ".agents/skills/ruyi-design-review");
      await mkdir(skill, { recursive: true });
      await symlink(outside, path.join(skill, "references"));
      await expect(setup(root)).rejects.toThrow("symlink");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
