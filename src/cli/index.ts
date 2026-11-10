#!/usr/bin/env node
import { parseArgs } from "node:util";
import { setup } from "../skills/index.js";
import { collectDoctor, doctorExitCode, renderDoctor } from "./doctor.js";
import path from "node:path";
import { BRAND } from "../contracts/brand.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      client: { type: "string" },
      project: { type: "string" },
      design: { type: "string" },
      json: { type: "boolean" },
      verbose: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = values.help ? undefined : positionals[0];
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
    const report = await collectDoctor({
      project: path.resolve(values.project ?? process.cwd()),
      design: values.design ? path.resolve(values.design) : undefined,
    });
    console.log(renderDoctor(report, values));
    process.exitCode = doctorExitCode(report);
  } else
    console.log(
      `${BRAND.product} · ${BRAND.englishName}\n${BRAND.signature} · ${BRAND.tagline}\n\n${BRAND.cli} mcp\n${BRAND.cli} setup --client codex --project <root>\n${BRAND.cli} doctor [--project <root>] [--design <directory>] [--json] [--verbose]\n\nDoctor 默认显示文本摘要；--json 输出机器可读 JSON；--verbose 显示完整候选诊断。`,
    );
} catch (e: any) {
  console.error(e.message);
  process.exitCode = 1;
}
