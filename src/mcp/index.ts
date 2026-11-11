import { publicationFields } from "../contracts/publication.js";
import { BRAND } from "../contracts/brand.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { ReviewServer, startSchema } from "../server/index.js";
import { ensure } from "../core/errors.js";
import { guide, packageRoot } from "../skills/index.js";
import { feedbackLocationSchema } from "../contracts/feedback.js";
import { packageVersion } from "../core/runtime.js";

export function createMcp() {
  const mcp = new McpServer(
    { name: BRAND.mcpName, version: packageVersion },
    {
      instructions:
        "Read ruyi-design://guides/review. Start with explicit project paths. Only explicit user requests authorize changes. For saved feedback: read context, prepare/claim a batch, edit, record results and publish. For direct requests in chat: read context, edit and publish source=conversation with the actual request and base revision in the same session; never fabricate comments or create a separate preview. Saved comments never trigger work automatically. Nonempty user follow-up replies automatically reopen comments outside queued/processing batches; do not ask for an extra reopen click. Replies during active batches remain for the next user-requested round after publication. Do not poll or monitor. Only the user confirms fixes. Reuse one discussion per element; no independent duplicate or card-level archive action is offered.",
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
    "ruyi_design_start_review",
    "Start the local prototype workspace. Read ruyi-design://guides/review first.",
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
    "ruyi_design_get_review_context",
    "Read catalog, published revision, feedback, activity and live runtime identity. Compare runtime.instanceId and packageVersion to verify a process restart; sessionId can persist.",
    z.object(sid),
    (args) => session(args.sessionId).context(),
    true,
  );
  tool(
    "ruyi_design_prepare_update",
    "Only after the user explicitly asks to update from saved comments: freeze pending comments into one immutable processing snapshot. No browser submission is needed. Retrying the same key returns the same snapshot and excludes later comments. Read context first; reuse queued work before preparing another snapshot.",
    z.object({
      ...sid,
      idempotencyKey: z.string().min(1),
      commentIds: z.array(z.string()).min(1).optional(),
    }),
    (args) => session(args.sessionId).session.feedback.prepare(args.idempotencyKey, args.commentIds),
  );
  tool(
    "ruyi_design_claim_batch",
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
    "ruyi_design_get_feedback_context",
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
    "ruyi_design_update_feedback",
    "Renew lease, reply, ask a question, release for clarification or record modified/unaddressed result and instance/component/token scope. After release, ask the user to save a reply and request another update; nonempty user replies reopen inactive feedback automatically.",
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
    "ruyi_design_publish_revision",
    "Validate and atomically publish in the current session. For explicit user requests in chat use source=conversation with request, idempotencyKey and expectedBaseRevision; omit batch/lease and leave comments untouched. For saved feedback use the existing batch/lease workflow. Never fabricate comments or resolve feedback automatically.",
    z.object({ ...sid, ...publicationFields }),
    (args) => session(args.sessionId).publish(args),
  );
  tool(
    "ruyi_design_set_feedback_location",
    "After publishing a deletion, record the surviving parent container for that comment's modified result. Supply the published revisionId and an unambiguous container selector; never infer deletion from a failed lookup. Original comment targets remain unchanged.",
    z.object({ ...sid, commentId: z.string(), revisionId: z.string(), location: feedbackLocationSchema }),
    (args) => {
      const s = session(args.sessionId).session;
      ensure(s.store.get("revision", args.revisionId), "not_found", "Published revision not found", 404);
      return s.feedback.setLocation(args.commentId, args.revisionId, args.location);
    },
  );
  tool(
    "ruyi_design_end_review",
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
      "ruyi-design://guides/review",
      () => guide(),
      "text/markdown",
    ],
    [
      "manifest-schema",
      "ruyi-design://schemas/manifest",
      () =>
        readFile(
          path.join(packageRoot, "schemas/manifest.schema.json"),
          "utf8",
        ),
      "application/json",
    ],
    [
      "manifest-template",
      "ruyi-design://templates/manifest",
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
