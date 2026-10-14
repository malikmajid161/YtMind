import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
});
const report = {
  date: new Date().toISOString(),
  videoId: "Tn6-PIqc4UM",
  responses: [],
  console: [],
};
await mkdir("artifacts/caption-debug", { recursive: true });
try {
  const page = await browser.newPage({ bypassCSP: true });
  page.setDefaultTimeout(6000);
  page.on("console", (message) => {
    if (/transcript|caption/i.test(message.text()))
      report.console.push(message.text().slice(0, 300));
  });
  const responseTasks = [];
  page.on("response", (response) => {
    if (!/\/api\/timedtext|\/youtubei\/v1\/get_transcript/.test(response.url()))
      return;
    const index = report.responses.length;
    const record = {
      path: new URL(response.url()).pathname,
      status: response.status(),
      mime: response.headers()["content-type"],
    };
    report.responses.push(record);
    responseTasks.push(
      (async () => {
        const text = await response.text().catch(() => "");
        record.length = text.length;
        record.shape = text.trim().startsWith("{")
          ? "json"
          : text.trim().startsWith("<")
            ? "markup"
            : text.trim().startsWith("WEBVTT")
              ? "vtt"
              : text.trim().startsWith(")]}'")
                ? "xssi-json"
                : text
                  ? "other"
                  : "empty";
        await writeFile(`artifacts/caption-debug/response-${index}.txt`, text);
        if (response.request().method() === "POST") {
          const raw = response.request().postDataBuffer();
          const decoded =
            raw?.[0] === 31 && raw?.[1] === 139
              ? gunzipSync(raw).toString("utf8")
              : raw?.toString("utf8");
          const body = JSON.parse(decoded || "{}");
          record.client = {
            name: body.context?.client?.clientName,
            version: body.context?.client?.clientVersion,
          };
          record.requestKeys = Object.keys(body);
          record.paramsLength = body.params?.length;
        }
      })().catch(() => {
        record.requestShape = "unparsed";
      }),
    );
  });
  await page.goto("https://www.youtube.com/watch?v=Tn6-PIqc4UM", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.locator("video").first().waitFor();
  const v = page.locator("video.html5-main-video").first();
  await v
    .evaluate((video) => {
      video.play().catch(() => {});
      return video.readyState;
    })
    .catch(() => {});
  for (let index = 0; index < 25; index++) {
    const ad = await page
      .locator("#movie_player")
      .evaluate((p) => p.classList.contains("ad-showing"));
    if (!ad) break;
    await page
      .locator(".ytp-ad-skip-button, .ytp-skip-ad-button")
      .first()
      .click({ timeout: 1000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
  const cc = page.locator(".ytp-subtitles-button");
  if (await cc.count()) await cc.click({ timeout: 2000 }).catch(() => {});
  await page
    .locator("#description-inline-expander #expand, tp-yt-paper-button#expand")
    .first()
    .click({ timeout: 2000 })
    .catch(() => {});
  const show = page.getByRole("button", {
    name: "Show transcript",
    exact: true,
  });
  report.transcriptButtons = await show.count();
  if (await show.count())
    await show
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(12000);
  report.dom = await page.evaluate(() => ({
    title: document.title,
    tags: [
      ...new Set(
        [...document.querySelectorAll("*")]
          .map((e) => e.localName)
          .filter((n) => /transcript|segment/.test(n)),
      ),
    ],
    panels: [
      ...document.querySelectorAll(
        "ytd-engagement-panel-section-list-renderer",
      ),
    ].map((e) => ({
      target: e.getAttribute("target-id"),
      visibility: e.getAttribute("visibility"),
      textLength: e.textContent.length,
      childTags: [
        ...new Set([...e.querySelectorAll("*")].map((c) => c.localName)),
      ].slice(0, 45),
    })),
    oldSegments: document.querySelectorAll(
      "ytd-transcript-segment-renderer, transcript-segment-view-model",
    ).length,
  }));
  const source = await readFile("src/transcript.js", "utf8");
  await page.addScriptTag({
    content:
      source.replace("export class", "class") +
      "\nwindow.YTMindTranscriptFetcher = TranscriptFetcher;",
  });
  report.extensionCapture = await page.evaluate(async (videoId) => {
    const result = await new window.YTMindTranscriptFetcher().fetch(videoId);
    return {
      status: result.status,
      message: result.message,
      captionSegments: result.transcript.length,
      needsAudio: result.needsAudio,
    };
  }, report.videoId);
  await writeFile("artifacts/caption-debug/page.html", await page.content());
  await Promise.allSettled(responseTasks);
  await page.screenshot({
    path: "artifacts/caption-debug/page.png",
    fullPage: true,
  });
} finally {
  await writeFile(
    "research/results/caption-debug.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(JSON.stringify(report));
}
