import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { probeYouTube } from "./live-youtube.mjs";
const dist = path.resolve("dist");
const profile = path.resolve(`artifacts/extension-profile-${Date.now()}`);
await mkdir(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  ignoreDefaultArgs: ["--disable-extensions"],
  viewport: { width: 1100, height: 850 },
  ...(process.env.TEST_BROWSER_EXE
    ? { executablePath: process.env.TEST_BROWSER_EXE }
    : {}),
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    "--enable-logging",
    `--log-file=${path.resolve("artifacts/chrome-extension.log")}`,
  ],
});
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context
      .waitForEvent("serviceworker", { timeout: 20000 })
      .catch(async (e) => {
        const management = await context.newPage();
        await management.goto("chrome://extensions/");
        console.log(
          await management.evaluate(async () => {
            const toggle = document
              .querySelector("extensions-manager")
              ?.shadowRoot?.querySelector("extensions-toolbar")
              ?.shadowRoot?.querySelector("#devMode");
            const extensions = await new Promise((resolve) =>
              chrome.developerPrivate.getExtensionsInfo(
                { includeDisabled: true, includeTerminated: true },
                resolve,
              ),
            );
            return {
              developerModeDisabled: toggle?.disabled,
              developerModeChecked: toggle?.checked,
              extensions: extensions.map((item) => ({
                name: item.name,
                state: item.state,
                manifestErrors: item.manifestErrors,
                runtimeErrors: item.runtimeErrors,
              })),
            };
          }),
        );
        throw e;
      }));
  const extensionId = new URL(worker.url()).host;
  assert.equal(
    (await worker.evaluate(() => chrome.sidePanel.getPanelBehavior()))
      .openPanelOnActionClick,
    true,
  );
  const id = "abcdefghijk";
  const fixture = `<!doctype html><html><head><title>Controlled React Tutorial - YouTube</title></head><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abcdefghijk","title":"Controlled React Tutorial"},"playabilityStatus":{"status":"OK"}};</script><div id="movie_player"><video class="html5-main-video" muted></video></div><h1 class="ytd-watch-metadata">Controlled React Tutorial</h1><ytd-transcript-segment-renderer>0:10 React state remembers a value. Use useState at the top level.</ytd-transcript-segment-renderer><ytd-transcript-segment-renderer>0:30 Run npm install before starting the project.</ytd-transcript-segment-renderer></body></html>`;
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixture }),
  );
  await worker.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).startsWith("https://api.groq.com/")) {
        const request = JSON.parse(options.body);
        const content = request.response_format
          ? JSON.stringify({
              status: "supported",
              reason: "Controlled test support check.",
              claims: [
                {
                  text: "Use useState at the top level.",
                  verdict: "supported",
                  refs: [1],
                },
              ],
            })
          : "## Key Concepts\nUse useState at the top level. [E1]";
        return new Response(
          JSON.stringify({ choices: [{ message: { content } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return original(url, options);
    };
  });
  const watch = await context.newPage();
  worker.on("console", (m) => {
    if (m.text().includes("YTMind request failed")) console.log(m.text());
  });
  await watch.goto(`https://www.youtube.com/watch?v=${id}`);
  await watch.locator("#ytmind-launch").waitFor();
  const previousInstance = await watch
    .locator("#ytmind-launch")
    .getAttribute("data-ytmind-instance");
  await worker.evaluate(async (videoId) => {
    const tab = (
      await chrome.tabs.query({ url: "https://www.youtube.com/*" })
    ).find((t) => t.url?.includes(videoId));
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }, id);
  await expect
    .poll(() =>
      watch.locator("#ytmind-launch").getAttribute("data-ytmind-instance"),
    )
    .not.toBe(previousInstance);
  assert.equal(await watch.locator("#ytmind-launch").count(), 1);

  await watch.evaluate(() => {
    const stale = document.getElementById("ytmind-launch");
    delete stale.dataset.ytmindVersion;
    stale.textContent = "Open YTMind from the toolbar";
    stale.onclick = () => {
      throw new Error("Stale handler must not run");
    };
  });
  await expect(watch.locator("#ytmind-launch")).toHaveAttribute(
    "data-ytmind-version",
    "3.0.26",
    { timeout: 5000 },
  );
  assert.ok(
    !(await watch.locator("#ytmind-launch").textContent()).includes("toolbar"),
  );

  await watch.evaluate(() => document.getElementById("ytmind-launch").remove());
  await watch.locator("#ytmind-launch").waitFor({ timeout: 5000 });
  assert.equal(await watch.locator("#ytmind-launch").count(), 1);

  await watch.locator("#ytmind-launch").click();
  const embedded = watch.frameLocator("#ytmind-drawer iframe");
  await embedded.locator(".tabs").waitFor();
  const initialDrawer = await watch.locator("#ytmind-drawer").boundingBox();
  const dragEdge = await watch.locator("#ytmind-resize").boundingBox();
  await watch.mouse.move(dragEdge.x + 4, dragEdge.y + 30);
  await watch.mouse.down();
  await watch.mouse.move(dragEdge.x - 100, dragEdge.y + 30);
  await watch.mouse.up();
  const widenedDrawer = await watch.locator("#ytmind-drawer").boundingBox();
  assert.ok(widenedDrawer.width > initialDrawer.width + 80);
  await watch
    .getByRole("button", { name: "Expand workspace", exact: true })
    .click();
  assert.ok(
    (await watch.locator("#ytmind-drawer").boundingBox()).width >
      widenedDrawer.width,
  );
  await watch
    .getByRole("button", { name: "Restore workspace width", exact: true })
    .click();
  await watch.locator("#ytmind-resize").press("Home");
  assert.ok((await watch.locator("#ytmind-drawer").boundingBox()).width <= 322);
  await watch.setViewportSize({ width: 320, height: 700 });
  await watch.waitForTimeout(100);
  const compact = await watch.locator("#ytmind-drawer").boundingBox();
  assert.ok(compact.x >= 0 && compact.x + compact.width <= 320);
  await watch.screenshot({ path: "artifacts/drawer-responsive-320.png" });
  await watch.setViewportSize({ width: 1100, height: 850 });

  await watch.screenshot({ path: "artifacts/drawer-rounded.png" });
  await embedded
    .getByText("Controlled React Tutorial", { exact: true })
    .waitFor();
  await watch
    .getByRole("button", { name: "Close YTMind", exact: true })
    .click();
  assert.equal(await watch.locator("#ytmind-drawer").count(), 0);
  await watch.locator("#ytmind-launch").click();
  await embedded.locator(".tabs").waitFor();

  await expect
    .poll(
      () =>
        worker.evaluate(async (videoId) => {
          const tabs = await chrome.tabs.query({
            url: "https://www.youtube.com/*",
          });
          const tab = tabs.find((t) => t.url?.includes(videoId));
          return tab
            ? (await chrome.tabs.sendMessage(tab.id, { type: "GET_VIDEO" }))
                .capturing
            : false;
        }, id),
      { timeout: 10000 },
    )
    .toBe(true);
  const panel = await context.newPage();
  const cspFailures = [];
  panel.on("console", (message) => {
    if (/Content Security Policy|violates.*connect-src/i.test(message.text()))
      cspFailures.push("OCR loader triggered a CSP violation");
  });
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  const send = (type, fields = {}) =>
    panel.evaluate(
      async ({ type, fields }) => {
        const result = await chrome.runtime.sendMessage({ type, ...fields });
        if (result?.error) throw new Error(result.error);
        return result.data;
      },
      { type, fields },
    );
  await send("SAVE_SETTINGS", {
    value: {
      apiKey: "test-key-only",
      model: "test-model",
      verifierModel: "test-verifier",
      interval: 3,
      profile: "performance",
      deep: true,
      sage: true,
      autoNotes: false,
    },
  });
  await watch.bringToFront();
  await panel.waitForFunction(
    () =>
      document.querySelector("#video-title").textContent ===
      "Controlled React Tutorial",
    { timeout: 15000 },
  );
  let state = await send("STATE");
  assert.ok(state.sessions.find((s) => s.id === id));
  assert.ok(
    state.sessions.find((s) => s.id === id).transcript.length > 0,
    "Content script must capture the visible transcript",
  );
  const result = await send("GENERATE", {
    videoId: id,
    mode: "notes",
    query: "",
  });
  assert.equal(result.verification.status, "supported");
  assert.ok(result.evidence[0].videoId === id);
  await send("GRAPH", { videoId: id }).catch(() => {}); // Invalid mocked graph must fail safely.
  await send("PIN", { videoId: id, pinned: true });
  state = await send("STATE");
  assert.equal(state.sessions.find((s) => s.id === id).pinned, true);
  await worker.evaluate(() =>
    chrome.runtime.sendMessage({ type: "FRAME_AVAILABLE" }).catch(() => {}),
  );
  await panel.locator("[data-pdf]").first().waitFor();
  const printTab = context.waitForEvent("page");
  await panel.locator("[data-pdf]").first().click();
  const pdfExport = await printTab;
  await pdfExport.locator("#document .source").first().waitFor();
  assert.match(
    await pdfExport.locator("#document").textContent(),
    /Source references/,
  );
  await pdfExport.close();
  // Smoke-test the production OCR module and local assets on an extension origin.
  const ocr = await panel.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 900, 180);
    ctx.fillStyle = "black";
    ctx.font = "bold 54px Arial";
    ctx.fillText("REACT STATE 123", 40, 100);
    const { recognize } = await import(chrome.runtime.getURL("ocr.js"));
    return recognize(canvas.toDataURL("image/png"));
  });
  assert.match(ocr.text, /REACT\s+STATE\s+123/i);
  assert.ok(ocr.confidence > 50);
  assert.deepEqual(cspFailures, []);
  assert.equal(
    await panel.evaluate(async () =>
      (await fetch(chrome.runtime.getURL("ocr/tesseract-core-simd-lstm.js")))
        .text()
        .then((s) => s.includes("data:application/octet-stream;base64,AGFzb")),
    ),
    false,
  );
  const keyResult = await panel.evaluate(() =>
    chrome.storage.local.get("settings"),
  );
  assert.equal(keyResult.settings.apiKey, "test-key-only");
  console.log(
    "Real helper health from extension worker:",
    JSON.stringify(
      await panel.evaluate(() =>
        chrome.runtime.sendMessage({
          type: "MEDIA_HELPER",
          operation: "health",
        }),
      ),
    ),
  );
  // Captionless native workspace obtains full audio via the local helper bridge.
  const helperJob = "11111111-1111-4111-8111-111111111111";
  await context.route("http://127.0.0.1:4175/**", (route) => {
    const url = new URL(route.request().url());
    const headers = {
      "access-control-allow-origin": `chrome-extension://${extensionId}`,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/audio/0"))
      return route.fulfill({
        headers,
        contentType: "audio/mpeg",
        body: Buffer.from("controlled audio bytes"),
      });
    const value = url.pathname.endsWith("/health")
      ? { ready: true, paired: true }
      : route.request().method() === "POST"
        ? { id: helperJob, status: "processing" }
        : {
            status: "ready",
            metadata: {
              title: "Controlled React Tutorial",
              duration: 12,
              audioPrimary: false,
            },
            chunks: [
              {
                start: 0,
                end: 12,
                audioUrl: `/api/media/${helperJob}/audio/0`,
              },
            ],
          };
    return route.fulfill({
      headers,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  await context.route(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          segments: [
            { text: "Install Node.js. Run npm install.", start: 0, end: 10 },
          ],
        }),
      }),
  );
  await send("CLEAR");
  await send("SESSION", { videoId: id, title: "Controlled React Tutorial" });
  await watch.bringToFront();
  await embedded.locator("#settings-dialog").evaluate((dialog) => {
    if (dialog.open) dialog.close();
  });
  await embedded.locator('[data-tab="notes"]').click();
  await embedded.locator('[data-generate="notes"]').click();
  await expect
    .poll(
      async () =>
        (await send("STATE")).sessions.find((s) => s.id === id)?.ingestCoverage
          ?.status,
      { timeout: 20000 },
    )
    .toBe("complete");
  await expect
    .poll(
      async () =>
        (await send("STATE")).sessions
          .find((s) => s.id === id)
          ?.outputs?.some((o) => o.mode === "notes" && !o.processing),
      { timeout: 20000 },
    )
    .toBe(true);
  assert.equal(
    (await send("STATE")).sessions.find((s) => s.id === id).captionSource,
    "audio transcription",
  );
  await send("CLEAR");
  state = await send("STATE");
  assert.equal(state.sessions.length, 0);
  assert.equal(state.nodes.length, 0);
  await probeYouTube(context, panel, send);
  await worker.evaluate(async () => {
    if (!(await chrome.offscreen.hasDocument()))
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Controlled audio-worker lifecycle test.",
      });
  });
  assert.equal((await send("AUDIO_HEARTBEAT", { videoId: id })).active, false);
  assert.equal((await send("AUDIO_STOP")).active, false);
  await worker.evaluate(() => chrome.offscreen.closeDocument());
  await watch.bringToFront();
  const navigationCount = await watch.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  const watchTabId = await worker.evaluate(
    async (videoId) =>
      (await chrome.tabs.query({ url: "https://www.youtube.com/*" })).find(
        (t) => t.url?.includes(videoId),
      ).id,
    id,
  );
  await worker.evaluate(
    ({ tabId, videoId }) =>
      chrome.tabs.sendMessage(tabId, { type: "CAPTURE_START", videoId }),
    { tabId: watchTabId, videoId: id },
  );
  for (const nextId of [
    "spa00000001",
    "spa00000002",
    "short000001",
    "short000002",
    id,
  ]) {
    await watch.evaluate((videoId) => {
      document.dispatchEvent(new Event("yt-navigate-start"));
      history.pushState(
        {},
        "",
        videoId.startsWith("short")
          ? `/shorts/${videoId}`
          : `/watch?v=${videoId}`,
      );
      document
        .querySelectorAll("script[data-spa-source], ytd-reel-video-renderer")
        .forEach((node) => node.remove());
      document.querySelectorAll("script:not([src])").forEach((node) => {
        if (node.textContent.includes("ytInitialPlayerResponse")) node.remove();
      });
      const metadata = document.createElement("script");
      metadata.dataset.spaSource = "true";
      metadata.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { videoId, title: `Tutorial ${videoId}` }, playabilityStatus: { status: "OK" } })};`;
      document.body.append(metadata);
      if (videoId.startsWith("short")) {
        const reel = document.createElement("ytd-reel-video-renderer");
        reel.setAttribute("is-active", "");
        const title = document.createElement("h2");
        title.textContent = `Tutorial ${videoId}`;
        reel.append(title, document.createElement("video"));
        document.body.append(reel);
      }
      document.querySelector("h1").textContent = `Tutorial ${videoId}`;
      for (const segment of document.querySelectorAll(
        "ytd-transcript-segment-renderer",
      ))
        segment.remove();
      const segment = document.createElement("ytd-transcript-segment-renderer");
      segment.textContent = `0:10 10 secondsSource for ${videoId}`;
      document.body.append(segment);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    }, nextId);
    await expect
      .poll(
        async () =>
          (await send("STATE")).sessions.find((s) => s.id === nextId)
            ?.transcript?.[0]?.text,
        { timeout: 10000 },
      )
      .toBe(`Source for ${nextId}`);
    const info = await worker.evaluate(
      (tabId) => chrome.tabs.sendMessage(tabId, { type: "GET_VIDEO" }),
      watchTabId,
    );
    assert.equal(info.videoId, nextId);
    assert.equal(info.capturing, true);
  }
  assert.equal(
    await watch.evaluate(
      () => performance.getEntriesByType("navigation").length,
    ),
    navigationCount,
  );
  // Reloading an unpacked extension invalidates receivers in existing tabs.
  // Recover that real state without refreshing or navigating the video page.
  await watch.bringToFront();
  const restarted = context
    .waitForEvent("serviceworker", { timeout: 15000 })
    .catch(() => null);
  await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await watch.waitForTimeout(1000);
  const manager = await context.newPage();
  await manager.goto("chrome://extensions/");
  await manager.evaluate(
    (id) => chrome.management.setEnabled(id, true),
    extensionId,
  );
  const recovery = await context.newPage();
  await recovery.goto(`chrome-extension://${extensionId}/panel.html#settings`);
  await restarted;
  const recovered = await recovery.evaluate(async (videoId) => {
    const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
    const tab = tabs.find((t) => t.url?.includes(videoId));
    const response = await chrome.runtime.sendMessage({
      type: "CONNECT_VIDEO",
      tabId: tab.id,
    });
    if (response.error) throw new Error(response.error);
    return response.data;
  }, id);
  assert.equal(recovered.videoId, id);
  console.log(
    "Packaged MV3 checks passed: automatic reconnection after extension reload, on-page drawer opening/closing/reopening and automatic indexing, service worker, YouTube fixture ingestion, real IndexedDB, Groq mock/SAGE, pin/clear, local browser OCR.",
  );
} finally {
  await context.close();
}
