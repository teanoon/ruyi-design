import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const root = await mkdtemp(path.join(os.tmpdir(), "uxai-codex-interrupt-"));
await cp("examples/starter/design", path.join(root, "design"), {
  recursive: true,
});
const cli = path.resolve("dist/cli/index.js");
const reports = [];
function findInfo(o) {
  if (!o) return;
  if (typeof o === "string") {
    try {
      return findInfo(JSON.parse(o));
    } catch {
      return;
    }
  }
  if (typeof o !== "object") return;
  if (o.reviewUrl && o.sessionId) return o;
  for (const v of Object.values(o)) {
    const result = findInfo(v);
    if (result) return result;
  }
}
async function run(prompt, onEvent) {
  const args = [
    "exec",
    "--ignore-user-config",
    "--ephemeral",
    "--skip-git-repo-check",
    "--json",
    "-C",
    root,
    "-c",
    'approval_policy="never"',
    "-c",
    'sandbox_mode="workspace-write"',
    "-c",
    "sandbox_workspace_write.network_access=true",
    "-c",
    `mcp_servers.uxai_test.command=${JSON.stringify(process.execPath)}`,
    "-c",
    `mcp_servers.uxai_test.args=${JSON.stringify([cli, "mcp"])}`,
    "-c",
    "mcp_servers.uxai_test.required=true",
    prompt,
  ];
  const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
  let buffer = "",
    stderr = "",
    work = Promise.resolve();
  const events = [];
  child.stderr.on("data", (b) => (stderr += b));
  child.stdout.on("data", (b) => {
    buffer += b;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
      try {
        const e = JSON.parse(line);
        if (e.item?.type === "mcp_tool_call") {
          events.push({
            type: e.type,
            tool: e.item.tool,
            status: e.item.status,
          });
          work = work.then(() => onEvent(e, child));
        }
      } catch {
        /* Non-JSON diagnostic lines are not model tool events. */
      }
    }
  });
  const timer = setTimeout(() => child.kill("SIGINT"), 120000);
  const hard = setTimeout(() => child.kill("SIGKILL"), 135000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    await work;
    reports.push({ code, events, stderr: stderr.slice(-1500) });
    return { code, events };
  } finally {
    clearTimeout(timer);
    clearTimeout(hard);
  }
}
try {
  let info,
    interrupted = false,
    draftId;
  await run(
    `Bounded integration test. Use only uxai_test MCP tools. Do not edit files or run shell commands. Start review with projectRoot ${root} and designRoot ${root}/design, then read get_review_context. The test driver saves a comment and interrupts this session after startup; do not monitor or prepare an update.`,
    async (e, child) => {
      if (e.type === "item.completed" && e.item.tool === "start_review") {
        info = findInfo(e.item.result);
        assert(info);
        const url = new URL(info.reviewUrl),
          token = new URLSearchParams(url.hash.slice(1)).get("token");
        const response = await fetch(
          `${url.origin}/api/sessions/${info.sessionId}/comments`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              text: "Retain this draft through client interruption",
              target: {
                kind: "token",
                objectId: "primary",
                revisionId: info.revisionId,
              },
            }),
          },
        );
        assert(response.ok);
        draftId = (await response.json()).id;
        interrupted = true;
        child.kill("SIGINT");
      }

    },
  );
  assert(
    interrupted,
    "Did not interrupt the real client after saving a comment",
  );
  const resumed = await run(
    `Bounded integration test. Use only uxai_test MCP tools, no edits or shell. Start review with projectRoot ${root} and designRoot ${root}/design. Read get_review_context, verify the draft comment ID ${draftId} and revision ${info.revisionId} survived the earlier client interruption. Then call end_review and report the result.`,
    async () => {},
  );
  assert.equal(resumed.code, 0);
  assert(
    resumed.events.some(
      (e) => e.type === "item.completed" && e.tool === "get_review_context",
    ),
  );
  assert(
    resumed.events.some(
      (e) => e.type === "item.completed" && e.tool === "end_review",
    ),
  );
  console.log(
    "Real Codex interruption/reconnect passed: SIGINT after saving comments without monitoring, restart on the same data directory, retained draft and revision, clean shutdown.",
  );
} finally {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/codex-interruption-summary.json",
    JSON.stringify(reports, null, 2),
  );
  await rm(root, { recursive: true, force: true });
}
