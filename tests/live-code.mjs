import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { defaults } from "../src/core.js";
import assert from "node:assert/strict";
const key = (await readFile(".env.local", "utf8"))
  .match(/^GROQ_API_KEY=(.+)$/m)?.[1]
  ?.trim();
const server = await previewServer(4179),
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_EXE
      ? { executablePath: process.env.TEST_BROWSER_EXE }
      : {}),
  });
const report = {
  date: new Date().toISOString(),
  scope:
    "One authored JavaScript canvas; real local OCR and automatic Groq code extraction/export. Does not establish recovery of complex tutorial code.",
  requests: [],
};
try {
  const page = await browser.newPage();
  page.on("response", (r) => {
    if (r.url().startsWith("https://api.groq.com/"))
      report.requests.push({
        status: r.status(),
        path: new URL(r.url()).pathname,
      });
  });
  await page.goto("http://127.0.0.1:4179/panel.html");
  await page.evaluate(
    (config) =>
      localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
    { ...defaults, apiKey: key, autoCode: true },
  );
  await page.reload();
  await page.locator("#link-auto-ingest").uncheck();
  await page
    .locator("#source-url")
    .fill("https://www.youtube.com/watch?v=code0000001");
  await page.locator("#source-title").fill("Authored code capture");
  await page.locator("#source-form .primary").click();
  await page.locator('[data-tab="vera"]').click();
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 1000, 160);
    x.fillStyle = "black";
    x.font = "48px monospace";
    x.fillText("const count = 123;", 20, 100);
    return c.toDataURL().split(",")[1];
  });
  await page.locator("#frame-files").setInputFiles({
    name: "code.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await page.locator("[data-code-zip]").first().waitFor({ timeout: 90000 });
  const candidate = await page.locator(".result code").first().textContent();
  assert.equal(candidate.trim(), "const count = 123;");
  const downloadable = page.waitForEvent("download");
  await page.locator("[data-code-zip]").first().click();
  const file = await downloadable;
  report.fileName = file.suggestedFilename();
  report.exactCodeMatch = true;
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 500);
  throw e;
} finally {
  await writeFile(
    "research/results/live-code.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.close();
  console.log(JSON.stringify(report));
}
