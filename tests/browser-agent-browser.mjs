import { chromium, expect } from "@playwright/test";
import path from "node:path";
import assert from "node:assert/strict";
const dist = path.resolve("dist");
const context = await chromium.launchPersistentContext(
  path.resolve(`artifacts/agent-profile-${Date.now()}`),
  {
    executablePath: path.resolve(
      "artifacts/browsers/chromium-1248/chrome-win64/chrome.exe",
    ),
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    viewport: { width: 460, height: 950 },
  },
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  await context.route("https://claude.ai/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><div contenteditable="true" class="ProseMirror" style="min-height:40px;border:1px solid"></div><input type="file"><button aria-label="Send message">Send</button><script>
 document.querySelector('input').onchange=e=>{const p=document.createElement('p');p.textContent=e.target.files[0].name;document.body.append(p);};
 document.querySelector('button').onclick=()=>{const p=document.createElement('p');p.className='font-claude-response';p.textContent='Assignment draft based on the uploaded lecture.';document.body.append(p);document.querySelector('[contenteditable]').innerText='';};
 </script></body></html>`,
    }),
  );
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await expect(panel.locator("#settings-dialog")).toBeVisible();
  await panel.evaluate(() =>
    document.querySelector("#settings-dialog")?.close(),
  );
  await panel.locator(".workspace-menu summary").click();
  await panel.locator("#browser-agent-open").click();
  await expect(panel.locator("#browser-agent-dialog")).toBeVisible();
  await panel.locator("#agent-prompt").fill("Keep this draft when closed");
  await panel
    .getByRole("button", { name: "Close browser agent", exact: true })
    .click();
  await expect(panel.locator("#browser-agent-dialog")).not.toBeVisible();
  await panel.locator(".workspace-menu summary").click();
  await panel.locator("#browser-agent-open").click();
  await expect(panel.locator("#agent-prompt")).toHaveValue(
    "Keep this draft when closed",
  );
  await panel.keyboard.press("Escape");
  await expect(panel.locator("#browser-agent-dialog")).not.toBeVisible();
  await panel.locator(".workspace-menu summary").click();
  await panel.locator("#browser-agent-open").click();

  await panel
    .locator("#agent-prompt")
    .fill("Create an assignment from this lecture, using clear sections.");
  await panel.locator("#agent-file").setInputFiles({
    name: "lecture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Lecture on software reliability and testing."),
  });
  const newTabPromise = context.waitForEvent("page");
  await panel.locator("#agent-run").click();
  const provider = await newTabPromise;
  // Extension-created tabs may begin their first navigation before Playwright
  // attaches network interception. Reload through the controlled fixture.
  await provider.goto("https://claude.ai/new");
  await expect(provider.locator(".ProseMirror")).toBeVisible();
  await panel.bringToFront();
  await panel
    .locator("#agent-continue")
    .click({ timeout: 10000 })
    .catch(() => {});
  await expect
    .poll(async () => await panel.locator("#agent-status").textContent(), {
      timeout: 45000,
    })
    .toMatch(/Response captured/);
  await expect(panel.locator("#agent-messages")).toContainText(
    "Assignment draft",
  );
  await expect(panel.locator("#agent-export")).toBeVisible();
  assert.equal(await provider.locator(".font-claude-response").count(), 1);
  await panel.bringToFront();
  await panel.screenshot({
    path: "artifacts/browser-agent-ui.png",
    fullPage: true,
  });
  await panel.setViewportSize({ width: 320, height: 900 });
  assert.ok(
    await panel.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  console.log(
    "Browser Agent passed: Menu entry, document upload, provider task submission, response capture, export button and 320px layout. Provider HTML fixture; no live AI account used.",
  );
} finally {
  await context.close();
}
