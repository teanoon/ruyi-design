import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { ReviewServer, startSchema } from "../server/index.js";
import { ensure } from "../core/errors.js";
import { guide, packageRoot } from "../skills/index.js";
import { feedbackLocationSchema } from "../contracts/feedback.js";

export function createMcp() {
  const mcp = new McpServer(
    { name: "uxai-review", version: "0.1.0" },
    {
      instructions:
        "Read uxai://guides/prototype-review for the workflow. Start a review with explicit project paths. Saved comments never trigger work automatically. Only after the user explicitly asks to update from comments, read context, prepare_update, claim, edit repository files, record results and publish one round. Do not poll or monitor. Only the user confirms fixes.",
    },
  );
  const sessions = new Map<string, ReviewServer>();
  const session = (id: string) => {
    const s = sessions.get(id);
    ensure(s, "not_found", "Review session not found", 404);
    return s;
  };
  function tool(
    name: string,
    description: string,
    schema: z.ZodObject<any>,
    fn: (args: any, extra: any) => any,
    readOnly = false,
  ) {
    mcp.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (args, extra) => {
        try {
          const result = await fn(args, extra);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (e: any) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: {
                    code: e.code ?? "operation_failed",
                    message: e.message,
                  },
                }),
              },
            ],
          };
        }
      },
    );
  }
  const sid = { sessionId: z.string() };
  tool(
    "start_review",
    "Start the local prototype workspace. Read uxai://guides/prototype-review first.",
    startSchema,
    async (args) => {
      const project = await realpath(args.projectRoot),
        design = await realpath(args.designRoot);
      for (const s of sessions.values())
        if (
          s.session.projectRoot === project &&
          s.session.designRoot === design
        )
          return s.info();
      const s = await ReviewServer.start(args);
      sessions.set(s.session.id, s);
      return s.info();
    },
  );
  tool(
    "get_review_context",
    "Read catalog, published revision, feedback and activity.",
    z.object(sid),
    (args) => session(args.sessionId).session.context(),
    true,
  );
  tool(
    "prepare_update",
    "Only after the user explicitly asks to update from saved comments: freeze pending comments into one immutable processing snapshot. No browser submission is needed. Retrying the same key returns the same snapshot and excludes later comments. Read context first; reuse queued work before preparing another snapshot.",
    z.object({
      ...sid,
      idempotencyKey: z.string().min(1),
      commentIds: z.array(z.string()).min(1).optional(),
    }),
    (args) => session(args.sessionId).session.feedback.prepare(args.idempotencyKey, args.commentIds),
  );
  tool(
    "claim_batch",
    "Claim the earliest queued batch with a five-minute renewable lease.",
    z.object({
      ...sid,
      batchId: z.string(),
      owner: z.string().min(1),
      idempotencyKey: z.string().min(1),
    }),
    (args) =>
      session(args.sessionId).session.feedback.claim(
        args.batchId,
        args.owner,
        args.idempotencyKey,
      ),
  );
  tool(
    "get_feedback_context",
    "Read fixed batch input, current thread and prototype context.",
    z.object({ ...sid, batchId: z.string(), commentId: z.string() }),
    (args) => {
      const s = session(args.sessionId).session;
      const b = s.store.get("batch", args.batchId);
      ensure(b, "not_found", "Batch not found", 404);
      const item = b.items.find((c: any) => c.id === args.commentId);
      ensure(item, "not_found", "Comment not in batch", 404);
      return {
        input: item,
        current: s.feedback.comment(args.commentId),
        designRoot: s.designRoot,
      };
    },
    true,
  );
  tool(
    "update_feedback",
    "Renew lease, reply, ask a question, release for clarification or record modified/unaddressed result and instance/component/token scope.",
    z.object({
      ...sid,
      batchId: z.string(),
      leaseToken: z.string(),
      action: z.enum([
        "renew",
        "reply",
        "needs_clarification",
        "modified",
        "unaddressed",
        "release",
      ]),
      commentId: z.string().optional(),
      message: z.string().max(20000).default(""),
      scope: z.enum(["instance", "component", "token"]).default("instance"),
    }),
    (args) =>
      session(args.sessionId).session.feedback.update(
        args.batchId,
        args.leaseToken,
        args.action,
        args.commentId,
        args.message,
        args.scope,
      ),
  );
  tool(
    "publish_revision",
    "Validate the complete candidate and atomically publish. Record each batch result first; never resolve user feedback automatically.",
    z.object({
      ...sid,
      batchId: z.string(),
      leaseToken: z.string(),
      idempotencyKey: z.string().min(1),
      expectedBaseRevision: z.string(),
    }),
    (args) => session(args.sessionId).publish(args),
  );
  tool(
    "set_feedback_location",
    "After publishing a deletion, record the surviving parent container for that comment's modified result. Supply the published revisionId and an unambiguous container selector; never infer deletion from a failed lookup. Original comment targets remain unchanged.",
    z.object({ ...sid, commentId: z.string(), revisionId: z.string(), location: feedbackLocationSchema }),
    (args) => {
      const s = session(args.sessionId).session;
      ensure(s.store.get("revision", args.revisionId), "not_found", "Published revision not found", 404);
      return s.feedback.setLocation(args.commentId, args.revisionId, args.location);
    },
  );
  tool(
    "end_review",
    "Stop local listeners; retain project review records.",
    z.object(sid),
    async (args) => {
      const s = session(args.sessionId);
      sessions.delete(args.sessionId);
      await s.close();
      return { status: "ended" };
    },
  );
  const resources = [
    [
      "workflow",
      "uxai://guides/prototype-review",
      () => guide(),
      "text/markdown",
    ],
    [
      "manifest-schema",
      "uxai://schemas/manifest",
      () =>
        readFile(
          path.join(packageRoot, "schemas/manifest.schema.json"),
          "utf8",
        ),
      "application/json",
    ],
    [
      "manifest-template",
      "uxai://templates/manifest",
      () =>
        readFile(
          path.join(packageRoot, "examples/starter/design/manifest.json"),
          "utf8",
        ),
      "application/json",
    ],
  ] as const;
  for (const [name, uri, read, mimeType] of resources)
    mcp.registerResource(name, uri, { mimeType }, async () => ({
      contents: [{ uri, mimeType, text: await read() }],
    }));
  return {
    mcp,
    sessions,
    close: async () => {
      await Promise.all([...sessions.values()].map((s) => s.close()));
      sessions.clear();
      await mcp.close();
    },
  };
}
export async function runMcp() {
  const app = createMcp();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
  };
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
  process.stdin.once("end", () => {
    void close();
  });
  await app.mcp.connect(new StdioServerTransport());
}
