import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const root = path.resolve(import.meta.dirname, "..");
const client = new Client({ name: "uxai-starter-preview", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "dist/cli/index.js"), "mcp"],
  stderr: "inherit",
});
await client.connect(transport);
const result = await client.callTool({
  name: "start_review",
  arguments: {
    projectRoot: root,
    designRoot: path.join(root, "examples/starter/design"),
    host: process.env.UXAI_HOST ?? "127.0.0.1",
    port: Number(process.env.UXAI_PORT ?? 4173),
    previewPort: Number(process.env.UXAI_PREVIEW_PORT ?? 4174),
    ...(process.env.UXAI_BASE_URL
      ? { publicBaseUrl: process.env.UXAI_BASE_URL }
      : {}),
    ...(process.env.UXAI_PREVIEW_BASE_URL
      ? { previewBaseUrl: process.env.UXAI_PREVIEW_BASE_URL }
      : {}),
  },
});
if (result.isError) {
  console.error(result.content);
  await client.close();
  process.exitCode = 1;
} else {
  const info = JSON.parse(result.content[0].text);
  console.log(
    `Northstar Starter\nReview: ${info.reviewUrl}\nPreview origin: ${info.previewUrl}\nStop: Ctrl+C\nThis preview client does not run an AI model. To process feedback, stop it and start review from Codex.`,
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await client
      .callTool({
        name: "end_review",
        arguments: { sessionId: info.sessionId },
      })
      .catch(() => {});
    await client.close();
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}
