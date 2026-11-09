import type { PublicationInput } from "../contracts/publication.js";
import { BRAND } from "../contracts/brand.js";
import Fastify, { type FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ReviewSession } from "../core/sessions/index.js";
import { ensure, ReviewError } from "../core/errors.js";
import { safeFile } from "../core/catalog/index.js";
import { targetSchema } from "../contracts/catalog.js";
import type { Revision } from "../core/revisions/index.js";
import { validateRequest } from "./security/index.js";
import { validateRevision } from "./preview/validate.js";
import { routedUrl } from "../contracts/urls.js";
import {
  gatewayHtml,
  gatewayJavaScript,
  gatewayCss,
} from "./preview/gateway.js";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
export const startSchema = z.object({
  projectRoot: z.string(),
  designRoot: z.string(),
  dataRoot: z.string().optional(),
  host: z.string().default("127.0.0.1"),
  port: z.number().int().min(0).max(65535).default(0),
  previewPort: z.number().int().min(0).max(65535).default(0),
  publicBaseUrl: z.url().optional(),
  previewBaseUrl: z.url().optional(),
});
export type StartOptions = z.infer<typeof startSchema>;
export class ReviewServer {
  control: FastifyInstance;
  preview: FastifyInstance;
  token = randomBytes(32).toString("hex");
  base = "";
  previewBase = "";
  internalBase = "";
  internalPreviewBase = "";
  gatewayPreview = false;
  candidates = new Map<string, Revision>();
  streams = new Set<import("node:http").ServerResponse>();
  private constructor(public session: ReviewSession) {
    this.control = Fastify({ logger: false, bodyLimit: 256 * 1024 });
    this.preview = Fastify({ logger: false });
  }
  static async start(options: StartOptions) {
    const s = await ReviewSession.open(
      options.projectRoot,
      options.designRoot,
      options.dataRoot,
    );
    const server = new ReviewServer(s);
    try {
      await server.listen(options);
      return server;
    } catch (e) {
      await server.close();
      throw e;
    }
  }
  info() {
    const review = routedUrl(this.base, "");
    review.searchParams.set("session", this.session.id);
    review.hash = `token=${this.token}`;
    return {
      sessionId: this.session.id,
      reviewUrl: review.href,
      previewUrl: this.previewBase,
      revisionId: this.session.active()!.id,
      guideUri: BRAND.guideUri,
    };
  }
  private async listen(o: StartOptions) {
    // A port-selecting gateway has one browser origin and one sticky upstream.
    // Keep all its traffic on the workspace port; opaque frames isolate scripts.
    this.gatewayPreview =
      !!o.publicBaseUrl &&
      new URL(o.publicBaseUrl).searchParams.has("port") &&
      !o.previewBaseUrl;
    const errors = (err: any, _req: any, reply: any) =>
      reply.status(err.status ?? err.statusCode ?? 400).send({
        error: { code: err.code ?? "invalid_request", message: err.message },
      });
    this.control.setErrorHandler(errors);
    this.preview.setErrorHandler(errors);
    this.preview.addHook("onRequest", async (req, reply) => {
      if (this.previewBase) {
        ensure(
          [this.previewBase, this.internalPreviewBase]
            .filter(Boolean)
            .some((base) => new URL(base).host === req.headers.host),
          "invalid_host",
          "Invalid preview host",
          403,
        );
      }
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
    });
    this.preview.get("/bridge.js", async (_req, reply) =>
      reply
        .type("text/javascript")
        .send(await readFile(path.join(packageRoot, "dist/bridge/bridge.js"))),
    );
    this.preview.get("/r/:revision/*", async (req, reply) => {
      // Only requests multiplexed through the public gateway need URL rewriting.
      // Internal candidate validation must load resources from the local listener.
      const gatewayRequest = this.gatewayPreview &&
        req.headers["x-ruyi-design-gateway-preview"] === "1";
      const params = req.params as { revision: string; "*": string };
      ensure(
        /^[\w-]+$/.test(params.revision),
        "invalid_revision",
        "Invalid revision",
      );
      const revision =
        this.session.store.get<Revision>("revision", params.revision) ??
        this.candidates.get(params.revision);
      ensure(revision, "not_found", "Revision not found", 404);
      const root = path.join(
        this.session.dataRoot,
        "revisions",
        params.revision,
      );
      const file = await safeFile(root, params["*"]);
      const ext = path.extname(file);
      let body: Buffer | string = await readFile(file);
      if (ext === ".html") {
        let html = body.toString();
        const config = JSON.stringify({
          origin: new URL(this.base).origin,
          sessionId: this.session.id,
        }).replaceAll("<", "\\u003c");
        const bridgePath = gatewayRequest
          ? "/_preview/bridge.js"
          : "/bridge.js";
        const injection = `<script>window.${BRAND.configGlobal}=${config}</script><script src="${bridgePath}"></script>`;
        body = html.includes("</head>")
          ? html.replace("</head>", `${injection}</head>`)
          : injection + html;
      }
      if (gatewayRequest) {
        const publicUrl = routedUrl(
          this.previewBase,
          req.url.replace(/^\//, ""),
        ).href;
        if (ext === ".html") body = gatewayHtml(String(body), publicUrl);
        else if (ext === ".js" || ext === ".mjs")
          body = gatewayJavaScript(body.toString(), publicUrl);
        else if (ext === ".css") body = gatewayCss(body.toString(), publicUrl);
      }
      return reply.type(mime[ext] ?? "application/octet-stream").send(body);
    });
    this.control.addHook("onRequest", async (req, reply) => {
      if (this.base)
        validateRequest(
          req,
          this.base,
          req.url.startsWith("/api/") ? this.token : undefined,
          this.internalBase,
          this.gatewayPreview && req.url.startsWith("/_preview/"),
        );
      reply
        .header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer");
      if (req.url.startsWith("/api/"))
        ensure(
          req.url.startsWith(`/api/sessions/${this.session.id}/`),
          "wrong_session",
          "Unknown session",
          404,
        );
    });
    const prefix = `/api/sessions/${this.session.id}`;
    this.control.get(`${prefix}/context`, async () => ({
      ...this.session.context(),
      previewBase: this.previewBase,
      previewSandboxed: this.gatewayPreview,
    }));
    this.control.get(`${prefix}/revisions/:revision`, async (req) => {
      const id = (req.params as { revision: string }).revision;
      const revision = this.session.store.get<Revision>("revision", id);
      ensure(revision, "not_found", "Published revision not found", 404);
      return { id: revision.id, manifest: revision.manifest };
    });
    if (this.gatewayPreview) {
      this.control.get("/_preview/*", async (req, reply) => {
        const response = await this.preview.inject({
          method: "GET",
          url: req.url.replace(/^\/_preview/, ""),
          headers: {
            host: new URL(this.internalPreviewBase).host,
            "x-ruyi-design-gateway-preview": "1",
          },
        });
        // ES modules inside an opaque sandbox use Origin: null. Only public
        // prototype assets get this CORS response; the management API does not.
        reply.header("Access-Control-Allow-Origin", "null");
        reply.header("Cross-Origin-Resource-Policy", "cross-origin");
        return reply
          .code(response.statusCode)
          .type(
            String(
              response.headers["content-type"] ?? "application/octet-stream",
            ),
          )
          .send(response.rawPayload);
      });
    }
    this.control.post(`${prefix}/comments`, async (req) => {
      const body = z
        .object({ text: z.string(), target: targetSchema })
        .parse(req.body);
      this.session.validateTarget(body.target);
      return this.session.feedback.add(body.text, body.target);
    });
    this.control.patch(`${prefix}/comments/:id`, async (req) => {
      const body = z.object({ text: z.string() }).parse(req.body);
      return this.session.feedback.edit((req.params as any).id, body.text);
    });
    this.control.delete(`${prefix}/comments/:id`, async (req) =>
      this.session.feedback.edit((req.params as any).id),
    );
    this.control.post(`${prefix}/comments/:id/review`, async (req) => {
      const b = z
        .object({
          action: z.enum(["resolve", "archive", "reopen", "reply"]),
          message: z.string().max(20000).default(""),
        })
        .parse(req.body);
      return this.session.feedback.review(
        (req.params as any).id,
        b.action,
        b.message,
      );
    });
    this.control.get(`${prefix}/events`, async (req, reply) => {
      let cursor = z.coerce
        .number()
        .int()
        .min(0)
        .parse((req.query as any).cursor ?? 0);
      reply.hijack();
      const out = reply.raw;
      this.streams.add(out);
      out.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      out.write(": connected\n\n");
      const tick = () => {
        if (this.session.closed) return;
        const result = this.session.store.events(cursor);
        cursor = result.nextCursor;
        out.write(
          `id: ${cursor}\ndata: ${JSON.stringify({ ...result, activity: this.session.context().activity })}\n\n`,
        );
      };
      tick();
      const timer = setInterval(tick, 1000);
      out.on("close", () => {
        clearInterval(timer);
        this.streams.delete(out);
      });
    });
    this.control.get("/*", async (req, reply) => {
      const name =
        new URL(req.url, "http://localhost").pathname === "/"
          ? "index.html"
          : new URL(req.url, "http://localhost").pathname.slice(1);
      const file = await safeFile(
        path.join(packageRoot, "dist/workspace"),
        name,
      );
      return reply
        .type(mime[path.extname(file)] ?? "application/octet-stream")
        .send(await readFile(file));
    });
    const controlAddr = await this.control.listen({
      host: o.host,
      port: o.port,
    });
    const previewAddr = await this.preview.listen({
      host: o.host,
      port: o.previewPort,
    });
    const usable = (address: string) => {
      const u = new URL(address);
      if (
        o.host === "0.0.0.0" ||
        o.host === "::" ||
        u.hostname === "0.0.0.0" ||
        u.hostname === "[::]"
      )
        u.hostname = "127.0.0.1";
      return u.origin;
    };
    this.internalBase = usable(controlAddr);
    this.internalPreviewBase = usable(previewAddr);
    this.base = o.publicBaseUrl
      ? new URL(o.publicBaseUrl).href
      : this.internalBase;
    this.previewBase = this.gatewayPreview
      ? routedUrl(this.base, "_preview/").href
      : o.previewBaseUrl
        ? new URL(o.previewBaseUrl).href
        : this.internalPreviewBase;
    ensure(
      this.gatewayPreview ||
        new URL(this.base).origin !== new URL(this.previewBase).origin,
      "origin_conflict",
      "Workbench and preview must have different origins",
    );
  }
  async publish(input: PublicationInput) {
    return this.session.publish(input, async (revision) => {
      this.candidates.set(revision.id, revision);
      try {
        await validateRevision(revision, this.internalPreviewBase);
      } finally {
        this.candidates.delete(revision.id);
      }
    });
  }
  async close() {
    for (const s of this.streams) s.end();
    await Promise.all([this.control.close(), this.preview.close()]);
    this.session.close();
  }
}
