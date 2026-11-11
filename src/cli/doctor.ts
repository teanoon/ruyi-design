import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BRAND } from "../contracts/brand.js";
import { diagnoseBrowser, type BrowserDiagnostics } from "../core/browser/index.js";
import { loadCatalog } from "../core/catalog/index.js";
import { resolveDataRoot } from "../core/sessions/data-root.js";
import { packageRoot } from "../skills/index.js";
import { packageVersion } from "../core/runtime.js";

type Check = { status: "passed" | "failed" | "not_checked"; message?: string };
type Recommendation = { code: string; message: string; command?: string };
export interface DoctorReport {
  product: string;
  package: string;
  packageVersion: string;
  node: string;
  status: "ok" | "error";
  summary: string;
  checks: Record<"data" | "workspace" | "bridge" | "browser" | "catalog", Check>;
  recommendations: Recommendation[];
  data?: ReturnType<typeof resolveDataRoot>;
  workspace: boolean;
  bridge: boolean;
  chromium: boolean;
  browser?: BrowserDiagnostics & { name?: string };
  catalog?: { id: string; pages: number; components: number };
  browserInstall?: string;
}
const defaults = {
  exists: (file: string) => existsSync(file),
  bundledPath: () => chromium.executablePath(),
  resolveData: resolveDataRoot,
  diagnose: diagnoseBrowser,
  loadCatalog,
  packageRoot,
  node: process.version,
  env: process.env,
};
export function browserName(browser: BrowserDiagnostics): string {
  if (browser.channel === "chrome") return "Google Chrome";
  if (browser.channel === "msedge") return "Microsoft Edge";
  if (browser.source === "playwright") return "Playwright Chromium";
  return browser.source === "system" ? "系统 Chromium" : "自定义浏览器";
}
function browserSource(browser: BrowserDiagnostics): string {
  return browser.source === "system" ? "系统安装" : browser.source === "playwright" ? "Playwright 安装" : "显式指定";
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Collect once; rendering never starts a browser or writes review data. */
export async function collectDoctor(
  options: { project: string; design?: string },
  dependencies: Partial<typeof defaults> = {},
): Promise<DoctorReport> {
  const deps = { ...defaults, ...dependencies };
  const workspace = deps.exists(path.join(deps.packageRoot, "dist/workspace/index.html"));
  const bridge = deps.exists(path.join(deps.packageRoot, "dist/bridge/bridge.js"));
  const report: DoctorReport = {
    product: `${BRAND.product} · ${BRAND.englishName}`, package: BRAND.packageName, packageVersion,
    node: deps.node, status: "error", summary: "", workspace, bridge,
    chromium: deps.exists(deps.bundledPath()),
    checks: {
      data: { status: "not_checked" },
      workspace: { status: workspace ? "passed" : "failed" },
      bridge: { status: bridge ? "passed" : "failed" },
      browser: { status: "not_checked" },
      catalog: { status: "not_checked", message: "未指定 --design" },
    },
    recommendations: [],
  };
  for (const [key, label] of [["workspace", "工作区资源"], ["bridge", "桥接脚本"]] as const) {
    if (!report[key]) report.recommendations.push({ code: `restore_${key}`, message: `${label}缺失，请重新安装软件包；源码开发环境请运行 npm run build。` });
  }
  try {
    report.data = deps.resolveData(options.project);
    report.checks.data = { status: "passed" };
  } catch (error) {
    report.checks.data = { status: "failed", message: errorMessage(error) };
    report.checks.browser.message = "数据目录解析失败，未执行浏览器检查";
    if (options.design) report.checks.catalog.message = "数据目录解析失败，未执行清单检查";
    report.recommendations.push({ code: "resolve_data_directory", message: "请确认应使用的评审数据目录，按照迁移文档处理目录选择；doctor 不会删除或合并目录。" });
    return finish(report);
  }
  try {
    const browser = await deps.diagnose();
    report.browser = { ...browser, ...(browser.available ? { name: browserName(browser) } : {}) };
    report.checks.browser = { status: browser.available ? "passed" : "failed" };
  } catch (error) {
    report.checks.browser = { status: "failed", message: errorMessage(error) };
  }
  if (report.checks.browser.status === "failed") {
    const env = deps.env;
    const explicit = env.RUYI_DESIGN_BROWSER_EXECUTABLE !== undefined || env.RUYI_DESIGN_BROWSER_CHANNEL !== undefined || report.browser?.attempts.some(a => a.source === "explicit");
    if (explicit) {
      const conflict = env.RUYI_DESIGN_BROWSER_EXECUTABLE !== undefined && env.RUYI_DESIGN_BROWSER_CHANNEL !== undefined;
      const message = conflict
        ? "浏览器配置冲突：RUYI_DESIGN_BROWSER_EXECUTABLE 与 RUYI_DESIGN_BROWSER_CHANNEL 只能保留一个。"
        : "显式指定的浏览器未通过检查：请检查 RUYI_DESIGN_BROWSER_CHANNEL 是否为 chrome/msedge，或 RUYI_DESIGN_BROWSER_EXECUTABLE 是否为有效绝对路径，并确认该浏览器能在当前环境启动。";
      report.checks.browser.message = message;
      report.recommendations.push({ code: "fix_browser_configuration", message });
    } else {
      report.checks.browser.message ??= "没有通过启动检查的浏览器";
      report.recommendations.push(
        { code: "select_existing_browser", message: "可使用同一运行环境中已安装的 Chrome/Edge，设置 RUYI_DESIGN_BROWSER_CHANNEL=chrome 或 msedge；也可通过 RUYI_DESIGN_BROWSER_EXECUTABLE 指定浏览器绝对路径。" },
        { code: "install_optional_chromium", message: "也可选择安装 Playwright Chromium（可选方案）。", command: "npx playwright install chromium" },
      );
      report.browserInstall = "npx playwright install chromium";
    }
  }
  if (options.design) {
    try {
      const catalog = await deps.loadCatalog(options.design);
      report.catalog = { id: catalog.id, pages: catalog.pages.length, components: catalog.components.length };
      report.checks.catalog = { status: "passed" };
    } catch (error) {
      report.checks.catalog = { status: "failed", message: errorMessage(error) };
      report.recommendations.push({ code: "fix_catalog", message: "请修复 --design 指定目录中的清单或所引用文件。" });
    }
  }
  return finish(report);
}
function finish(report: DoctorReport): DoctorReport {
  const labels = { data: "数据目录", workspace: "工作区资源", bridge: "桥接脚本", browser: "浏览器", catalog: "设计清单" };
  const failed = (Object.keys(labels) as (keyof typeof labels)[]).filter(key => report.checks[key].status === "failed");
  report.status = failed.length ? "error" : "ok";
  report.summary = failed.length
    ? `检查失败：${failed.map(key => labels[key]).join("、")}。`
    : `检查通过，已使用${browserSource(report.browser!)}的 ${report.browser!.name}，无需额外安装浏览器。`;
  return report;
}
export function doctorExitCode(report: DoctorReport): 0 | 1 {
  return report.status === "ok" ? 0 : 1;
}
export function renderDoctor(report: DoctorReport, options: { json?: boolean; verbose?: boolean } = {}): string {
  if (options.json) return JSON.stringify(report, null, 2);
  const checkText = (check: Check) => check.status === "passed" ? "通过" : check.status === "failed" ? "失败" : "未检查";
  const lines = [report.product, `检查结果：${report.status === "ok" ? "通过" : "失败"}`, report.summary, "",
    `本地安装包：${report.package}@${report.packageVersion}（当前 doctor 命令；不代表已连接 MCP 的运行版本）`,
    `工作区资源：${report.workspace ? "可用" : "缺失"}`, `桥接脚本：${report.bridge ? "可用" : "缺失"}`];
  const browser = report.browser;
  if (browser?.available) {
    lines.push(`验证浏览器：${browser.name} ${browser.version || "版本未获取"}`, `浏览器来源：${browserSource(browser)}`);
    if (browser.path) lines.push(`浏览器路径：${browser.path}`);
    lines.push("浏览器启动验证：通过", "额外浏览器安装：不需要");
  } else lines.push(`浏览器启动验证：${checkText(report.checks.browser)}`, ...(report.checks.browser.message ? [report.checks.browser.message] : []));
  lines.push("", `Node.js：${report.node}`);
  if (report.data) lines.push(`评审数据目录：${report.data.path}${report.data.source === "new" ? "（首次启动评审时创建）" : ""}`);
  else lines.push(`评审数据目录：${checkText(report.checks.data)}：${report.checks.data.message}`);
  if (report.checks.catalog.status !== "not_checked" || report.checks.catalog.message !== "未指定 --design")
    lines.push(`设计清单：${checkText(report.checks.catalog)}${report.checks.catalog.message ? `：${report.checks.catalog.message}` : ""}`);
  if (report.recommendations.length) {
    lines.push("", "操作建议：");
    for (const advice of report.recommendations) lines.push(`- ${advice.message}${advice.command ? `\n  ${advice.command}` : ""}`);
  }
  if (options.verbose) {
    lines.push("", "浏览器候选诊断（按尝试顺序）：", "未选用候选的诊断信息仅供排查；原始错误中的安装提示不代表当前操作建议。");
    if (!browser?.attempts.length) lines.push(report.checks.browser.message ?? "没有候选尝试记录");
    browser?.attempts.forEach((attempt, index) => lines.push(`${index + 1}. ${attempt.source} / ${attempt.channel ?? attempt.path ?? "配置解析"}：${attempt.error ? `未选用候选的诊断信息：${attempt.error}` : "已选用，通过启动检查"}`));
  }
  return lines.join("\n");
}
