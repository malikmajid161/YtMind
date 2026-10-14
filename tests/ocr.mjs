import { chromium } from "@playwright/test";
import { previewServer } from "../scripts/preview.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
const server = await previewServer(4175);
let browser;
const fixtures = [
  {
    id: "slide-48",
    text: "React state remembers a value",
    font: 48,
    kind: "prose",
  },
  {
    id: "slide-32",
    text: "Hooks must stay at the top level",
    font: 32,
    kind: "prose",
  },
  { id: "command-44", text: "npm install react", font: 44, kind: "command" },
  { id: "command-28", text: "npm run build", font: 28, kind: "command" },
  { id: "code-40", text: "const count = 123;", font: 40, kind: "code" },
  {
    id: "code-26",
    text: "const [count, setCount] = useState(0);",
    font: 26,
    kind: "code",
  },
  {
    id: "code-20",
    text: "export function App() { return null; }",
    font: 20,
    kind: "code",
  },
  {
    id: "low-contrast",
    text: "Clean up subscriptions",
    font: 36,
    kind: "prose",
    color: "#777777",
    background: "#bbbbbb",
  },
];
const normalize = (s) => s.replace(/\s+/g, " ").trim();
function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_EXE
      ? { executablePath: process.env.TEST_BROWSER_EXE }
      : {}),
  });
  const page = await browser.newPage();
  const network = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4175/")) network.push(r.url());
  });
  await page.goto("http://127.0.0.1:4175/panel.html");
  await page.evaluate(() => {
    globalThis.chrome = {
      runtime: { getURL: (path) => `${location.origin}/${path}` },
    };
  });
  const results = [];
  for (const fixture of fixtures) {
    const output = await page.evaluate(async (f) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = f.background || "white";
      ctx.fillRect(0, 0, 1200, 150);
      ctx.fillStyle = f.color || "black";
      ctx.font = `${f.font}px ${f.kind === "prose" ? "Arial" : "Consolas"}`;
      ctx.fillText(f.text, 24, 90);
      const { recognize } = await import("/ocr.js");
      const start = performance.now();
      const data = await Promise.race([
        recognize(canvas.toDataURL("image/png")),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Local OCR timed out")), 45000),
        ),
      ]);
      return { ...data, latencyMs: performance.now() - start };
    }, fixture);
    const actual = normalize(output.text),
      expected = normalize(fixture.text);
    results.push({
      ...fixture,
      actual,
      confidence: output.confidence,
      latencyMs: output.latencyMs,
      exactMatch: actual === expected,
      characterErrorRate: editDistance(expected, actual) / expected.length,
    });
  }
  // Exercise two independent slots with concurrent recognition, not mocked OCR.
  const tinyInputs = await page.evaluate(async () => {
    const { recognize } = await import("/ocr.js");
    const results = [];
    for (const width of [1, 2]) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = 36;
      const ctx = canvas.getContext("2d");
      ctx.fillRect(0, 0, width, 36);
      results.push(await recognize(canvas.toDataURL()));
    }
    return results;
  });
  assert.ok(
    tinyInputs.every(
      (result) => result.text === "" && result.reason === "image-too-small",
    ),
  );
  const concurrent = await page.evaluate(async () => {
    const { recognize } = await import("/ocr.js");
    const images = ["WORKER ONE 123", "WORKER TWO 456"].map((text) => {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 120;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, 800, 120);
      x.fillStyle = "black";
      x.font = "40px Arial";
      x.fillText(text, 20, 80);
      return c.toDataURL();
    });
    return Promise.all(images.map((image, i) => recognize(image, i)));
  });
  assert.match(concurrent[0].text, /WORKER ONE 123/);
  assert.match(concurrent[1].text, /WORKER TWO 456/);
  assert.equal(
    network.length,
    0,
    "OCR must not fetch external language/model assets",
  );
  const report = {
    date: new Date().toISOString(),
    scope:
      "Controlled synthetic English text images, not live YouTube or competitor evaluation",
    browser: browser.version(),
    hardware: {
      cpu: os.cpus()[0].model,
      logicalCpus: os.cpus().length,
      ramGiB: Math.round(os.totalmem() / 2 ** 30),
    },
    sampleSize: results.length,
    tinyInputsSkipped: tinyInputs.length,
    exactMatchRate: results.filter((r) => r.exactMatch).length / results.length,
    meanCharacterErrorRate:
      results.reduce((n, r) => n + r.characterErrorRate, 0) / results.length,
    externalRequests: network,
    results,
  };
  await mkdir("research/results", { recursive: true });
  await writeFile(
    "research/results/ocr-controlled.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      sampleSize: report.sampleSize,
      exactMatchRate: report.exactMatchRate,
      meanCharacterErrorRate: report.meanCharacterErrorRate,
      externalRequests: network.length,
      twoWorkerSmoke: "passed",
    }),
  );
} finally {
  await browser?.close();
  server.close();
}
