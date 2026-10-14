import { chromium } from "@playwright/test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
const context = await chromium.launchPersistentContext(
  path.resolve("artifacts/native-audio-profile"),
  {
    channel: "chromium",
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${path.resolve("dist")}`,
      `--load-extension=${path.resolve("dist")}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
);
const report = {
  scope:
    "Native tab capture via extension action keyboard shortcut; controlled canvas/video and mocked ASR",
  date: new Date().toISOString(),
  audioRequests: 0,
};
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(() =>
    chrome.action.onClicked.addListener(() =>
      chrome.storage.local.set({ fixtureActionSeen: true }),
    ),
  );
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  const send = async (type, fields = {}) =>
    panel.evaluate(
      async (m) => {
        const r = await chrome.runtime.sendMessage(m);
        if (r.error) throw new Error(r.error);
        return r.data;
      },
      { type, ...fields },
    );
  await send("SAVE_SETTINGS", {
    value: { apiKey: "controlled-fixture", sage: false, deep: false },
  });
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><head><title>Native audio fixture - YouTube</title></head><body><div id="movie_player"><video class="html5-main-video" muted></video></div><h1 class="ytd-watch-metadata">Native audio fixture</h1></body></html>',
    }),
  );
  await context.route("https://api.groq.com/**", (route) => {
    report.audioRequests++;
    return route.fulfill({
      json: {
        segments: [
          { text: "Controlled audio source.", start: 0, no_speech_prob: 0.01 },
        ],
      },
    });
  });
  const video = await context.newPage();
  await video.goto("https://www.youtube.com/watch?v=native00001");
  await video.locator("#ytmind-launch").waitFor();
  await video.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const draw = () => {
      const x = canvas.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, 640, 360);
      x.fillStyle = "black";
      x.font = "40px Arial";
      x.fillText(
        "Source fixture " + Math.floor(performance.now() / 1000),
        20,
        100,
      );
    };
    draw();
    setInterval(draw, 50);
    const v = document.querySelector("video");
    v.srcObject = canvas.captureStream(20);
    await v.play();
    const a = new AudioContext(),
      oscillator = a.createOscillator();
    oscillator.connect(a.destination);
    oscillator.start();
    await a.resume();
  });
  await video.bringToFront();
  await video.keyboard.press("Control+Shift+Y");
  await new Promise((r) => setTimeout(r, 3000));
  const first = await send("AUDIO_HEARTBEAT", { videoId: "native00001" });
  report.started = first;
  report.actionObserved =
    (await worker.evaluate(() => chrome.storage.local.get("fixtureActionSeen")))
      .fixtureActionSeen || false;
  if (!first.active)
    throw new Error(
      "Extension action did not activate tab audio in this headless browser.",
    );
  const start = Date.now();
  while (Date.now() - start < 38000) {
    await send("AUDIO_HEARTBEAT", { videoId: "native00001" });
    await new Promise((r) => setTimeout(r, 2000));
    const state = await send("STATE");
    if (
      state.sessions.find((s) => s.id === "native00001")?.captionSource ===
      "live audio transcription"
    ) {
      report.ingested = true;
      break;
    }
  }
  await send("AUDIO_STOP");
  report.status = report.ingested ? "passed" : "no-transcript";
  if (!report.ingested)
    throw new Error("No native audio transcript was saved.");
} catch (e) {
  report.status = "failed";
  report.error = e.message.slice(0, 600);
  throw e;
} finally {
  await writeFile(
    "research/results/native-audio-smoke.json",
    JSON.stringify(report, null, 2),
  );
  await context.close();
  console.log(JSON.stringify(report));
}
