import assert from "node:assert/strict";
import { once } from "node:events";
import { appendFile, copyFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request } from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { ReviewServer, startSchema } from "../../dist/server/index.js";
import { exercisePreviewStateSwitches, exerciseStarterPageStates } from "./preview-state-switch.mjs";

const sharedFiles = ["pages.css", "login.js"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const browser = await chromium.launch();

async function exercise(mode) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-preview-cache-"));
  const designRoot = path.join(root, "design");
  const network = new Map();
  let app;
  let gateway;
  let publicBaseUrl;
  let cacheDisabled = false;
  function record(url) {
    const pathname = new URL(url, "http://review.test").pathname;
    network.set(pathname, (network.get(pathname) ?? 0) + 1);
  }
  try {
    await cp("examples/starter/design", designRoot, { recursive: true });
    const manifestPath = path.join(designRoot, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const login = manifest.pages.find(({ id }) => id === "login");
    for (const page of manifest.pages) page.components = [];
    login.states.push({
      id: "alternate", name: "另一入口", entries: { desktop: { path: "pages/login-alternate.html" } },
    });
    await copyFile(path.join(designRoot, "pages/login.html"), path.join(designRoot, "pages/login-alternate.html"));
    manifest.components = [];
    await writeFile(manifestPath, JSON.stringify(manifest));
    if (mode === "gateway") {
      gateway = createServer((incoming, outgoing) => {
        const url = new URL(incoming.url, publicBaseUrl);
        const selected = url.searchParams.get("port") ??
          incoming.headers.cookie?.match(/(?:^|; )review_target=(\d+)/)?.[1];
        if (selected !== "4173") {
          outgoing.writeHead(400).end("Missing port selection");
          return;
        }
        if (url.searchParams.has("port")) {
          outgoing.setHeader("Set-Cookie", "review_target=4173; Path=/; HttpOnly; SameSite=Lax");
        }
        url.searchParams.delete("port");
        const upstream = request(new URL(url.pathname + url.search, app.internalBase), {
          method: incoming.method,
          headers: incoming.headers,
        }, (response) => {
          outgoing.writeHead(response.statusCode, response.headers);
          response.pipe(outgoing);
        });
        upstream.on("error", (error) => outgoing.destroy(error));
        outgoing.on("close", () => upstream.destroy());
        incoming.pipe(upstream);
      });
      gateway.listen(0, "127.0.0.1");
      await once(gateway, "listening");
      publicBaseUrl = `http://review.test:${gateway.address().port}/?port=4173`;
    }
    app = await ReviewServer.start(startSchema.parse({ projectRoot: root, designRoot, publicBaseUrl }));
    const listener = mode === "gateway" ? app.control.server : app.preview.server;
    listener.prependListener("request", (incoming, outgoing) => {
      record(incoming.url);
      if (!cacheDisabled) return;
      // Reproduce the original no-store policy without intercepting browser requests.
      const writeHead = outgoing.writeHead.bind(outgoing);
      outgoing.writeHead = (status, ...args) => {
        const headers = args.at(-1);
        if (headers?.["cache-control"]?.startsWith("private,")) {
          args[args.length - 1] = { ...headers, "cache-control": "no-store" };
        }
        return writeHead(status, ...args);
      };
    });
    const info = app.info();
    const fileCount = (revision, file) =>
      network.get(`${mode === "gateway" ? "/_preview" : ""}/r/${revision}/pages/${file}`) ?? 0;
    const bridgeCount = () => network.get(mode === "gateway" ? "/_preview/bridge.js" : "/bridge.js") ?? 0;
    const counts = (revision) => sharedFiles.map((file) => fileCount(revision, file));
    const benchmarks = [];
    // Connect to the local test gateway using an ordinary HTTP origin.
    const browserOptions = gateway ? { proxy: { server: `http://127.0.0.1:${gateway.address().port}` } } : {};
    for (const originalPolicy of [true, false]) {
      cacheDisabled = originalPolicy;
      const context = await browser.newContext(browserOptions);
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("requestfailed", (failed) => {
          const pathname = new URL(failed.url()).pathname;
          const reason = failed.failure()?.errorText;
          if (pathname.endsWith("/events") && reason === "net::ERR_ABORTED") return;
          errors.push(`${pathname}: ${reason}`);
        });
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.addInitScript(() => {
          // Keep this test on document navigation so it exercises the cache.
          Object.defineProperty(window, "ruyiDesignApplyState", { set() {} });
          window.reviewReadyFrame = undefined;
          window.addEventListener("message", ({ data }) => {
            if (data?.channel === "ruyi-design" && data.type === "ready") window.reviewReadyFrame = data.frameId;
          });
        });
        const frame = page.frameLocator("iframe");
        async function ready(state, revisionId = info.revisionId) {
          await frame.locator("#email:enabled").waitFor();
          await frame.locator("#submit button:enabled").waitFor();
          assert.equal(await frame.locator("#email").inputValue(), state === "error" ? "xiaoman@" : "");
          if (state === "error") await frame.getByText("请输入有效的邮箱地址", { exact: true }).waitFor();
          const iframe = page.locator("iframe");
          assert.match(await iframe.getAttribute("name"), uuidV4);
          assert(new URL(await iframe.getAttribute("src")).pathname.includes(`/r/${revisionId}/`));
          await page.waitForFunction(() => window.reviewReadyFrame === document.querySelector("iframe")?.name);
        }

        const beforeOpen = counts(info.revisionId);
        const bridgeBeforeOpen = bridgeCount();
        const response = await page.goto(info.reviewUrl);
        assert.equal(response?.status(), 200, `${mode} workspace document`);
        try {
          await ready("default");
        } catch (error) {
          throw new Error(`${mode} initial preview failed: ${errors.join("; ")}`, { cause: error });
        }
        const afterOpen = counts(info.revisionId);
        assert.deepEqual(afterOpen, beforeOpen.map((count) => count + 1));
        assert.equal(bridgeCount(), bridgeBeforeOpen + 1);
        const htmlAfterOpen = fileCount(info.revisionId, "login.html");
        const originalFrame = await page.locator("iframe").getAttribute("name");
        const timings = [];
        for (const state of ["error", "default", "error", "default", "error", "default"]) {
          const started = performance.now();
          await page.locator("#state").selectOption(state);
          await ready(state);
          timings.push(Math.round(performance.now() - started));
        }
        assert.deepEqual(
          counts(info.revisionId),
          afterOpen.map((count) => count + (cacheDisabled ? timings.length : 0)),
          `${mode} resource requests with cache ${cacheDisabled ? "disabled" : "enabled"}`,
        );
        assert.notEqual(await page.locator("iframe").getAttribute("name"), originalFrame);
        assert.equal(fileCount(info.revisionId, "login.html") - htmlAfterOpen, cacheDisabled ? timings.length : 1);
        assert.equal(bridgeCount() - bridgeBeforeOpen, cacheDisabled ? timings.length + 1 : 1);
        benchmarks.push({ cacheDisabled, timings });

        if (!cacheDisabled) {
          const loginBeforeNavigation = fileCount(info.revisionId, "login.html");
          const homeBeforeNavigation = fileCount(info.revisionId, "home.html");
          for (let visit = 0; visit < 2; visit++) {
            await page.getByRole("button", { name: "工作台", exact: true }).click();
            await frame.getByRole("heading", { name: "早上好，小满" }).waitFor();
            await page.getByRole("button", { name: "登录", exact: true }).click();
            await ready("default");
          }
          assert.equal(fileCount(info.revisionId, "login.html") - loginBeforeNavigation, 0);
          assert.equal(fileCount(info.revisionId, "home.html") - homeBeforeNavigation, 1);
          assert.equal(bridgeCount(), bridgeBeforeOpen + 1);
          console.log(`${mode} HTML cache: Login and Workspace reload as separate documents; only the first Workspace visit reaches the server`);
          if (mode === "gateway") {
            const capabilities = () => [window.isSecureContext, typeof crypto.randomUUID];
            assert.deepEqual(await page.evaluate(capabilities), [false, "undefined"]);
            assert.deepEqual(await frame.locator("body").evaluate(capabilities), [false, "undefined"]);
            const historyLength = await page.evaluate(() => history.length);
            await frame.getByRole("heading", { name: "欢迎回来" }).evaluate((heading) => {
              heading.tabIndex = -1;
              heading.focus();
            });
            await page.keyboard.press("ArrowDown");
            await page.waitForFunction(() => document.querySelector("#state").value === "error");
            await ready("error");
            assert.equal(await page.evaluate(() => history.length), historyLength + 1);
          }

          await appendFile(path.join(designRoot, "pages/pages.css"), "\nbody { --cache-test: updated; }\n");
          await appendFile(path.join(designRoot, "pages/login.js"), '\ndocument.body.dataset.cacheTest = "updated";\n');
          const revision = await app.publish({
            source: "conversation",
            request: "Update the cache test assets",
            idempotencyKey: "preview-cache-test",
            expectedBaseRevision: info.revisionId,
          });
          await page.waitForFunction((id) => document.querySelector("iframe")?.src.includes(`/r/${id}/`), revision.id);
          await ready(mode === "gateway" ? "error" : "default", revision.id);
          await frame.locator('body[data-cache-test="updated"]').waitFor();
          const cssMarker = (body) => getComputedStyle(body).getPropertyValue("--cache-test").trim();
          assert.equal(await frame.locator("body").evaluate(cssMarker), "updated");
          assert(counts(revision.id).every((count) => count > 0));

          const historical = new URL(info.reviewUrl);
          historical.searchParams.set("revision", info.revisionId);
          const beforeHistory = counts(info.revisionId);
          await page.goto(historical.href);
          await ready("default");
          assert.equal(await frame.locator("body").getAttribute("data-cache-test"), null);
          assert.equal(await frame.locator("body").evaluate(cssMarker), "");
          assert.deepEqual(counts(info.revisionId), beforeHistory);
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
    for (const { cacheDisabled, timings } of benchmarks) {
      console.log(`${mode} ${cacheDisabled ? "original no-store" : "private cache"} state switches (ms): ${timings.join(", ")}`);
    }
    const stateContext = await browser.newContext(browserOptions);
    try {
      await exercisePreviewStateSwitches(stateContext, app, designRoot, mode);
      await exerciseStarterPageStates(stateContext, app, mode);
    } finally {
      await stateContext.close();
    }
  } finally {
    await app?.close();
    if (gateway) await new Promise((resolve, reject) => gateway.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
}

try {
  await exercise("direct");
  await exercise("gateway");
} finally {
  await browser.close();
}
