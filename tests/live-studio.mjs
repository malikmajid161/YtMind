import { readFile, writeFile } from "node:fs/promises";
import { defaults } from "../src/core.js";
export async function testLiveStudio(browser, port = 4174) {
  let env;
  try {
    env = await readFile(".env.local", "utf8");
  } catch {
    return;
  }
  const key = env.match(/^GROQ_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) return;
  // Run once per explicitly configured local workspace; CI never receives this key.
  try {
    await readFile("research/results/live-studio.json");
    return;
  } catch {}
  const context = await browser.newContext({
      viewport: { width: 1100, height: 900 },
    }),
    results = [],
    requests = [];
  let count = 0;
  try {
    await context.route("https://api.groq.com/**", (route) => {
      if (route.request().method() === "POST" && ++count > 18)
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.on("response", (r) => {
      if (r.url().startsWith("https://api.groq.com/"))
        requests.push({ status: r.status(), path: new URL(r.url()).pathname });
    });
    await page.goto(`http://127.0.0.1:${port}/panel.html?studio`);
    await page.evaluate(
      (config) =>
        localStorage.setItem("ytmind-studio-settings", JSON.stringify(config)),
      { ...defaults, apiKey: key },
    );
    await page.reload();
    await page
      .locator("#source-url")
      .fill("https://www.youtube.com/watch?v=abcdefghijk");
    await page
      .locator("#source-title")
      .fill("Controlled live application test");
    await page.locator("#link-auto-ingest").uncheck();
    await page.locator("#source-form .primary").click();
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page
      .locator("#manual-source")
      .fill(
        "For this controlled tutorial, use Node.js 18. Create a project folder, run npm install, and then run npm run build. The source does not specify a package manager version.",
      );
    await page.getByRole("button", { name: "Use this transcript" }).click();
    const waitResult = async (label) => {
      await page.locator(".result").first().waitFor({ timeout: 90000 });
      const text = await page
        .locator(".result .markdown")
        .first()
        .textContent();
      if (!text.trim()) throw new Error("Empty result for " + label);
      results.push({
        module: label,
        status: "completed",
        characters: text.length,
      });
    };
    await page.locator('[data-generate="notes"]').click();
    await waitResult("notes");
    await page.locator("#pin").click();
    await page.locator('[data-tab="actions"]').click();
    await page.locator('[data-generate="actions"]').click();
    await waitResult("actions");
    await page.locator('[data-tab="chat"]').click();
    await page.locator("#question").fill("Which npm commands are shown?");
    await page.locator("#ask-form .primary").click();
    await waitResult("Q&A");
    await page.locator('[data-tab="graph"]').click();
    await page.locator("#extract-graph").click();
    await page.locator(".graph-canvas").waitFor({ timeout: 40000 });
    results.push({
      module: "graph",
      status: "completed",
      nodeCount: await page.locator("[data-node]").count(),
    });
    await page.locator('[data-tab="vera"]').click();
    const image = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 180;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, 1100, 180);
      x.fillStyle = "black";
      x.font = "48px Arial";
      x.fillText("Required runtime Node.js 22", 24, 100);
      return c.toDataURL().split(",")[1];
    });
    await page.locator("#frame-time").fill("12");
    await page.locator("#frame-files").setInputFiles({
      name: "controlled-frame.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector(".frame-body p")
          ?.textContent.includes("Node.js 22"),
      null,
      { timeout: 30000 },
    );
    results.push({ module: "local OCR", status: "completed" });
    await page.locator('[data-tab="lab"]').click();
    await page.locator('[data-lab="conflicts"]').click();
    await waitResult("Evidence Lab");
    await page.locator('[data-lab="preflight"]').click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".result .markdown")
          ?.textContent.includes("Tutorial preflight"),
      null,
      { timeout: 40000 },
    );
    results.push({ module: "preflight", status: "completed" });
    await page.locator('[data-tab="library"]').click();
    await page
      .locator("#research-topic")
      .fill("Node.js versions and npm commands");
    await page.locator("#research-form .primary").click();
    await waitResult("research");
    await page.screenshot({
      path: "artifacts/live-working-app.png",
      fullPage: true,
    });
    console.log(
      "Real local-app browser pilot completed all eight module workflows. Source data is controlled, not live-video evidence.",
    );
  } catch (e) {
    results.push({
      status: "failed",
      error: e.message.replaceAll(key, "[REDACTED]"),
    });
    console.log(
      "Real local-app browser pilot recorded a failure; see the redacted result file.",
    );
  } finally {
    await writeFile(
      "research/results/live-studio.json",
      JSON.stringify(
        {
          date: new Date().toISOString(),
          scope:
            "Real local browser app, real Groq HTTP/CORS, real local OCR, controlled hand-authored tutorial evidence",
          requests,
          requestBudget: 18,
          requestCount: count,
          results,
          limitations: [
            "Single controlled source",
            "Workflow completion is not human-judged output accuracy",
            "No competitor comparison",
          ],
        },
        null,
        2,
      ),
    );
    await context.close();
  }
}
