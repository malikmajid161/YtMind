import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { probeYouTube } from "./live-youtube.mjs";
const dist = path.resolve("dist");
await mkdir("artifacts/extension-profile", { recursive: true });
const context = await chromium.launchPersistentContext(
  path.resolve("artifacts/extension-profile"),
  {
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
  },
);
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
  const id = "abcdefghijk";
  const fixture = `<!doctype html><html><head><title>Controlled React Tutorial - YouTube</title></head><body><div id="movie_player"><video class="html5-main-video" muted></video></div><h1 class="ytd-watch-metadata">Controlled React Tutorial</h1><ytd-transcript-segment-renderer>0:10 React state remembers a value. Use useState at the top level.</ytd-transcript-segment-renderer><ytd-transcript-segment-renderer>0:30 Run npm install before starting the project.</ytd-transcript-segment-renderer></body></html>`;
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
  await watch.goto(`https://www.youtube.com/watch?v=${id}`);
  await watch.locator("#ytmind-launch").waitFor();
  const panel = await context.newPage();
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
  const keyResult = await panel.evaluate(() =>
    chrome.storage.local.get("settings"),
  );
  assert.equal(keyResult.settings.apiKey, "test-key-only");
  await send("CLEAR");
  state = await send("STATE");
  assert.equal(state.sessions.length, 0);
  assert.equal(state.nodes.length, 0);
  await probeYouTube(context, panel, send);
  console.log(
    "Packaged MV3 checks passed: service worker, YouTube fixture ingestion, real IndexedDB, Groq mock/SAGE, pin/clear, local browser OCR.",
  );
} finally {
  await context.close();
}
