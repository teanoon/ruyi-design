#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { setup, packageRoot } from "../skills/index.js";
import { loadCatalog } from "../core/catalog/index.js";
import path from "node:path";
import { BRAND } from "../contracts/brand.js";
import { resolveDataRoot } from "../core/sessions/data-root.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      client: { type: "string" },
      project: { type: "string" },
      design: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = positionals[0];
  if (command === "mcp") {
    const { runMcp } = await import("../mcp/index.js");
    await runMcp();
  } else if (command === "setup") {
    if (values.client !== "codex")
      throw new Error("Use setup --client codex --project <absolute-root>");
    console.log(
      JSON.stringify(
        await setup(path.resolve(values.project ?? process.cwd())),
        null,
        2,
      ),
    );
  } else if (command === "doctor") {
    const result: any = {
      product: `${BRAND.product} · ${BRAND.englishName}`,
      package: BRAND.packageName,
      data: resolveDataRoot(path.resolve(values.project ?? process.cwd())),
      node: process.version,
      workspace: existsSync(
        path.join(packageRoot, "dist/workspace/index.html"),
      ),
      bridge: existsSync(path.join(packageRoot, "dist/bridge/bridge.js")),
      chromium: existsSync(chromium.executablePath()),
      browserInstall: "npx playwright install chromium",
    };
    if (values.design) {
      const m = await loadCatalog(path.resolve(values.design));
      result.catalog = {
        id: m.id,
        pages: m.pages.length,
        components: m.components.length,
      };
    }
    console.log(JSON.stringify(result, null, 2));
    if (!result.workspace || !result.bridge || !result.chromium)
      process.exitCode = 1;
  } else
    console.log(
      `${BRAND.product} · ${BRAND.englishName}\n${BRAND.signature} · ${BRAND.tagline}\n\n${BRAND.cli} mcp\n${BRAND.cli} setup --client codex --project <root>\n${BRAND.cli} doctor [--project <root>] [--design <directory>]`,
    );
} catch (e: any) {
  console.error(e.message);
  process.exitCode = 1;
}
