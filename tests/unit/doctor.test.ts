import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collectDoctor, doctorExitCode, renderDoctor } from "../../src/cli/doctor.js";
import type { BrowserDiagnostics } from "../../src/core/browser/index.js";

const edge: BrowserDiagnostics = {
  available: true, source: "system", channel: "msedge", version: "157.0.4341.42",
  attempts: [
    { source: "system", channel: "chrome", error: 'Chrome is not found\nRun "npx playwright install chrome"' },
    { source: "system", channel: "msedge" },
  ],
};
function fixture(browser = edge) {
  return {
    exists: (file: string) => !file.endsWith("bundled"),
    bundledPath: () => "/bundled", env: {}, node: "v24.16.0",
    resolveData: () => ({ path: "D:\\projects\\example\\.ruyi-design", source: "new" }),
    diagnose: vi.fn(async () => structuredClone(browser)),
  };
}
const options = { project: "/project" };
describe("doctor reports", () => {
  it("reports the Windows Edge fallback as success without irrelevant repairs", async () => {
    const deps = fixture();
    const report = await collectDoctor(options, deps);
    expect(report).toMatchObject({ status: "ok", chromium: false, workspace: true, bridge: true, recommendations: [], browser: { name: "Microsoft Edge", available: true, channel: "msedge" } });
    expect(report).not.toHaveProperty("browserInstall");
    expect(doctorExitCode(report)).toBe(0);
    const text = renderDoctor(report);
    for (const expected of ["检查结果：通过", "Microsoft Edge 157.0.4341.42", "浏览器来源：系统安装", "无需额外安装浏览器", "首次启动评审时创建"]) expect(text).toContain(expected);
    for (const hidden of ["chromium", "Chrome", "npx playwright", "警告", "写权限"]) expect(text).not.toContain(hidden);
    const verbose = renderDoctor(report, { verbose: true });
    expect(verbose.indexOf("检查结果：通过")).toBeLessThan(verbose.indexOf("未选用候选的诊断信息"));
    expect(verbose).toContain(edge.attempts[0].error);
    expect(verbose).toContain("msedge：已选用，通过启动检查");
    for (const mode of [{ json: true }, { json: true, verbose: true }]) {
      const json = renderDoctor(report, mode);
      expect(JSON.parse(json)).toEqual(report);
      expect(json).not.toContain("\u001b");
    }
    expect(deps.diagnose).toHaveBeenCalledTimes(1);
  });
  it("fails missing resources but keeps the usable browser and gives only resource advice", async () => {
    const report = await collectDoctor(options, { ...fixture(), exists: () => false });
    expect(report.status).toBe("error");
    expect(doctorExitCode(report)).toBe(1);
    expect(report.checks.browser.status).toBe("passed");
    expect(report.recommendations.map(r => r.code)).toEqual(["restore_workspace", "restore_bridge"]);
    expect(renderDoctor(report)).toContain("额外浏览器安装：不需要");
    expect(renderDoctor(report)).not.toContain("playwright install");
  });
  it("reports data ambiguity and truthfully skips subsequent checks", async () => {
    const deps = fixture();
    const report = await collectDoctor({ ...options, design: "/design" }, {
      ...deps, resolveData: () => { throw new Error("Multiple review data directories exist: /project/.ruyi-design, /project/.uxai-review"); },
    });
    expect(report.checks).toMatchObject({ data: { status: "failed" }, browser: { status: "not_checked" }, catalog: { status: "not_checked" } });
    expect(report).not.toHaveProperty("browser");
    expect(report).not.toHaveProperty("data");
    expect(report.status).toBe("error");
    expect(deps.diagnose).not.toHaveBeenCalled();
    expect(report.recommendations.map(r => r.code)).toEqual(["resolve_data_directory"]);
    expect(renderDoctor(report)).toContain("/project/.uxai-review");
    expect(renderDoctor(report)).not.toContain("--dataRoot");
  });
  it("does not create the new data directory or claim to test write permissions", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "doctor-unit-"));
    try {
      const { resolveData: ignored, ...deps } = fixture();
      const report = await collectDoctor({ project }, deps);
      expect(report.data?.source).toBe("new");
      expect(report.status).toBe("ok");
      expect(await readdir(project)).toEqual([]);
    } finally { await rm(project, { recursive: true, force: true }); }
  });
  it("reports invalid catalogs without blaming a working browser", async () => {
    const report = await collectDoctor({ ...options, design: "/bad" }, { ...fixture(), loadCatalog: async () => { throw new Error("Invalid catalog /bad/manifest.json"); } });
    expect(report.checks.catalog).toEqual({ status: "failed", message: "Invalid catalog /bad/manifest.json" });
    expect(report.checks.browser.status).toBe("passed");
    expect(report.status).toBe("error");
    expect(report.recommendations.map(r => r.code)).toEqual(["fix_catalog"]);
    expect(JSON.parse(renderDoctor(report, { json: true })).checks.catalog.status).toBe("failed");
  });
  it.each([
    ["conflict", { RUYI_DESIGN_BROWSER_EXECUTABLE: "/browser", RUYI_DESIGN_BROWSER_CHANNEL: "msedge" }, { source: "explicit", error: "mutually exclusive" }],
    ["empty channel", { RUYI_DESIGN_BROWSER_CHANNEL: "" }, { source: "explicit", error: "invalid channel" }],
    ["relative path", { RUYI_DESIGN_BROWSER_EXECUTABLE: "browser" }, { source: "explicit", error: "relative path" }],
    ["launch failure", { RUYI_DESIGN_BROWSER_CHANNEL: "msedge" }, { source: "explicit", channel: "msedge", error: "launch failed" }],
  ] as const)("fixes explicit %s without suggesting another browser", async (_label, env, attempt) => {
    const report = await collectDoctor(options, { ...fixture({ available: false, attempts: [attempt] }), env });
    expect(report.status).toBe("error");
    expect(report.recommendations.map(r => r.code)).toEqual(["fix_browser_configuration"]);
    expect(report).not.toHaveProperty("browserInstall");
    expect(renderDoctor(report)).not.toContain("playwright install");
    expect(report.browser?.attempts).toEqual([attempt]);
    if (_label === "conflict") expect(renderDoctor(report)).toContain("配置冲突");
  });
  it("provides alternative remedies only when automatic discovery fails", async () => {
    const report = await collectDoctor(options, fixture({ available: false, attempts: [{ source: "system", channel: "msedge", error: "missing" }] }));
    expect(report.status).toBe("error");
    expect(report.checks.browser.message).toBe("没有通过启动检查的浏览器");
    expect(report.recommendations.map(r => r.code)).toEqual(["select_existing_browser", "install_optional_chromium"]);
    expect(report.browserInstall).toBe("npx playwright install chromium");
    expect(renderDoctor(report)).toContain("可选方案");
  });
  it.each([
    [{ available: true, source: "system", path: "/usr/bin/chromium", attempts: [] }, "系统 Chromium", "系统安装"],
    [{ available: true, source: "explicit", path: "/custom/browser", attempts: [] }, "自定义浏览器", "显式指定"],
    [{ available: true, source: "playwright", attempts: [] }, "Playwright Chromium", "Playwright 安装"],
    [{ available: true, source: "explicit", channel: "chrome", attempts: [] }, "Google Chrome", "显式指定"],
  ] as const)("maps browser identities without guessing brands", async (browser, name, source) => {
    const report = await collectDoctor(options, fixture({ ...browser, attempts: [] }));
    const text = renderDoctor(report);
    expect(report.status).toBe("ok");
    expect(text).toContain(`${name} 版本未获取`);
    expect(text).toContain(`浏览器来源：${source}`);
    if ("path" in browser) expect(text).toContain(browser.path);
  });
});
