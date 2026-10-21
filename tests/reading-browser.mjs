import { chromium, expect } from "@playwright/test";
import path from "node:path";
import assert from "node:assert/strict";
const dist = path.resolve("dist");
const context = await chromium.launchPersistentContext(
  path.resolve(`artifacts/reading-profile-${Date.now()}`),
  {
    executablePath:
      process.env.TEST_BROWSER_EXE ||
      path.resolve("artifacts/browsers/chromium-1248/chrome-win64/chrome.exe"),
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  },
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  await context.route("https://reading.example.test/**", async (route) => {
    const sensitive = route.request().url().includes("private-form");
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><title>Reading fixture</title></head><body><nav>Navigation marker</nav><article><h1>Learning from evidence</h1><p>${"Compare sources and check the explanation against the original material. ".repeat(8)}</p><form><input value="FORM_SECRET"><textarea>TEXTAREA_SECRET</textarea>${sensitive ? '<input type="password" value="PASSWORD_SECRET">' : ""}</form><div contenteditable="true">EDITOR_SECRET</div><p hidden>HIDDEN_SECRET</p></article></body></html>`,
    });
  });
  const article = await context.newPage();
  await article.goto("https://reading.example.test/article?token=private");
  await article.bringToFront();
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  const state = () =>
    panel.evaluate(async () => {
      const reply = await chrome.runtime.sendMessage({ type: "STATE" });
      if (reply.error) throw Error(reply.error);
      return reply.data;
    });
  await article.bringToFront();
  await expect
    .poll(async () => (await state()).pages.length, { timeout: 15000 })
    .toBe(1);
  let pages = (await state()).pages;
  assert.equal(pages[0].url, "https://reading.example.test/article");
  assert.match(pages[0].text, /Compare sources/);
  assert.doesNotMatch(pages[0].text, /SECRET|Navigation marker/);
  await panel.bringToFront();
  await panel.evaluate(() =>
    document.querySelector("#settings-dialog")?.close(),
  );
  await panel.locator('[data-tab="library"]').click();
  await panel.locator("[data-reading-page] summary").first().click();
  await expect(panel.locator(".reading-page-body").first()).toContainText(
    "Compare sources",
  );
  await panel.locator("#page-search").fill("not-present-anywhere");
  assert.equal(await panel.locator("[data-page-id]:visible").count(), 0);
  await panel.locator("#page-search").fill("");
  await panel
    .getByRole("button", { name: "Pause reading history", exact: true })
    .click();
  assert.equal((await state()).readingEnabled, false);
  await article.goto("https://reading.example.test/second");
  await article.bringToFront();
  await article.waitForTimeout(3200);
  assert.equal((await state()).pages.length, 1);
  await panel.bringToFront();
  await panel
    .getByRole("button", { name: "Resume reading history", exact: true })
    .click();
  await article.reload();
  await article.bringToFront();
  await expect
    .poll(async () => (await state()).pages.length, { timeout: 15000 })
    .toBe(2);
  await article.goto("https://reading.example.test/private-form");
  await article.bringToFront();
  await article.waitForTimeout(3200);
  assert.equal((await state()).pages.length, 2);
  console.log(
    "Native reading history passed: automatic capture, input/editor exclusion, query removal, pause/resume and password-form exclusion. Isolated Chromium profile; no AI calls.",
  );
} finally {
  await context.close();
}
