import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { defaults } from "../src/core.js";
import assert from "node:assert/strict";
const key = (await readFile(".env.local", "utf8"))
  .match(/^GROQ_API_KEY=(.+)$/m)?.[1]
  ?.trim();
if (!key)
  throw new Error(
    "Configure the ignored local Groq key before this explicit live test.",
  );
const server = await previewServer(4175);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
});
const report = {
  date: new Date().toISOString(),
  scope:
    "One Windows-synthesized English technical speech fixture; real Groq/browser ingestion; not a real tutorial accuracy benchmark",
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
  await page.goto("http://127.0.0.1:4175/panel.html?studio");
  await page.evaluate(
    (config) =>
      localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
    { ...defaults, apiKey: key, sage: false, deep: false },
  );
  await page.reload();
  await page
    .locator("#source-url")
    .fill("https://www.youtube.com/watch?v=audio000001");
  await page.locator("#source-title").fill("Authored speech ingestion test");
  await page.locator("#link-auto-ingest").uncheck();
  await page.locator("#source-form .primary").click();
  await page
    .getByText("Missing captions? Add your own source", { exact: true })
    .click();
  await page
    .locator("#audio-file")
    .setInputFiles("artifacts/speech-fixture.wav");
  await page.locator("#transcribe-audio").click();
  await page.waitForFunction(
    () => !document.querySelector("#save-reviewed-source").disabled,
    null,
    { timeout: 130000 },
  );
  const segments = JSON.parse(
    await page.locator("#review-source").inputValue(),
  );
  report.segments = segments.length;
  report.transcript = segments;
  const text = segments
    .map((s) => s.text)
    .join(" ")
    .toLowerCase();
  report.expectedKeywords = ["project", "install", "build", "output"];
  report.keywordMatches = report.expectedKeywords.filter((word) =>
    text.includes(word),
  );
  assert.ok(
    report.keywordMatches.length >= 3,
    "Speech missed the controlled technical content",
  );
  await page.locator("#save-reviewed-source").click();
  await page.locator("#source-dialog").waitFor({ state: "hidden" });
  await page.locator('[data-generate="notes"]').click();
  await page.locator(".result").first().waitFor({ timeout: 60000 });
  report.noteCharacters = (
    await page.locator(".result .markdown").first().textContent()
  ).length;
  assert.ok(report.noteCharacters > 0);
  report.status = "passed";
  await page.screenshot({
    path: "artifacts/audio-working-app.png",
    fullPage: true,
  });
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 500);
  throw e;
} finally {
  await writeFile(
    "research/results/live-audio.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.close();
  console.log(
    JSON.stringify({
      status: report.status,
      segments: report.segments,
      keywordMatches: report.keywordMatches,
      requests: report.requests,
    }),
  );
}
