import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { ReviewServer, startSchema } from "../../dist/server/index.js";

const root = await mkdtemp(path.join(os.tmpdir(), "uxai-codex-"));
await cp("examples/starter/design", path.join(root, "design"), { recursive: true });
const cli = path.resolve("dist/cli/index.js");
const reports = [];
try {
  for (let round = 1; round <= 2; round++) {
    // The user saves comments before asking the coding client to update.
    const seed = await ReviewServer.start(startSchema.parse({ projectRoot: root, designRoot: path.join(root, "design") }));
    let comment;
    try {
      comment = seed.session.feedback.add(`User-requested round ${round}`, { kind: "token", objectId: "primary", revisionId: seed.info().revisionId });
      assert.equal(seed.session.context().batches.filter((b) => b.status === "queued").length, 0);
    } finally { await seed.close(); }
    const prompt = `I have saved review comments; please update from comment ${comment.id}. This is a bounded MCP communication test: use only uxai_test tools, no source edits or shell commands. Start review with projectRoot ${root} and designRoot ${root}/design, read get_review_context, call prepare_update once with commentIds ["${comment.id}"] and key codex-update-${round}, claim with owner codex-smoke and key codex-claim-${round}, read get_feedback_context, record needs_clarification with message "Integration test received", release the batch, then end_review. Do not monitor, poll, process other comments or start another round. Stop if a tool fails.`;
    const args = ["exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--json", "-C", root,
      "-c", 'approval_policy="never"', "-c", 'sandbox_mode="workspace-write"', "-c", "sandbox_workspace_write.network_access=true",
      "-c", `mcp_servers.uxai_test.command=${JSON.stringify(process.execPath)}`,
      "-c", `mcp_servers.uxai_test.args=${JSON.stringify([cli, "mcp"])}`,
      "-c", "mcp_servers.uxai_test.required=true", prompt];
    const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "", stderr = "";
    const events = [];
    child.stderr.on("data", (b) => stderr += b);
    child.stdout.on("data", (b) => {
      buffer += b;
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
        try {
          const e = JSON.parse(line);
          if (e.type === "item.completed" && e.item?.type === "mcp_tool_call") events.push({ tool: e.item.tool, status: e.item.status });
        } catch { /* CLI diagnostics are not protocol events. */ }
      }
    });
    const timer = setTimeout(() => child.kill("SIGINT"), 120000);
    const hard = setTimeout(() => child.kill("SIGKILL"), 135000);
    try {
      const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
      reports.push({ round, code, events, stderr: stderr.slice(-1500) });
      assert.equal(code, 0);
      for (const tool of ["start_review", "get_review_context", "prepare_update", "claim_batch", "get_feedback_context", "update_feedback", "end_review"]) assert(events.some((e) => e.tool === tool), tool);
      assert.equal(events.filter((e) => e.tool === "prepare_update").length, 1);
      assert(!events.some((e) => e.tool === "wait_for_feedback"));
      assert(events.every((e) => e.status === "completed"));
    } finally { clearTimeout(timer); clearTimeout(hard); child.kill("SIGTERM"); }
    const verify = await ReviewServer.start(startSchema.parse({ projectRoot: root, designRoot: path.join(root, "design") }));
    try { assert.equal(verify.session.feedback.comment(comment.id).status, "needs_clarification"); }
    finally { await verify.close(); }
  }
  console.log("Real Codex passed: two separate user-requested rounds, saved comments, prepared snapshots, clarification and release, no monitoring.");
} finally {
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/codex-smoke-summary.json", JSON.stringify(reports, null, 2));
  await rm(root, { recursive: true, force: true });
}
