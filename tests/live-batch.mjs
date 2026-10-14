import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { defaults } from "../src/core.js";
const key = (await readFile(".env.local", "utf8"))
  .match(/^GROQ_API_KEY=(.+)$/m)?.[1]
  ?.trim();
if (!key) throw new Error("Configure the local Groq key.");
const server = await previewServer(4177);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
});
const report = {
  date: new Date().toISOString(),
  scope:
    "Five authored lecture excerpts through the real browser app and Groq generation plus SAGE; not five full videos or human accuracy scores.",
  requests: [],
  lectures: [],
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
  await page.goto("http://127.0.0.1:4177/panel.html");
  await page.evaluate(
    (config) =>
      localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
    { ...defaults, apiKey: key, sage: true, deep: true },
  );
  await page.reload();
  await page.locator("#link-auto-ingest").uncheck();
  const texts = [
    "React state remembers a value between renders. Call useState at the top level of a component.",
    "Node.js provides the runtime in this example. Run npm install before npm run build.",
    "Python functions use def. Indentation groups statements inside a function.",
    "A SQL SELECT query reads rows. A WHERE condition filters which rows are returned.",
    "A Git commit records a snapshot. Review git diff before git commit.",
  ];
  for (const [index, text] of texts.entries()) {
    await page
      .locator("#source-url")
      .fill(`https://www.youtube.com/watch?v=lecture000${index + 1}`);
    await page
      .locator("#source-title")
      .fill(`Authored lecture excerpt ${index + 1}`);
    await page.locator("#source-form .primary").click();
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page.locator("#manual-source").fill(text);
    await page.getByRole("button", { name: "Use this transcript" }).click();
    await page.locator("#pin").click();
  }
  await page.locator('[data-tab="library"]').click();
  const start = Date.now();
  await page.locator("#batch-start").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".batch-card")?.textContent.match(/complete/g)
        ?.length === 5,
    null,
    { timeout: 180000 },
  );
  report.lectures = await page.evaluate(async () => {
    const request = indexedDB.open("ytmind-studio");
    const db = await new Promise(
      (r) => (request.onsuccess = () => r(request.result)),
    );
    const get = db.transaction("sessions").objectStore("sessions").getAll();
    const sessions = await new Promise(
      (r) => (get.onsuccess = () => r(get.result)),
    );
    db.close();
    return sessions.map((s) => ({
      videoId: s.id,
      outputs: s.outputs.length,
      characters: s.outputs[0]?.answer.length,
      verification: s.outputs[0]?.verification.status,
    }));
  });
  report.status = "complete";
  report.elapsedMs = Date.now() - start;
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 500);
  report.notice = await page?.locator("#notice").textContent();
  throw e;
} finally {
  await writeFile(
    "research/results/live-lecture-batch.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.close();
  console.log(JSON.stringify(report));
}
