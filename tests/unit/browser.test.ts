import { describe, it, expect, vi } from "vitest";
import type { Browser } from "playwright";
import { browserCandidates, diagnoseBrowser, launchValidationBrowser } from "../../src/core/browser/index.js";

function fakeBrowser(evaluate = async () => 2) {
  const context = { newPage: vi.fn(async () => ({ evaluate })), close: vi.fn(async () => {}) };
  const browser = { newContext: vi.fn(async () => context), close: vi.fn(async () => {}), version: () => "fixture-1" };
  return { browser: browser as unknown as Browser, context, close: browser.close };
}
describe("browser selection", () => {
  it.each([
    { RUYI_DESIGN_BROWSER_EXECUTABLE: "" },
    { RUYI_DESIGN_BROWSER_EXECUTABLE: "relative" },
    { RUYI_DESIGN_BROWSER_CHANNEL: "" },
    { RUYI_DESIGN_BROWSER_CHANNEL: "firefox" },
    { RUYI_DESIGN_BROWSER_CHANNEL: "chrome", RUYI_DESIGN_BROWSER_EXECUTABLE: "/browser" },
  ])("rejects explicit configuration without falling back: %j", async env => {
    const launch = vi.fn();
    expect((await diagnoseBrowser({ env, launch })).available).toBe(false);
    expect(launch).not.toHaveBeenCalled();
  });
  it("orders channels, platform Chromium and bundled, deduplicating symlinks", async () => {
    const candidates = await browserCandidates({ platform: "linux", env: { PATH: "/alias:/tools::relative:/mnt/c/Windows", WSL_DISTRO_NAME: "Ubuntu" }, bundledPath: "/bundled", canonical: async file => file === "/alias/chromium" ? "/usr/bin/chromium" : file });
    expect(candidates.slice(0, 3)).toEqual([{ source: "system", channel: "chrome" }, { source: "system", channel: "msedge" }, { source: "system", path: "/usr/bin/chromium" }]);
    expect(candidates.filter(c => c.path === "/alias/chromium")).toHaveLength(0);
    expect(candidates.some(c => c.path?.includes("/mnt/c/"))).toBe(false);
    expect(candidates.at(-1)).toEqual({ source: "playwright", path: "/bundled" });
  });
  it("enumerates macOS and Windows account/install paths", async () => {
    const canonical = async (s: string) => s;
    expect(await browserCandidates({ platform: "darwin", env: {}, home: "/Users/me", canonical })).toContainEqual({ source: "system", path: "/Users/me/Applications/Chromium.app/Contents/MacOS/Chromium" });
    expect(await browserCandidates({ platform: "win32", env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local", PROGRAMFILES: "C:\\Program Files", PATH: "C:\\tools;relative" }, canonical })).toContainEqual({ source: "system", path: "C:\\Program Files\\Chromium\\Application\\chrome.exe" });
  });
  it("deduplicates executable aliases of channel browsers", async () => {
    const candidates = await browserCandidates({ env: { PATH: "/tools" }, platform: "linux", canonical: async file => ["/tools/chromium", "/opt/google/chrome/chrome"].includes(file) ? "/same-chrome" : file });
    expect(candidates.some(c => c.path === "/tools/chromium")).toBe(false);
  });
  it("bounds candidate enumeration within the discovery budget", async () => {
    const launch = vi.fn();
    const result = await diagnoseBrowser({ env: {}, canonical: async () => new Promise<string>(() => {}), totalTimeout: 10, launch });
    expect(result.available).toBe(false);
    expect(result.attempts[0].error).toContain("discovery timed out");
    expect(launch).not.toHaveBeenCalled();
  });
  it.each(["chrome", "msedge"])("probes explicit %s and closes its isolated context", async channel => {
    const fixture = fakeBrowser();
    const launch = vi.fn(async () => fixture.browser);
    const result = await diagnoseBrowser({ env: { RUYI_DESIGN_BROWSER_CHANNEL: channel }, launch });
    expect(result).toMatchObject({ available: true, source: "explicit", channel, version: "fixture-1" });
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ channel, headless: true }));
    expect(fixture.context.close).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });
  it("does not fall back from an inaccessible explicit executable", async () => {
    const launch = vi.fn();
    const result = await diagnoseBrowser({ env: { RUYI_DESIGN_BROWSER_EXECUTABLE: "/no-permission" }, executable: async () => { throw new Error("EACCES"); }, launch });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].error).toBe("EACCES");
    expect(launch).not.toHaveBeenCalled();
  });
  it("falls back to installed Playwright after channel, permission and launch failures", async () => {
    const fixture = fakeBrowser();
    const launch = vi.fn(async options => {
      if (options.executablePath === "/bundled") return fixture.browser;
      throw new Error("not installed");
    });
    const { browser, diagnostics } = await launchValidationBrowser({ env: {}, bundledPath: "/bundled", launch, executable: async p => { if (p !== "/bundled") throw new Error("EACCES"); } });
    expect(diagnostics).toMatchObject({ available: true, source: "playwright" });
    expect(diagnostics.attempts[2].error).toBe("EACCES");
    expect(fixture.close).not.toHaveBeenCalled();
    await browser.close();
  });
  it("closes failed probes and continues automatic discovery", async () => {
    const broken = fakeBrowser(async () => { throw new Error("incompatible"); });
    const good = fakeBrowser();
    const launch = vi.fn().mockResolvedValueOnce(broken.browser).mockResolvedValueOnce(good.browser);
    const result = await diagnoseBrowser({ env: {}, launch });
    expect(result.channel).toBe("msedge");
    expect(broken.context.close).toHaveBeenCalledOnce();
    expect(broken.close).toHaveBeenCalledOnce();
  });
  it("bounds stalled probes and cleans up the browser", async () => {
    const fixture = fakeBrowser(() => new Promise(() => {}));
    const result = await diagnoseBrowser({ env: { RUYI_DESIGN_BROWSER_CHANNEL: "chrome" }, launch: async () => fixture.browser, attemptTimeout: 15 });
    expect(result.available).toBe(false);
    expect(result.attempts[0].error).toContain("timed out");
    expect(fixture.close).toHaveBeenCalledOnce();
  });
  it("cleans up launches completing after the deadline", async () => {
    const fixture = fakeBrowser();
    await diagnoseBrowser({ env: { RUYI_DESIGN_BROWSER_CHANNEL: "chrome" }, launch: async () => { await new Promise(r => setTimeout(r, 30)); return fixture.browser; }, attemptTimeout: 5 });
    await new Promise(r => setTimeout(r, 40));
    expect(fixture.close).toHaveBeenCalledOnce();
  });
  it("applies the total discovery budget across automatic candidates", async () => {
    const launch = vi.fn(async () => new Promise<Browser>(() => {}));
    const result = await diagnoseBrowser({ env: {}, launch, attemptTimeout: 15, totalTimeout: 20 });
    expect(result.available).toBe(false);
    expect(launch.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
