import { chromium } from "playwright";
import { combinations } from "../../contracts/catalog.js";
import type { Revision } from "../../core/revisions/index.js";
import { ReviewError, ensure } from "../../core/errors.js";

export async function validateRevision(revision: Revision, base: string) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new ReviewError(
      "validation_unavailable",
      "Chromium is unavailable. Run: npx playwright install chromium",
    );
  }
  try {
    for (const combo of combinations(revision.manifest)) {
      const device = revision.manifest.devices.find(
        (d) => d.id === combo.deviceId,
      )!;
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
          errors.push(`${r.status()} ${r.url()}`);
      });
      page.on("requestfailed", (r) =>
        errors.push(`${r.failure()?.errorText}: ${r.url()}`),
      );
      const url = new URL(`/r/${revision.id}/${combo.entry.path}`, base);
      for (const [k, v] of Object.entries(combo.entry.query))
        url.searchParams.set(k, v);
      url.hash = combo.entry.hash;
      try {
        const response = await page.goto(url.href, {
          waitUntil: "networkidle",
          timeout: 15000,
        });
        ensure(response?.ok(), "entry_failed", `Entry failed: ${combo.name}`);
        await page.waitForTimeout(100);
        ensure(
          !errors.length,
          "validation_failed",
          `${combo.name}: ${errors.join("; ")}`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
