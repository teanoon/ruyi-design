import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium } from "playwright";

const root = await mkdtemp(path.join(os.tmpdir(), "uxai-deleted-"));
const design = path.join(root, "design");
await mkdir(design);
await writeFile(path.join(design, "manifest.json"), JSON.stringify({ schemaVersion: 1, id: "deletion", name: "Deletion review", devices: [{ id: "desktop", name: "Desktop", width: 1000, height: 700 }], pages: [{ id: "settings", name: "设置", states: [{ id: "default", name: "默认", entries: { desktop: { path: "index.html" } } }] }] }));
const html = '<!doctype html><html><head><title>Settings</title></head><body><h1>设置</h1><div id="actions" style="padding:40px;border:1px solid #ccc"><span data-review-id="remove-me">将被删除的说明</span><button>保存更改</button></div></body></html>';
await writeFile(path.join(design, "index.html"), html);
const client = new Client({ name: "deleted-review-test", version: "1" });
const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/cli/index.js"), "mcp"], stderr: "pipe" });
let browser;
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  const result = r.structuredContent ?? JSON.parse(r.content[0].text);
  assert(!r.isError, JSON.stringify(result));
  return result;
};
try {
  await client.connect(transport);
  const info = await call("ruyi_design_start_review", { projectRoot: root, designRoot: design });
  const sid = { sessionId: info.sessionId };
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(info.reviewUrl);
  const frame = () => page.frameLocator("iframe").first();
  await frame().getByText("将被删除的说明", { exact: true }).click();
  await page.getByLabel("评论内容").fill("删除说明");
  await page.getByRole("button", { name: "保存评论", exact: true }).click();
  await page.waitForFunction(() => document.getElementById("pending-count")?.textContent === "1 条评论待处理");
  const batch = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "delete" });
  const lease = await call("ruyi_design_claim_batch", { ...sid, batchId: batch.id, owner: "test", idempotencyKey: "claim" });
  await writeFile(path.join(design, "index.html"), html.replace('<span data-review-id="remove-me">将被删除的说明</span>', ''));
  await call("ruyi_design_update_feedback", { ...sid, batchId: batch.id, leaseToken: lease.leaseToken, action: "modified", commentId: batch.items[0].id, message: "已删除说明", scope: "instance" });
  const revision = await call("ruyi_design_publish_revision", { ...sid, batchId: batch.id, leaseToken: lease.leaseToken, idempotencyKey: "publish", expectedBaseRevision: info.revisionId });
  await call("ruyi_design_set_feedback_location", { ...sid, commentId: batch.items[0].id, revisionId: revision.id, location: { kind: "deleted", container: { selector: "#actions", tag: "DIV" } } });
  await page.locator("#revision .revision-full").filter({ hasText: revision.id.slice(0, 8) }).waitFor();
  // Reload once to ensure the comment's newly recorded location is loaded.
  await page.reload();
  await page.getByRole("button", { name: "定位", exact: true }).click();
  await page.getByText("已定位到保留的父容器：此处已删除。", { exact: true }).waitFor();
  await frame().getByText("此处已删除", { exact: true }).waitFor();
  assert.equal(await frame().getByText("将被删除的说明", { exact: true }).count(), 0);
  const box = await frame().locator("#actions").boundingBox();
  const overlay = await frame().locator("[data-ruyi-design-overlay]").boundingBox();
  assert(Math.abs(box.x - overlay.x) < 2 && Math.abs(box.width - overlay.width) < 2);
  await page.getByRole("button", { name: "查看原版本", exact: true }).click();
  await page.getByText("已在原版本中定位元素。", { exact: true }).waitFor();
  await frame().getByText("将被删除的说明", { exact: true }).waitFor();
  assert.equal(await page.locator("#history-banner").isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "预览", exact: true }).isDisabled(), true);
  assert((await page.locator("iframe").getAttribute("src")).includes(info.revisionId));
  // A later publication must not replace the original snapshot being compared.
  const auth = new URLSearchParams(new URL(info.reviewUrl).hash.slice(1)).get("token");
  const saved = await fetch(new URL(info.reviewUrl).origin + `/api/sessions/${info.sessionId}/comments`, {
    method: "POST", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ text: "Another requested update", target: { kind: "page", objectId: "settings", stateId: "default", deviceId: "desktop", revisionId: revision.id } }),
  });
  assert(saved.ok);
  const second = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "second" });
  const secondLease = await call("ruyi_design_claim_batch", { ...sid, batchId: second.id, owner: "test", idempotencyKey: "second-claim" });
  await call("ruyi_design_update_feedback", { ...sid, batchId: second.id, leaseToken: secondLease.leaseToken, action: "modified", commentId: second.items[0].id, message: "Updated title", scope: "instance" });
  await writeFile(path.join(design, "index.html"), html.replace('<span data-review-id="remove-me">将被删除的说明</span>', '').replace('<h1>设置</h1>', '<h1>最新设置</h1>'));
  const latest = await call("ruyi_design_publish_revision", { ...sid, batchId: second.id, leaseToken: secondLease.leaseToken, idempotencyKey: "second-publish", expectedBaseRevision: revision.id });
  await page.getByText("新版本已发布，可返回最新版本查看；当前保留原版本对照。", { exact: true }).waitFor();
  assert((await page.locator("iframe").getAttribute("src")).includes(info.revisionId));
  assert.equal(new URL(page.url()).searchParams.get("revision"), info.revisionId);
  await page.reload();
  await frame().getByText("将被删除的说明", { exact: true }).waitFor();
  assert.equal(await page.locator("#history-banner").isVisible(), true);
  await page.getByRole("button", { name: "返回最新版本", exact: true }).click();
  await page.locator("#history-banner").waitFor({state:"hidden"});
  await page.getByText("已定位到保留的父容器：此处已删除。", {exact:true}).waitFor();
  await frame().getByRole("button", { name: "保存更改", exact: true }).waitFor();
  assert.equal(await frame().getByText("将被删除的说明", { exact: true }).count(), 0);
  assert.equal(await page.locator("#history-banner").isVisible(), false);
  const final = await call("ruyi_design_get_review_context", sid);
  assert.equal(final.revision.id, latest.id);
  assert.equal(final.comments[0].target.revisionId, info.revisionId);
  assert.equal(final.comments[0].status, "awaiting_review");
  assert.deepEqual(errors, []);
  await call("ruyi_design_end_review", sid);
  console.log("Deletion review passed: explicit parent marker, original immutable snapshot, current-version return, original target and human review preserved.");
} finally {
  await browser?.close();
  await client.close();
  await rm(root, { recursive: true, force: true });
}
