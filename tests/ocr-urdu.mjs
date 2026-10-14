import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = await previewServer(4178),
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_EXE
      ? { executablePath: process.env.TEST_BROWSER_EXE }
      : {}),
  });
const report = {
  date: new Date().toISOString(),
  scope:
    "One authored Urdu canvas phrase; local packaged Urdu OCR, not decorative Art Track artwork accuracy.",
  externalRequests: 0,
};
try {
  const page = await browser.newPage();
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4178") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      report.externalRequests++;
  });
  await page.goto("http://127.0.0.1:4178/panel.html?preview");
  const result = await page.evaluate(async () => {
    const text = "یہ ایک کتاب ہے";
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 240;
    const x = canvas.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 1000, 240);
    x.fillStyle = "black";
    x.font = "80px Arial";
    x.direction = "rtl";
    x.textAlign = "right";
    x.fillText(text, 970, 150);
    const { recognize } = await import("/ocr.js");
    const output = await recognize(canvas.toDataURL(), 0, "urd");
    return {
      expected: text,
      actual: output.text.trim(),
      confidence: output.confidence,
    };
  });
  Object.assign(report, result, {
    exact: result.actual.replace(/\s+/g, " ").trim() === result.expected,
  });
  assert.ok(
    /\p{Script=Arabic}/u.test(report.actual),
    "No Urdu-script characters returned.",
  );
  assert.equal(report.externalRequests, 0);
  report.status = "local-urdu-model-working";
} catch (e) {
  report.status = "failed";
  report.error = e.message;
  throw e;
} finally {
  await writeFile(
    "research/results/urdu-ocr.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.close();
  console.log(JSON.stringify(report));
}
