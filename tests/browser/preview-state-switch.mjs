import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export async function exercisePreviewStateSwitches(context, app, designRoot, mode) {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const documents = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" && /\/r\/[^/]+\//.test(new URL(request.url()).pathname))
      documents.push(request.url());
  });
  await page.addInitScript(() => {
    window.addEventListener("message", ({ data }) => {
      if (data?.type === "ready" && data.channel === "ruyi-design") window.readyFrame = data.frameId;
      if (data?.type === "apply-state" && data.channel === "ruyi-design") window.stateRequest = data;
    });
  });
  const initial = app.info();
  const iframe = page.locator("iframe");
  const frame = page.frameLocator("iframe");
  const frameName = () => iframe.getAttribute("name");
  const dropdown = page.locator("#state");
  const heading = frame.getByRole("heading", { name: "欢迎回来" });

  async function verify(state, expectedFrame) {
    await page.waitForFunction((expected) => new URLSearchParams(location.search).get("state") === expected, state);
    await page.waitForFunction(() => window.readyFrame === document.querySelector("iframe")?.name);
    assert.equal(await dropdown.inputValue(), state);
    assert.equal(await frame.locator("#email").inputValue(), state === "error" ? "xiaoman@" : "");
    assert.equal(await frame.getByText("请输入有效的邮箱地址", { exact: true }).isVisible(), state === "error");
    assert.equal(await frame.locator("#submit button").isDisabled(), state === "loading");
    if (expectedFrame) assert.equal(await frameName(), expectedFrame);
  }
  async function select(state, expectedFrame) {
    await dropdown.selectOption(state);
    await verify(state, expectedFrame);
  }
  async function holdTransition(state) {
    await frame.locator("body").evaluate(() => {
      window.stateRequest = undefined;
      window.ruyiDesignApplyState = () => new Promise(() => {});
    });
    await dropdown.selectOption(state);
    const child = await (await iframe.elementHandle()).contentFrame();
    await child.waitForFunction(() => !!window.stateRequest);
  }
  async function expectNewDocument(oldFrame, state) {
    await verify(state);
    assert.notEqual(await frameName(), oldFrame);
  }

  try {
    await page.goto(initial.reviewUrl);
    await verify("default");
    const defaultFrame = await frameName();
    const documentCount = documents.length;
    await frame.locator("body").evaluate(() => {
      document.querySelector("#remember").checked = true;
      document.querySelector("#recovery").showModal();
      document.querySelector("#recovery-email").value = "discard@example.test";
    });
    await select("error", defaultFrame);
    assert.equal(await frame.locator("#recovery").evaluate((dialog) => dialog.open), false);
    assert.equal(await frame.locator("#recovery-email").inputValue(), "");
    assert.equal(await frame.locator("#remember").isChecked(), false);
    const errorLink = new URL(page.url());
    await heading.evaluate((element) => {
      element.tabIndex = -1;
      element.focus();
    });
    await page.keyboard.press("ArrowUp");
    await verify("default", defaultFrame);
    assert.equal(documents.length, documentCount);
    console.log(`${mode} in-place A → B → A: 0 new preview HTML requests`);

    await frame.locator("#login-form").evaluate((form) => {
      form.querySelector("#email").value = "test@example.test";
      form.querySelector('input[type="password"]').value = "test-password";
      form.requestSubmit();
    });
    await frame.getByText("正在连接你的工作空间…", { exact: true }).waitFor();
    await select("error", defaultFrame);
    // Wait beyond the login fixture's scheduled navigation to check cancellation.
    await page.waitForTimeout(550);
    assert.equal(documents.length, documentCount);
    await select("default", defaultFrame);

    await page.goBack();
    await verify("error");
    await page.goForward();
    await verify("default");
    errorLink.hash = new URL(initial.reviewUrl).hash;
    const linked = await context.newPage();
    try {
      await linked.goto(errorLink.href);
      await linked.frameLocator("iframe").getByText("请输入有效的邮箱地址", { exact: true }).waitFor();
    } finally {
      await linked.close();
    }

    const fromHistory = await frameName();
    await select("error", fromHistory);
    const commentText = "State-specific feedback";
    await heading.click();
    await page.getByLabel("评论内容").fill(commentText);
    await page.getByRole("button", { name: "保存评论" }).click();
    const card = page.locator(".comment-card").filter({ hasText: commentText });
    await card.waitFor();
    const [saved] = app.session.context().comments.filter(({ text }) => text === commentText);
    assert.equal(saved.target.stateId, "error");
    assert.equal(saved.target.revisionId, initial.revisionId);
    assert.equal(new URL(saved.target.context.url).searchParams.get("state"), "error");
    assert.equal(new URL(saved.target.context.url).searchParams.has("__ruyi_html_cache"), false);
    assert.equal(saved.target.context.state.query.includes("state=error"), true);
    await select("default", fromHistory);

    await holdTransition("error");
    const request = await frame.locator("body").evaluate(() => window.stateRequest);
    const reply = { ...request, type: "state-applied",
      payload: { ...request.payload, ok: true } };
    await page.evaluate((message) => window.postMessage(message, location.origin), reply);
    await frame.locator("body").evaluate((message) => {
      // An outdated request ID from the correct frame must also be ignored.
      parent.postMessage({ ...message, payload: { ...message.payload, id: "outdated" } }, "*");
    }, reply);
    assert.equal(new URL(page.url()).searchParams.get("state"), "default");
    await expectNewDocument(fromHistory, "error"); // The handler timed out.

    const beforeReject = await frameName();
    await frame.locator("body").evaluate(() => { window.ruyiDesignApplyState = () => false; });
    await select("default");
    assert.notEqual(await frameName(), beforeReject);

    const beforeRapid = await frameName();
    await holdTransition("error");
    await select("loading");
    assert.notEqual(await frameName(), beforeRapid);
    await select("default");

    const beforeAlternate = await frameName();
    await select("alternate");
    assert.notEqual(await frameName(), beforeAlternate);
    assert.equal(new URL(await iframe.getAttribute("src")).pathname.endsWith("/login-alternate.html"), true);
    await select("default");

    // The iframe navigated to a different document that also implements the hook.
    // Selecting a declared state must return to the actual declared entry.
    const beforeInternalNav = await frameName();
    await Promise.all([
      page.waitForEvent("framenavigated", (child) => child.url().includes("login-alternate.html")),
      frame.locator("body").evaluate(() => {
        const url = new URL(location.href);
        url.pathname = url.pathname.replace(/login\.html$/, "login-alternate.html");
        location.assign(url.href);
      }),
    ]);
    await select("error");
    assert.notEqual(await frameName(), beforeInternalNav);
    assert.equal(new URL(await iframe.getAttribute("src")).pathname.endsWith("/login.html"), true);
    await select("default");

    await appendFile(path.join(designRoot, "pages/login.js"), "\n// State race test revision.\n");
    const next = await app.session.publish({
      source: "conversation",
      request: "Exercise version navigation during an in-place transition",
      expectedBaseRevision: initial.revisionId,
      idempotencyKey: "preview-state-version-race",
    }, () => holdTransition("error"));
    await page.waitForFunction((id) => document.querySelector("iframe")?.src.includes(`/r/${id}/`), next.id);
    await verify("error");
    assert.equal(app.session.context().comments.find(({ id }) => id === saved.id).target.revisionId, initial.revisionId);

    await holdTransition("loading");
    await card.getByRole("button", { name: "查看原版本" }).click();
    await page.getByText("已在原版本中定位元素。", { exact: true }).waitFor();
    await verify("error");
    assert.equal(new URL(page.url()).searchParams.get("revision"), saved.target.revisionId);
    await page.locator("#return-latest").click();
    await page.getByText("已切换到评论对应的设计并定位元素。", { exact: true }).waitFor();
    await verify("error");
  } finally {
    await page.close();
  }
}

export async function exerciseStarterPageStates(context, app, mode) {
  const cases = {
    login: {
      default: "#email:enabled:not([aria-invalid])",
      error: '#email[aria-invalid="true"]',
      loading: "#email:disabled",
    },
    home: {
      default: ".project-card",
      empty: '[data-review-id="empty-state"] h2',
      loading: ".loading-label",
      error: '[data-review-id="empty-action"]',
    },
    project: {
      default: ".project-overview",
      activity: ".detail-tabs + div .milestone",
    },
    settings: {
      default: '#profile-email:not([aria-invalid])',
      error: '#profile-email[aria-invalid="true"]',
      saved: ".success-banner:not([hidden])",
      notifications: "#digest:checked",
    },
  };
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  let requests = 0;
  page.on("request", (request) => {
    if (request.resourceType() === "document" && new URL(request.url()).pathname.endsWith(".html")) requests++;
  });
  await page.addInitScript(() => {
    window.addEventListener("message", ({ data }) => {
      if (data?.channel === "ruyi-design" && data.type === "ready" && data.payload?.canApplyState)
        window.optedInFrame = data.frameId;
    });
  });
  const iframe = page.locator("iframe");
  const frame = page.frameLocator("iframe");
  const manifest = app.session.active().manifest;
  try {
    for (const device of manifest.devices) {
      await page.setViewportSize({ width: device.width, height: device.height });
      for (const prototype of manifest.pages) {
        const link = new URL(app.info().reviewUrl);
        for (const [key, value] of Object.entries({ kind: "page", id: prototype.id, state: "default", device: device.id }))
          link.searchParams.set(key, value);
        await page.goto(link.href);
        await page.waitForFunction(() => !!window.optedInFrame && window.optedInFrame === document.querySelector("iframe")?.name);
        const name = await iframe.getAttribute("name");
        const tests = cases[prototype.id];
        await frame.locator(tests.default).first().waitFor();
        const before = requests;
        const defaultEntry = prototype.states.find(({ id }) => id === "default").entries[device.id];
        const states = prototype.states.filter(({ id, entries }) =>
          id !== "default" && entries[device.id]?.path === defaultEntry.path);

        for (const state of [...states.map(({ id }) => id), "default"]) {
          await page.locator("#state").selectOption(state);
          await page.waitForFunction((value) => new URLSearchParams(location.search).get("state") === value, state);
          await frame.locator(tests[state]).first().waitFor();
          assert.equal(await iframe.getAttribute("name"), name, `${mode} ${prototype.id}/${device.id}/${state}`);
          if (prototype.id === "home") {
            if (state === "empty") await frame.getByText("还没有项目，好想法正等着开始。").waitFor();
            if (state === "error") await frame.getByText("项目暂时没有加载出来").waitFor();
            assert.equal(await frame.locator('[data-review-id="new-project"]').isDisabled(), ["loading", "error"].includes(state));
          }
          if (prototype.id === "project" && state === "activity")
            await frame.getByRole("heading", { name: "每一步，都有迹可循" }).waitFor();
        }
        assert.equal(requests, before, `${mode} ${prototype.id}/${device.id} requested another HTML document`);
        console.log(`${mode} ${prototype.id}/${device.id}: all same-entry states switched with 0 new HTML requests`);
      }
    }
  } finally {
    await page.close();
  }
}
