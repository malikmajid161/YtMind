import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { defaults } from "../src/core.js";
import assert from "node:assert/strict";
const key = (await readFile(".env.local", "utf8"))
  .match(/^GROQ_API_KEY=(.+)$/m)?.[1]
  ?.trim();
if (!key) throw new Error("Configure a local Groq key.");
const server = await previewServer(4176);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
});
const report = {
  date: new Date().toISOString(),
  videoId: "Uinx1py7Jsg",
  url: "https://youtu.be/Uinx1py7Jsg",
  durationSeconds: 396,
  scope:
    "User-specified Urdu Art Track; full audio import through the browser with real Groq. No human reference transcript; no accuracy claim. Lyrics stay in ignored local artifacts.",
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
  await page.goto("http://127.0.0.1:4176/panel.html");
  await page.evaluate(
    (config) =>
      localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
    { ...defaults, apiKey: key, ocrLanguage: "urd" },
  );
  await page.reload();
  await page.locator("#source-url").fill(report.url);
  await page.locator("#source-title").fill("Urdu Art Track ingestion test");
  await page.locator("#link-auto-ingest").uncheck();
  await page.locator("#source-form .primary").click();
  await page
    .getByText("Missing captions? Add your own source", { exact: true })
    .click();
  await page
    .locator("#audio-file")
    .setInputFiles("artifacts/art-track-audio.webm");
  await page.locator("#audio-language").selectOption("ur");
  const start = Date.now();
  await page.locator("#transcribe-audio").click();
  await page.waitForFunction(
    () => !document.querySelector("#save-reviewed-source").disabled,
    null,
    { timeout: 130000 },
  );
  report.transcriptionMs = Date.now() - start;
  const segments = JSON.parse(
    await page.locator("#review-source").inputValue(),
  );
  await writeFile(
    "artifacts/art-track-transcript.json",
    JSON.stringify(segments, null, 2),
  );
  report.segments = segments.length;
  const text = segments.map((s) => s.text).join(" ");
  report.characters = text.length;
  report.arabicScriptCharacters = (
    text.match(/\p{Script=Arabic}/gu) || []
  ).length;
  report.firstSegmentSeconds = segments[0]?.startTime;
  report.lastSegmentSeconds = segments.at(-1)?.startTime;
  report.reviewStatus =
    "Awaiting human review; melodic transcription may omit or invent words.";
  assert.ok(report.arabicScriptCharacters > 0, "No Urdu-script output");
  assert.ok(
    report.lastSegmentSeconds > 300,
    "Transcript did not reach the last minute",
  );
  report.status = "timestamped-urdu-transcription-returned";
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 700);
  throw e;
} finally {
  await writeFile(
    "research/results/live-art-track.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.close();
  console.log(JSON.stringify(report));
}
