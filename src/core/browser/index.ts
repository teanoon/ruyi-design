import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import { ReviewError } from "../errors.js";

export interface BrowserCandidate {
  source: "explicit" | "system" | "playwright";
  channel?: "chrome" | "msedge";
  path?: string;
}
export interface BrowserDiagnostics extends Partial<BrowserCandidate> {
  available: boolean;
  version?: string;
  attempts: (BrowserCandidate & { error?: string })[];
}
interface Options {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  home?: string;
  bundledPath?: string;
  canonical?: (file: string) => Promise<string>;
  executable?: (file: string) => Promise<void>;
  launch?: (options: LaunchOptions) => Promise<Browser>;
  attemptTimeout?: number;
  totalTimeout?: number;
}
export const browserHelp = "Configure RUYI_DESIGN_BROWSER_EXECUTABLE (absolute path) or RUYI_DESIGN_BROWSER_CHANNEL (chrome/msedge), or install Chromium: npx playwright install chromium";

export async function browserCandidates(options: Options = {}): Promise<BrowserCandidate[]> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const p = platform === "win32" ? path.win32 : path.posix;
  const executable = env.RUYI_DESIGN_BROWSER_EXECUTABLE;
  const channel = env.RUYI_DESIGN_BROWSER_CHANNEL;
  if (executable !== undefined || channel !== undefined) {
    if (executable !== undefined && channel !== undefined)
      throw new Error("Browser EXECUTABLE and CHANNEL are mutually exclusive");
    if (executable !== undefined) {
      if (!executable.trim() || !p.isAbsolute(executable))
        throw new Error("RUYI_DESIGN_BROWSER_EXECUTABLE must be an absolute executable path");
      return [{ source: "explicit", path: executable }];
    }
    if (channel !== "chrome" && channel !== "msedge")
      throw new Error("RUYI_DESIGN_BROWSER_CHANNEL must be chrome or msedge");
    return [{ source: "explicit", channel }];
  }
  const candidates: BrowserCandidate[] = [];
  const home = options.home ?? os.homedir();
  const installDirs = [env.LOCALAPPDATA, env.PROGRAMFILES ?? env.ProgramFiles, env["PROGRAMFILES(X86)"] ?? env["ProgramFiles(x86)"]].filter((v): v is string => !!v);
  const paths = platform === "darwin"
    ? ["/Applications/Chromium.app/Contents/MacOS/Chromium", p.join(home, "Applications/Chromium.app/Contents/MacOS/Chromium")]
    : platform === "win32"
      ? installDirs.map(dir => p.join(dir, "Chromium/Application/chrome.exe"))
      : ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];
  for (const dir of (env.PATH ?? "").split(platform === "win32" ? ";" : ":")) {
    // Ignore relative/empty PATH entries and Windows mounts in WSL.
    if (!p.isAbsolute(dir) || (platform === "linux" && (env.WSL_DISTRO_NAME || env.WSL_INTEROP) && /^\/mnt\/[a-z]\//i.test(dir))) continue;
    for (const name of platform === "win32" ? ["chromium.exe"] : platform === "darwin" ? ["chromium", "Chromium"] : ["chromium", "chromium-browser"])
      paths.push(p.join(dir, name));
  }
  const canonical = options.canonical ?? realpath;
  const seen = new Set<string>();
  // Channel launch paths follow Playwright's stable Chrome/Edge locations.
  // Include their real paths in deduplication, including symlink aliases on PATH.
  for (const channel of ["chrome", "msedge"] as const) {
    const channelPaths = platform === "linux" ? [channel === "chrome" ? "/opt/google/chrome/chrome" : "/opt/microsoft/msedge/msedge"]
      : platform === "darwin" ? [channel === "chrome" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : installDirs.map(dir => p.join(dir, channel === "chrome" ? "Google/Chrome/Application/chrome.exe" : "Microsoft/Edge/Application/msedge.exe"));
    let duplicate = false;
    for (const file of channelPaths) {
      const key = await canonical(file).catch(() => undefined);
      if (key) {
        const normalized = platform === "win32" ? key.toLowerCase() : key;
        duplicate = seen.has(normalized);
        seen.add(normalized);
        break;
      }
    }
    if (!duplicate) candidates.push({ source: "system", channel });
  }
  for (const file of [...paths, options.bundledPath ?? chromium.executablePath()]) {
    let key = await canonical(file).catch(() => p.normalize(file));
    if (platform === "win32") key = key.toLowerCase();
    if (platform === "linux" && (env.WSL_DISTRO_NAME || env.WSL_INTEROP) && (/^\/mnt\/[a-z]\//i.test(key) || /\.exe$/i.test(key))) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ source: file === (options.bundledPath ?? chromium.executablePath()) ? "playwright" : "system", path: file });
  }
  return candidates;
}

export class BrowserUnavailable extends ReviewError {
  constructor(public diagnostics: BrowserDiagnostics) {
    super("validation_unavailable", `${browserHelp}. ${diagnostics.attempts.map(a => `${a.channel ?? a.path ?? a.source}: ${a.error ?? "ok"}`).join("; ")}`);
  }
}

/** Returns a checked, isolated browser. The caller owns and must close it. */
export async function launchValidationBrowser(options: Options = {}) {
  const diagnostics: BrowserDiagnostics = { available: false, attempts: [] };
  const deadline = Date.now() + (options.totalTimeout ?? 30000);
  let discoveryTimer: ReturnType<typeof setTimeout> | undefined;
  let candidates;
  try {
    candidates = await Promise.race([
      browserCandidates(options),
      new Promise<never>((_, reject) => { discoveryTimer = setTimeout(() => reject(new Error("Browser discovery timed out")), Math.max(1, deadline - Date.now())); }),
    ]);
  }
  catch (error) {
    const env = options.env ?? process.env;
    diagnostics.attempts.push({ source: env.RUYI_DESIGN_BROWSER_CHANNEL !== undefined || env.RUYI_DESIGN_BROWSER_EXECUTABLE !== undefined ? "explicit" : "system", error: String((error as Error).message) });
    throw new BrowserUnavailable(diagnostics);
  } finally { clearTimeout(discoveryTimer); }
  for (const candidate of candidates) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      diagnostics.attempts.push({ ...candidate, error: "Browser discovery timed out" });
      break;
    }
    const timeout = Math.min(options.attemptTimeout ?? 10000, remaining);
    let browser: Browser | undefined;
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = (async () => {
      if (candidate.path) await (options.executable ?? (file => access(file, constants.X_OK)))(candidate.path);
      if (expired) throw new Error("Browser check timed out");
      browser = await (options.launch ?? (opts => chromium.launch(opts)))({
        headless: true, timeout,
        ...(candidate.channel ? { channel: candidate.channel } : { executablePath: candidate.path }),
      });
      if (expired) { await browser.close(); throw new Error("Browser check timed out"); }
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        if (await page.evaluate(() => 1 + 1) !== 2) throw new Error("Browser script check failed");
      } finally { await context.close(); }
      return browser;
    })();
    try {
      const checked = await Promise.race([
        check,
        new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error("Browser check timed out")); }, timeout); }),
      ]);
      diagnostics.attempts.push(candidate);
      Object.assign(diagnostics, candidate, { available: true, version: checked.version() });
      return { browser: checked, diagnostics };
    } catch (error) {
      expired = true;
      await browser?.close().catch(() => {});
      // A late launch is also closed by check; absorb its eventual rejection.
      void check.catch(() => {});
      diagnostics.attempts.push({ ...candidate, error: (error as Error).message });
    } finally { clearTimeout(timer); }
  }
  throw new BrowserUnavailable(diagnostics);
}

export async function diagnoseBrowser(options: Options = {}): Promise<BrowserDiagnostics> {
  try {
    const { browser, diagnostics } = await launchValidationBrowser(options);
    await browser.close();
    return diagnostics;
  } catch (error) {
    if (error instanceof BrowserUnavailable) return error.diagnostics;
    throw error;
  }
}
