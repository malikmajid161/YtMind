import { access, writeFile } from "node:fs/promises";
export async function probeYouTube(context, panel, send) {
  try {
    await access(".env.local");
    await access("research/results/youtube-live.json");
    return;
  } catch {}
  try {
    await access(".env.local");
  } catch {
    return;
  }
  const id = "Tn6-PIqc4UM",
    url = `https://www.youtube.com/watch?v=${id}`;
  const report = {
    date: new Date().toISOString(),
    scope:
      "Single public technical-video ingestion smoke probe; not a corpus benchmark",
    url,
    videoId: id,
    captionSegments: 0,
    capturedFrames: 0,
  };
  let page;
  try {
    await context.unroute("https://www.youtube.com/**");
    page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (page.url().includes("consent.")) {
      const reject = page.getByRole("button", { name: /Reject all/i });
      if (await reject.count()) await reject.first().click();
    }
    await page.locator("#ytmind-launch").waitFor({ timeout: 30000 });
    const play = page.locator(".ytp-play-button");
    const paused = await page
      .locator("video.html5-main-video")
      .evaluate((video) => video.paused)
      .catch(() => true);
    if (paused && (await play.count()))
      await play
        .first()
        .click()
        .catch(() => {});
    const start = Date.now();
    let found;
    while (Date.now() - start < 65000) {
      const state = await send("STATE");
      found = state.sessions.find((s) => s.id === id);
      if (
        found?.captionStatus === "ready" ||
        found?.captionStatus === "unavailable"
      )
        break;
      const skip = page.locator(".ytp-ad-skip-button, .ytp-skip-ad-button");
      if (
        await skip
          .first()
          .isVisible()
          .catch(() => false)
      )
        await skip
          .first()
          .click()
          .catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
    report.title = found?.title;
    report.captionStatus = found?.captionStatus || "pending";
    report.captionSegments = found?.transcript.length || 0;
    report.player = await page.evaluate(() => {
      const v = document.querySelector("video.html5-main-video");
      return {
        paused: v?.paused,
        readyState: v?.readyState,
        time: v?.currentTime,
        adShowing: document
          .querySelector("#movie_player")
          ?.classList.contains("ad-showing"),
      };
    });
    const tabs = await panel.evaluate(() =>
      chrome.tabs.query({ url: "https://www.youtube.com/watch*" }),
    );
    const target = tabs.find((t) => t.url?.includes(id));
    if (target) {
      await panel.evaluate(
        ({ tabId, videoId }) =>
          chrome.tabs.sendMessage(tabId, { type: "CAPTURE_ONCE", videoId }),
        { tabId: target.id, videoId: id },
      );
      await new Promise((r) => setTimeout(r, 1500));
      report.capturedFrames = (await send("FRAMES", { videoId: id })).length;
    }
    report.status = report.captionSegments
      ? "caption-source-ready"
      : "caption-source-unavailable-or-pending";
  } catch (e) {
    report.status = "probe-failed";
    report.error = e.message.slice(0, 1000);
  } finally {
    await writeFile(
      "research/results/youtube-live.json",
      JSON.stringify(report, null, 2),
    );
    await page?.close();
  }
  console.log(
    JSON.stringify({
      liveYouTube: report.status,
      captionSegments: report.captionSegments,
      capturedFrames: report.capturedFrames,
    }),
  );
}
