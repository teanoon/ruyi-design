import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import { ReviewServer, startSchema } from "../../dist/server/index.js";
import { combinations } from "../../dist/contracts/catalog.js";
const data = await mkdtemp(path.join(os.tmpdir(), "uxai-starter-test-"));
const root = process.cwd();
const server = await ReviewServer.start(
  startSchema.parse({
    projectRoot: root,
    designRoot: path.join(root, "examples/starter/design"),
    dataRoot: data,
  }),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
    failures.push(`${r.status()} ${r.url()}`);
});
const manifest = server.session.active().manifest,
  revision = server.session.active().id;
const url = (file, state = "default") =>
  `${server.previewBase}/r/${revision}/${file}${state === "default" ? "" : "?state=" + state}`;
try {
  await mkdir("test-results/starter", { recursive: true });
  // All page and component state/device entries must load without errors or horizontal overflow.
  for (const combo of combinations(manifest)) {
    const d = manifest.devices.find((d) => d.id === combo.deviceId);
    await page.setViewportSize({ width: d.width, height: d.height });
    const u = new URL(`/r/${revision}/${combo.entry.path}`, server.previewBase);
    for (const [k, v] of Object.entries(combo.entry.query ?? {}))
      u.searchParams.set(k, v);
    await page.goto(u.href, { waitUntil: "networkidle" });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Horizontal overflow: ${combo.objectId}/${combo.stateId ?? combo.exampleId}/${combo.deviceId}`,
    );
  }
  // Token documentation must agree with actual shared CSS, not a disconnected swatch collection.
  const css = await readFile(
    "examples/starter/design/tokens/tokens.css",
    "utf8",
  );
  for (const t of manifest.tokens)
    assert(
      css.includes(`${t.cssVariable}: ${t.value}`),
      `Token mismatch: ${t.id}`,
    );
  for (const device of manifest.devices) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto(url("pages/login.html"));
    await page.getByRole("button", { name: "登录工作空间" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "请填写有效的邮箱地址" })
      .waitFor();
    await page.locator("#email").fill("xiaoman@studio.design");
    await page.locator("#password").fill("demo-password");
    await page.getByRole("button", { name: "登录工作空间" }).click();
    await page.waitForURL("**/pages/home.html");
    await page.getByRole("heading", { name: "早上好，小满" }).waitFor();
    assert.equal(await page.locator(".project-card").count(), 3);
    await page.getByLabel("搜索项目", { exact: true }).fill("品牌");
    assert.equal(await page.locator(".project-card").count(), 1);
    await page.getByLabel("搜索项目", { exact: true }).fill("");
    await page.getByRole("tab", { name: "已完成", exact: true }).click();
    await page
      .getByRole("heading", { name: "每一次完成，都值得期待。" })
      .waitFor();
    await page.getByRole("tab", { name: "全部项目", exact: true }).click();
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    await page.getByRole("button", { name: "创建项目", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "请先为项目填写名称" })
      .waitFor();
    await page.getByLabel("项目名称", { exact: true }).fill("验收新项目");
    await page.getByRole("button", { name: "创建项目", exact: true }).click();
    await page.getByRole("link", { name: "验收新项目", exact: true }).waitFor();
    assert.equal(await page.locator(".project-card").count(), 4);
    const dashboardState=await page.evaluate(()=>window.ruyiDesignReviewState.exportState());
    await page.reload();
    await page.evaluate(state=>window.ruyiDesignReviewState.restoreState(state),dashboardState);
    await page.getByRole('link',{name:'验收新项目',exact:true}).waitFor();
    await page.getByRole("link", { name: "产品体验升级", exact: true }).click();
    await page
      .getByRole("heading", { name: "产品体验升级", exact: true })
      .waitFor();
    await page.getByRole("checkbox", { name: /统一表单和按钮组件/ }).check();
    await page.getByRole("tab", { name: "项目动态" }).click();
    await page.getByRole("heading", { name: "每一步，都有迹可循" }).waitFor();
    await page.goto(url("pages/settings.html", "error"));
    await page.locator("#profile-email").fill("xiaoman@studio.design");
    await page.getByRole("button", { name: "保存更改", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "个人资料已保存，新的改变从这里开始。" })
      .waitFor();
    await page.getByRole("link", { name: "通知偏好", exact: true }).click();
    await page.locator("#digest").uncheck();
    assert(!(await page.locator("#digest").isChecked()));
    const settingsState=await page.evaluate(()=>window.ruyiDesignReviewState.exportState());
    await page.reload();
    await page.evaluate(state=>window.ruyiDesignReviewState.restoreState(state),settingsState);
    assert(!(await page.locator('#digest').isChecked()));
    await page.goto(url("pages/home.html"));
    await page.screenshot({
      path: `test-results/starter/dashboard-${device.id}.png`,
      fullPage: true,
    });
    await page.goto(url("pages/home.html", "empty"));
    await page.screenshot({
      path: `test-results/starter/empty-${device.id}.png`,
      fullPage: true,
    });
    await page.goto(url("pages/settings.html", "default"));
    await page.screenshot({
      path: `test-results/starter/settings-${device.id}.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(failures, []);
  console.log(
    `Starter passed: ${manifest.pages.length} pages, ${combinations(manifest).length} valid state/device entries, ${manifest.components.length} components, ${manifest.tokens.length} synchronized tokens; desktop/mobile interactions and screenshots verified.`,
  );
} finally {
  await browser.close();
  await server.close();
  await rm(data, { recursive: true, force: true });
}
