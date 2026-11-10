import Fastify from "fastify";
import { chromium } from "playwright";
import { mkdtemp, cp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { ReviewServer, startSchema } from "../../dist/server/index.js";
const root = await mkdtemp(path.join(os.tmpdir(), "uxai-gateway-"));
await cp("examples/starter/design", path.join(root, "design"), {
  recursive: true,
});
const gateway = Fastify({ logger: false });
let app;
const problems = [];
gateway.all("/*", async (req, reply) => {
  const url = new URL(req.url, "http://gateway");
  const selected =
    url.searchParams.get("port") ??
    req.headers.cookie?.match(/design_target_port=(\d+)/)?.[1];
  if (selected !== "4173")
    return reply.code(400).send({ error: "gateway port missing" });
  if (url.searchParams.has("port"))
    reply.header(
      "set-cookie",
      "design_target_port=4173; Path=/; HttpOnly; SameSite=Lax",
    );
  url.searchParams.delete("port");
  const headers = { ...req.headers, host: new URL(app.internalBase).host };
  delete headers["content-length"];
  if (headers.origin === new URL(gatewayBase).origin)
    headers.origin = new URL(app.internalBase).origin;
  const result = await app.control.inject({
    method: req.method,
    url: url.pathname + url.search,
    headers,
    payload: req.body ? JSON.stringify(req.body) : undefined,
  });
  if (result.statusCode >= 400)
    problems.push(
      `${result.statusCode} ${req.url} ${result.body.slice(0, 100)}`,
    );
  if (result.headers["content-type"])
    reply.type(String(result.headers["content-type"]));
  for (const key of [
    "access-control-allow-origin",
    "access-control-allow-credentials",
    "cross-origin-resource-policy",
  ])
    if (result.headers[key]) reply.header(key, result.headers[key]);
  return reply.code(result.statusCode).send(result.rawPayload);
});
const gatewayBase = await gateway.listen({ host: "127.0.0.1", port: 0 });
app = await ReviewServer.start(
  startSchema.parse({
    projectRoot: root,
    designRoot: path.join(root, "design"),
    publicBaseUrl: gatewayBase + "/?port=4173",
  }),
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  // Candidate validation uses the internal listener and must never depend on
  // gateway routing, cookies or the development gateway's TLS certificate.
  const local = await browser.newPage();
  const escaped = [];
  local.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(app.internalPreviewBase).origin)
      escaped.push(r.url());
  });
  await local.goto(`${app.internalPreviewBase}/r/${app.info().revisionId}/pages/login.html`);
  await local.locator("#email").waitFor();
  assert.deepEqual(escaped, []);
  await local.close();
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  await page.goto(app.info().reviewUrl);
  await page
    .getByRole("heading", { name: "登录 / 默认" })
    .waitFor({ timeout: 10000 });
  const frame = page.frameLocator("iframe").first();
  await frame.locator("#email").waitFor({ timeout: 10000 });
  // The fragment is removed after authentication; reload must retain access.
  assert.equal(new URL(page.url()).hash, "");
  await page.reload();
  await frame.locator("#email").waitFor({ timeout: 10000 });
  assert.equal(
    await frame.locator("body").evaluate(() => {
      try {
        void parent.document;
        return "accessible";
      } catch {
        return "isolated";
      }
    }),
    "isolated",
  );
  assert.equal(await page.locator("nav details").count(), 0);
  assert.equal(await page.getByRole("button", { name: "添加当前设计评论", exact: true }).count(), 0);
  await page.getByLabel("状态", { exact: true }).selectOption("error");
  await frame.getByText("请输入有效的邮箱地址", { exact: true }).waitFor();
  await page.getByLabel("设备", { exact: true }).selectOption("mobile");
  assert.equal(await page.locator("iframe").getAttribute("width"), "390");
  await page.getByLabel("状态", { exact: true }).selectOption("default");
  await page.getByLabel("设备", { exact: true }).selectOption("desktop");
  await frame.locator("#email").waitFor();
  await frame.getByRole("button", { name: "登录工作空间" }).click();
  await page.getByLabel("评论内容").fill("Gateway feedback");
  await page.getByRole("button", { name: "保存评论" }).click();
  await page.getByText("Gateway feedback", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "提交给 AI", exact: true }).count(), 0);
  await page.waitForFunction(() => document.getElementById("pending-count")?.textContent === "1 条评论待处理");
  assert.equal(app.session.context().comments.length, 1);
  assert.equal(app.session.context().batches.length, 0);
  assert.equal(app.session.context().activity, "idle");
  // Locate must navigate across pages and across states/devices of the same page.
  for (const name of ["工作台", "登录"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByLabel("状态", { exact: true }).selectOption("error");
    await page.getByLabel("设备", { exact: true }).selectOption("mobile");
    await page.getByRole("button", { name: "定位", exact: true }).click();
    await page.getByText("已切换到评论对应的设计并定位元素。", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("id"), "login");
    assert.equal(await page.getByLabel("状态", { exact: true }).inputValue(), "default");
    assert.equal(await page.getByLabel("设备", { exact: true }).inputValue(), "desktop");
    await frame.locator("[data-ruyi-design-overlay]").waitFor({ state: "visible" });
    const highlight = await frame.locator("[data-ruyi-design-overlay]").boundingBox();
    const target = await frame.getByRole("button", { name: "登录工作空间" }).boundingBox();
    assert(Math.abs(highlight.x - target.x) < 2 && Math.abs(highlight.y - target.y) < 2);
  }
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await frame.locator("#email").fill("review@example.test");
  await frame.locator("#password").fill("demo-password");
  await frame.getByRole("button", { name: "登录工作空间" }).click();
  await frame.getByRole("heading", { name: "早上好，小满" }).waitFor();
  await frame.getByRole("link", { name: "产品体验升级", exact: true }).click();
  await frame
    .getByRole("heading", { name: "产品体验升级", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Button 按钮", exact: true }).click();
  assert(new URL(page.url()).searchParams.get("port") === "4173");
  assert.equal(await page.locator("#state-control").isVisible(), false);
  await page.getByRole("button", { name: "退出预览", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "预览", exact: true }).getAttribute("aria-pressed"), "false");
  // A component's examples share a page: locate only the commented example.
  await frame.getByRole("button", { name: "保存更改", exact: true }).click();
  await page.getByLabel("评论内容").fill("Component locate feedback");
  await page.getByRole("button", { name: "保存评论" }).click();
  await page.getByText("Component locate feedback", { exact: true }).waitFor();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("设备", { exact: true }).selectOption("mobile");
  await page.locator(".comment-card").filter({ hasText: "Component locate feedback" }).getByRole("button", { name: "定位", exact: true }).click();
  await page.getByText("已切换到评论对应的设计并定位元素。", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("id"), "button");
  assert.equal(await page.locator("iframe").count(), 4);
  await frame.locator("[data-ruyi-design-overlay]").waitFor({ state: "visible" });
  const original = app.session.context().comments[0].target;
  app.session.feedback.add("Removed element feedback", {
    ...original,
    context: { anchor: { kind: "element", selector: "#removed-target" } },
  });
  await page.reload();
  await page.locator(".comment-card").filter({ hasText: "Removed element feedback" }).getByRole("button", { name: "定位", exact: true }).click();
  await page.getByText("定位已失效或存在歧义，保留原版本评论上下文。", { exact: true }).waitFor();
  assert.equal(await frame.locator("[data-ruyi-design-overlay]").isVisible(), false);
  console.log(
    "Gateway preview passed: routing query, rewritten Host/Origin, opaque-frame modules, saved element feedback without submission or agent monitoring, navigation.",
  );
  assert.deepEqual(problems, []);
  const forbidden = await app.control.inject({
    url: `/api/sessions/${app.session.id}/context`,
    headers: {
      host: new URL(app.internalBase).host,
      origin: "null",
      authorization: `Bearer ${app.token}`,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  const unauthenticated = await browser.newPage();
  await unauthenticated.goto(app.info().reviewUrl.split("#")[0]);
  await unauthenticated.getByText("工作区连接失败", { exact: true }).waitFor();
  await unauthenticated.getByText("请从 AI 客户端提供的评审链接打开工作区。", { exact: true }).waitFor();
  await unauthenticated.close();
} catch (e) {
  console.error(problems.slice(0, 15));
  throw e;
} finally {
  await browser.close();
  await app.close();
  await gateway.close();
  await rm(root, { recursive: true, force: true });
}
