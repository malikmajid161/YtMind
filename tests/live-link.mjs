import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { defaults } from "../src/core.js";
const key = (await readFile(".env.local", "utf8"))
  .match(/^GROQ_API_KEY=(.+)$/m)?.[1]
  ?.trim();
if (!key) throw new Error("Configure the ignored local Groq key.");
const videoId = process.env.TEST_VIDEO_ID || "Uinx1py7Jsg";
if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
  throw new Error("Invalid test video identifier");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
});
const report = {
  date: new Date().toISOString(),
  videoId,
  scope:
    "Real paste-link-to-audio-to-Urdu-transcript-to-notes integration on a user-specified public video. No human accuracy reference; no lyrics in tracked results.",
  requests: [],
};
let page;
try {
  page = await browser.newPage();
  page.on("response", (r) => {
    if (r.url().startsWith("https://api.groq.com/"))
      report.requests.push({
        status: r.status(),
        path: new URL(r.url()).pathname,
      });
  });
  await page.goto("http://127.0.0.1:4173/panel.html");
  await page.evaluate(
    (config) =>
      localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
    { ...defaults, apiKey: key, sage: true, deep: true },
  );
  await page.reload();
  await page.locator("#source-url").fill(`https://youtu.be/${videoId}`);
  await page.locator("#link-audio-language").selectOption("ur");
  const start = Date.now();
  await page.locator("#source-form .primary").click();
  await page.locator(".result").first().waitFor({ timeout: 240000 });
  report.elapsedMs = Date.now() - start;
  report.noteCharacters = (
    await page.locator(".result .markdown").first().textContent()
  ).length;
  report.verificationLabel = await page
    .locator(".result .badge")
    .first()
    .textContent()
    .catch(() => null);
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 500);
  report.notice = await page?.locator("#notice").textContent();
  throw e;
} finally {
  await writeFile(
    videoId === "Uinx1py7Jsg"
      ? "research/results/live-link.json"
      : `research/results/live-link-${videoId}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify(report));
}
