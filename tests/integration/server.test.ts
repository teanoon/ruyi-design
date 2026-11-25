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
import { createHash } from "node:crypto";
import { ReviewServer, startSchema } from "../../src/server/index.js";
import { setup } from "../../src/skills/index.js";
import { runtime } from "../../src/core/runtime.js";
import { previewHtmlCacheParam } from "../../src/contracts/urls.js";

describe("HTTP workspace and revisions", () => {
  it.each(["direct", "gateway"])("caches only published preview assets through %s", async (mode) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-preview-cache-"));
    const designRoot = path.join(root, "design");
    let server: ReviewServer | undefined;
    try {
      await cp("examples/starter/design", designRoot, { recursive: true });
      const app = server = await ReviewServer.start(startSchema.parse({
        projectRoot: root,
        designRoot,
        ...(mode === "gateway" ? { publicBaseUrl: "http://review.test:34000/?port=4173" } : {}),
      }));
      const { revisionId, sessionId } = app.info();
      const preview = mode === "gateway" ? app.control : app.preview;
      const host = new URL(mode === "gateway" ? app.base : app.previewBase).host;
      const prefix = mode === "gateway" ? "/_preview" : "";
      const asset = "/pages/pages.css";
      const request = (url: string, headers: Record<string, string> = { host }) => preview.inject({ url: prefix + url, headers });
      const cache = "private, max-age=3600, immutable";
      const published = await request(`/r/${revisionId}${asset}`);
      expect(published.statusCode).toBe(200);
      expect(published.headers["cache-control"]).toBe(cache);
      if (mode === "gateway") expect(published.headers["access-control-allow-origin"]).toBe("null");

      for (const [url, status] of [
        [`/r/${revisionId}/pages/login.html`, 200],
        ["/bridge.js", 200],
        [`/r/${revisionId}/missing.css`, 400],
        ["/r/unknown/pages/pages.css", 404],
      ] as const) {
        const response = await request(url);
        expect(response.statusCode).toBe(status);
        expect(response.headers["cache-control"]).toBe("no-store");
      }
      const denied = await request(`/r/${revisionId}${asset}`, { host: "unapproved.test" });
      expect(denied.statusCode).toBe(403);
      expect(denied.headers["cache-control"]).toBe("no-store");
      const api = await app.control.inject({
        url: `/api/sessions/${sessionId}/context`,
        headers: { host: new URL(app.base).host, authorization: `Bearer ${app.token}` },
      });
      expect(api.statusCode).toBe(200);
      expect(api.headers["cache-control"]).toBe("no-store");
      const scope = api.json().previewHtmlCacheScope;
      expect(scope).toMatch(/^[a-f0-9]{32}$/);
      const html = (revision: string, key = scope) =>
        `/r/${revision}/pages/login.html?${previewHtmlCacheParam}=${key}`;
      const htmlPolicy = "private, max-age=60, must-revalidate";
      const fresh = await request(html(revisionId));
      expect(fresh.statusCode).toBe(200);
      expect(fresh.headers["cache-control"]).toBe(htmlPolicy);
      const bridgeSrc = fresh.body.match(/<script src="([^"]*\/bridge\.js\?[^"]+)"/)?.[1];
      expect(bridgeSrc).toBeDefined();
      const bridgeUrl = new URL(bridgeSrc!.replaceAll("&amp;", "&"), app.base);
      expect(bridgeUrl.pathname).toBe(prefix + "/bridge.js");
      if (mode === "gateway") expect(bridgeUrl.searchParams.get("port")).toBe("4173");
      const bridge = await request("/bridge.js" + bridgeUrl.search);
      expect(bridge.statusCode).toBe(200);
      expect(bridge.headers["cache-control"]).toBe(cache);
      expect(bridgeUrl.searchParams.get("v")).toBe(createHash("sha256").update(bridge.rawPayload).digest("hex"));
      const mismatchedBridge = await request("/bridge.js?v=obsolete");
      expect(mismatchedBridge.statusCode).toBe(200);
      expect(mismatchedBridge.body).toBe(bridge.body);
      expect(mismatchedBridge.headers["cache-control"]).toBe("no-store");
      const etag = fresh.headers.etag as string;
      expect(etag).toMatch(/^W\/"[a-f0-9]{64}"$/);
      for (const validator of [etag, `"stale", ${etag.slice(2)}`, "*"]) {
        const current = await request(html(revisionId), { host, "if-none-match": validator });
        expect(current.statusCode).toBe(304);
        expect(current.body).toBe("");
        expect(current.headers.etag).toBe(etag);
        expect(current.headers["cache-control"]).toBe(htmlPolicy);
        if (mode === "gateway") expect(current.headers["access-control-allow-origin"]).toBe("null");
      }
      const changed = await request(html(revisionId), { host, "if-none-match": '"stale"' });
      expect(changed.statusCode).toBe(200);
      const embeddedWildcard = await request(html(revisionId), { host, "if-none-match": '"old,*,tag"' });
      expect(embeddedWildcard.statusCode).toBe(200);
      const retiredScope = await request(html(revisionId, "a-different-scope"), { host, "if-none-match": etag });
      expect(retiredScope.statusCode).toBe(200);
      expect(retiredScope.headers["cache-control"]).toBe("no-store");
      expect(retiredScope.headers.etag).toBeUndefined();
      const deniedHtml = await request(html(revisionId), { host: "unapproved.test", "if-none-match": etag });
      expect(deniedHtml.statusCode).toBe(403);
      expect(deniedHtml.headers["cache-control"]).toBe("no-store");

      const login = path.join(designRoot, "pages/login.html");
      const oldLogin = await readFile(login, "utf8");
      await writeFile(login, oldLogin.replace("欢迎回来", "New revision"));

      const newer = await app.session.publish({
        source: "conversation",
        request: "Check cache policy across publication",
        idempotencyKey: "cache-test",
        expectedBaseRevision: revisionId,
      }, async (candidate) => {
        app.candidates.set(candidate.id, candidate);
        try {
          const response = await request(`/r/${candidate.id}${asset}`);
          expect(response.statusCode).toBe(200);
          expect(response.headers["cache-control"]).toBe("no-store");
          const candidateHtml = await request(html(candidate.id), { host, "if-none-match": "*" });
          expect(candidateHtml.statusCode).toBe(200);
          expect(candidateHtml.headers["cache-control"]).toBe("no-store");
          expect(candidateHtml.headers.etag).toBeUndefined();
        } finally {
          app.candidates.delete(candidate.id);
        }
      });
      expect(newer.id).not.toBe(revisionId);
      expect((await request(`/r/${newer.id}${asset}`)).headers["cache-control"]).toBe(cache);
      expect((await request(`/r/${revisionId}${asset}`)).headers["cache-control"]).toBe(cache);
      const newHtml = await request(html(newer.id), { host, "if-none-match": etag });
      expect(newHtml.statusCode).toBe(200);
      expect(newHtml.headers.etag).not.toBe(etag);
      expect(newHtml.body).toContain("New revision");
      expect((await request(html(revisionId))).body).toContain("欢迎回来");

      const config = startSchema.parse({
        projectRoot: root,
        designRoot,
        host: "127.0.0.1",
        port: Number(new URL(app.internalBase).port),
        previewPort: Number(new URL(app.internalPreviewBase).port),
        ...(mode === "gateway" ? { publicBaseUrl: app.base } : {}),
      });
      await app.close();
      const reopened = server = await ReviewServer.start(config);
      const listener = mode === "gateway" ? reopened.control : reopened.preview;
      const get = (url: string, headers: Record<string, string>) => listener.inject({ url, headers });
      expect(reopened.info().sessionId).toBe(sessionId);
      const restartContext = await reopened.control.inject({
        url: `/api/sessions/${sessionId}/context`,
        headers: { host: new URL(reopened.base).host, authorization: `Bearer ${reopened.token}` },
      });
      expect(restartContext.statusCode).toBe(200);
      const newScope = restartContext.json().previewHtmlCacheScope;
      expect(newScope).not.toBe(scope);
      expect((await get(prefix + html(revisionId), { host, "if-none-match": etag })).headers["cache-control"]).toBe("no-store");
      const restartedHtml = await get(prefix + html(revisionId, newScope), { host, "if-none-match": etag });
      expect(restartedHtml.statusCode).toBe(200);
      expect(restartedHtml.headers["cache-control"]).toBe(htmlPolicy);
      expect(restartedHtml.headers.etag).not.toBe(etag);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

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
