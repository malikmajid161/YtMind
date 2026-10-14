import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { previewServer } from "../scripts/preview.mjs";
import { testStudio } from "./studio.mjs";
import { testLiveStudio } from "./live-studio.mjs";
const server = await previewServer(4174);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_EXE
      ? { executablePath: process.env.TEST_BROWSER_EXE }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 460, height: 1050 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/panel.html");
  await page.getByText("YOUR STUDY NOTES", { exact: true }).waitFor();
  await page.locator(".source-proof summary").first().click();
  assert.ok(
    (await page.locator(".source-proof pre").first().textContent()).includes(
      "useState",
    ),
  );
  await page.locator(".source-proof summary").first().click();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/panel-notes.png", fullPage: true });
  assert.equal(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    true,
  );
  await page.locator('[data-tab="graph"]').click();
  await page.locator(".graph-canvas").waitFor();
  await page.locator('[data-node="react"]').click();
  assert.ok(
    (await page.locator("#node-detail").textContent()).includes("React"),
  );
  await page.locator("#graph-search").fill("unmatched");
  assert.ok(
    (await page.locator("#graph-area").textContent()).includes("No matching"),
  );
  await page.locator("#graph-search").fill("");
  await page.screenshot({ path: "artifacts/panel-graph.png", fullPage: true });
  for (const tab of ["chat", "actions", "vera", "library", "lab"]) {
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.ok((await page.locator("#workspace").textContent()).length > 50);
  }
  await page.locator("#settings-open").click();
  await page.locator("#settings-dialog").waitFor({ state: "visible" });
  await page.screenshot({ path: "artifacts/settings.png" });
  await page.locator("#settings-close").click();
  await page.setViewportSize({ width: 320, height: 750 });
  await page.locator('[data-tab="notes"]').click();
  assert.equal(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    true,
  );
  await page.screenshot({ path: "artifacts/panel-mobile.png", fullPage: true });
  await page
    .locator(".result")
    .first()
    .evaluate((el) => el.classList.add("print-selected"));
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".result").first().isVisible(), true);
  assert.equal(
    await page
      .locator(".sources")
      .first()
      .evaluate((el) => getComputedStyle(el).maxHeight),
    "none",
  );
  const pdf = await page.pdf({
    path: "artifacts/notes-export.pdf",
    format: "A4",
    printBackground: true,
  });
  assert.ok(pdf.subarray(0, 4).toString() === "%PDF");
  assert.deepEqual(errors, []);
  await testStudio(browser);
  await testLiveStudio(browser);
  console.log(
    "UI checks passed: seven tabs, graph selection/search, proof view, settings, 320px layout; no page errors.",
  );
} finally {
  await browser?.close();
  server.close();
}
