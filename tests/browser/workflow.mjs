import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium } from "playwright";

export async function workflow({
  cli = path.resolve("dist/cli/index.js"),
  starter = path.resolve("examples/starter/design"),
  screenshot = true,
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "uxai-e2e-"));
  await cp(starter, path.join(root, "design"), { recursive: true });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, "mcp"],
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (b) => (stderr += b));
  const client = new Client({ name: "uxai-e2e", version: "1" });
  let browser;
  async function call(name, args) {
    const r = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 120000,
    });
    const data = JSON.parse(r.content[0].text);
    assert(!r.isError, `${name}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, "ruyi-design-mcp");
    const names = (await client.listTools()).tools.map((t) => t.name);
    assert.equal(names.length, 9);
    assert(names.includes("ruyi_design_set_feedback_location"));
    assert(names.includes("ruyi_design_prepare_update"));
    assert(!names.includes("wait_for_feedback"));
    assert(
      (
        await client.readResource({ uri: "ruyi-design://guides/review" })
      ).contents[0].text.includes("ruyi_design_publish_revision"),
    );
    const info = await call("ruyi_design_start_review", {
      projectRoot: root,
      designRoot: path.join(root, "design"),
    });
    const sid = { sessionId: info.sessionId };
    const initial = await call("ruyi_design_get_review_context", sid);
    assert.equal(initial.revision.id, info.revisionId);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(info.reviewUrl);
    await page.getByRole("heading", { name: "登录 / 默认" }).waitFor();
    const frame = () => page.frameLocator("iframe").first();
    await frame().getByRole("heading", { name: "欢迎回来" }).waitFor();
    await frame().locator("#email").fill("review@example.test");

    await frame().getByRole("button", { name: "登录工作空间" }).click();
    await page.getByLabel("评论内容").fill("增加登录按钮的留白。");
    await page.getByRole("button", { name: "保存评论" }).click();
    assert.equal(await page.getByRole("button", { name: "提交给 AI", exact: true }).count(), 0);
    await page.getByText("1 条评论待处理", { exact: true }).waitFor();
    const saved = await call("ruyi_design_get_review_context", sid);
    assert.equal(saved.comments.length, 1);
    assert.equal(saved.batches.length, 0);
    assert.equal(saved.activity, "idle");
    // This MCP call represents the user's explicit conversation request to update.
    const b = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "update-1" });
    const claimed = await call("ruyi_design_claim_batch", {
      ...sid,
      batchId: b.id,
      owner: "browser-test",
      idempotencyKey: "claim-1",
    });
    const lease = claimed.leaseToken;
    const item = await call("ruyi_design_get_feedback_context", {
      ...sid,
      batchId: b.id,
      commentId: b.items[0].id,
    });
    assert.equal(item.input.target.context.anchor.reviewId, "login-submit");
    assert.equal(item.input.target.deviceId, "desktop");
    assert(
      !JSON.stringify(item.input.target.context.state.fields).includes(
        "password",
      ),
    );
    const css = path.join(root, "design/components/shared.css");
    const original = await readFile(css, "utf8");
    await writeFile(css, original + "\n.ui-button{min-height:56px}\n");
    await frame().locator("#email").click();
    await page.getByLabel("评论内容").fill("这是下一轮的待处理评论。");
    await page.getByRole("button", { name: "保存评论" }).click();
    const frozenRetry = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "update-1" });
    assert.equal(frozenRetry.id, b.id);
    assert.equal(frozenRetry.items.length, 1);
    await call("ruyi_design_update_feedback", {
      ...sid,
      batchId: b.id,
      leaseToken: lease,
      commentId: b.items[0].id,
      action: "modified",
      message: "调整共享按钮高度，影响所有按钮实例。",
      scope: "component",
    });
    const rev = await call("ruyi_design_publish_revision", {
      ...sid,
      batchId: b.id,
      leaseToken: lease,
      idempotencyKey: "release-1",
      expectedBaseRevision: info.revisionId,
    });
    assert.equal(rev.mode, "styles");
    await page
      .getByText("版本 " + rev.id.slice(0, 8), { exact: true })
      .waitFor();
    assert.equal(
      await frame().locator("#email").inputValue(),
      "review@example.test",
    );
    assert.equal(await page.locator(".comment-card").count(), 2);
    const retry = await call("ruyi_design_publish_revision", {
      ...sid,
      batchId: b.id,
      leaseToken: lease,
      idempotencyKey: "release-1",
      expectedBaseRevision: info.revisionId,
    });
    assert.equal(retry.id, rev.id);
    // Old-version feedback opens its exact combination in the current revision.
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByLabel("状态", { exact: true }).selectOption("error");
    await page.getByLabel("设备", { exact: true }).selectOption("mobile");
    await page.locator(".comment-card").filter({ hasText: "增加登录按钮的留白。" }).getByRole("button", { name: "定位", exact: true }).click();
    await page.getByText("已切换到评论对应的设计并定位元素。", { exact: true }).waitFor();
    await frame().locator("[data-ruyi-design-overlay]").waitFor({ state: "visible" });
    assert.equal(await page.getByLabel("设备", { exact: true }).inputValue(), "desktop");
    assert.equal(await frame().locator("#email").inputValue(), "review@example.test");
    assert.equal((await call("ruyi_design_get_review_context", sid)).comments[0].target.revisionId, info.revisionId);
    await page.getByRole("button", { name: "确认解决" }).click();
    await page.getByText("已归档（1）", { exact: true }).waitFor();
    // A JS reload restores safe fields and preserves unsaved composer content.
    await frame().getByRole("button", { name: "登录工作空间" }).click();
    await page.getByLabel("评论内容").fill("尚未保存的输入也必须保留");
    const draft = (await call("ruyi_design_get_review_context", sid)).comments.find(
      (c) => c.status === "draft",
    );
    const base = new URL(info.reviewUrl).origin;
    const submit = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "update-2" });
    assert.deepEqual(submit.items.map((i) => i.id), [draft.id]);
    const claim2 = await call("ruyi_design_claim_batch", {
      ...sid,
      batchId: submit.id,
      owner: "browser-test",
      idempotencyKey: "claim-2",
    });
    await call("ruyi_design_update_feedback", {
      ...sid,
      batchId: submit.id,
      leaseToken: claim2.leaseToken,
      commentId: draft.id,
      action: "modified",
      message: "更新按钮模块。",
      scope: "component",
    });
    const js = path.join(root, "design/components/button.js"),
      originalJs = await readFile(js, "utf8");
    await writeFile(js, originalJs + "\n// Reviewed implementation\n");
    const rev2 = await call("ruyi_design_publish_revision", {
      ...sid,
      batchId: submit.id,
      leaseToken: claim2.leaseToken,
      idempotencyKey: "release-2",
      expectedBaseRevision: rev.id,
    });
    assert.equal(rev2.mode, "reload");
    await page
      .getByText("版本 " + rev2.id.slice(0, 8), { exact: true })
      .waitFor();
    await frame().locator("#email").waitFor();
    await page.waitForTimeout(300);
    assert.equal(
      await frame().locator("#email").inputValue(),
      "review@example.test",
    );
    assert.equal(
      await page.getByLabel("评论内容").inputValue(),
      "尚未保存的输入也必须保留",
    );
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("button", { name: "确认解决" }).click();
    // The component page shows every applicable state without a state menu.
    await page
      .getByRole("button", { name: "Button 按钮", exact: true })
      .click();
    assert.equal(await page.locator("iframe").count(), 4);
    await page.getByLabel("设备", { exact: true }).selectOption("mobile");
    assert.equal(await page.locator("iframe").count(), 3);
    await page.getByRole("button", { name: "设计令牌", exact: true }).click();
    assert.equal(
      await page.locator(".token-card").count(),
      initial.revision.manifest.tokens.length,
    );
    await page.getByRole("button", { name: "评论此令牌" }).first().click();
    await page.getByLabel("评论内容").fill("验证失败必须保留旧版。");
    await page.getByRole("button", { name: "保存评论" }).click();
    const b3 = await call("ruyi_design_prepare_update", { ...sid, idempotencyKey: "update-3" }),
      c3 = await call("ruyi_design_claim_batch", {
        ...sid,
        batchId: b3.id,
        owner: "browser-test",
        idempotencyKey: "claim-3",
      });
    await call("ruyi_design_update_feedback", {
      ...sid,
      batchId: b3.id,
      leaseToken: c3.leaseToken,
      commentId: b3.items[0].id,
      action: "modified",
      message: "候选测试",
      scope: "token",
    });
    await writeFile(
      js,
      originalJs + '\nthrow new Error("broken candidate");\n',
    );
    const failed = await client.callTool(
      {
        name: "ruyi_design_publish_revision",
        arguments: {
          ...sid,
          batchId: b3.id,
          leaseToken: c3.leaseToken,
          idempotencyKey: "failed-release",
          expectedBaseRevision: rev2.id,
        },
      },
      undefined,
      { timeout: 120000 },
    );
    assert(failed.isError);
    assert.equal((await call("ruyi_design_get_review_context", sid)).revision.id, rev2.id);
    // Invalid combinations fail visibly; deep links select the exact state/device.
    await page.goto(
      info.reviewUrl.replace(
        "/?",
        "/?kind=page&id=login&state=error&device=mobile&",
      ),
    );
    await page.getByRole("heading", { name: "登录 / 输入错误" }).waitFor();
    await frame().getByText("请输入有效的邮箱地址").waitFor();
    if (screenshot) {
      await mkdir("test-results", { recursive: true });
      await page.screenshot({
        path: "test-results/review-workspace.png",
        fullPage: true,
      });
    }
    const archive = page.locator(".comment-archive");
    assert.equal(await archive.getAttribute("open"), null);
    await archive.locator("summary").click();
    await archive.getByRole("button", { name: "重新打开", exact: true }).first().click();
    await page.getByText("1 条评论待处理", { exact: true }).waitFor();
    assert.equal((await call("ruyi_design_get_review_context", sid)).comments.filter(c => c.status === "draft").length, 1);
    assert.deepEqual(errors, []);
    await call("ruyi_design_end_review", sid);
    await assert.rejects(fetch(base));
    // Restart retains comment history and active revision, without Git.
    const restarted = await call("ruyi_design_start_review", {
      projectRoot: root,
      designRoot: path.join(root, "design"),
    });
    assert.equal(restarted.revisionId, rev2.id);
    assert(
      (await call("ruyi_design_get_review_context", { sessionId: restarted.sessionId }))
        .comments.length >= 3,
    );
    await call("ruyi_design_end_review", { sessionId: restarted.sessionId });
    console.log(
      "Browser + stdio MCP workflow passed: two publications, CSS and JS restoration, invalid candidate, components, tokens, restart.",
    );
  } finally {
    await browser?.close();
    await client.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
    if (stderr && !stderr.includes("ExperimentalWarning"))
      console.error(stderr);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await workflow();
