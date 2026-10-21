import { agentRequest } from "./browser-agent.js";
import {
  maintainBrowserHistory,
  browserHistoryStatus,
} from "./chrome-history.js";
import { browserTaskRequest } from "./browser-task-client.js";
import { readingURL } from "./web-history.js";
import { Store } from "./db.js";
import { createService } from "./service.js";
import { audioCommand, audioClock } from "./capture-audio.js";
import { youtubeVideoId } from "./source.js";
import { connectVideoTab } from "./connection.js";
import { helperRequest } from "./helper-client.js";
const service = createService({
  store: new Store(),
  readSettings: async () =>
    (await chrome.storage.local.get("settings")).settings,
  writeSettings: (next) => chrome.storage.local.set({ settings: next }),
  emit: (m) => chrome.runtime.sendMessage(m),
});
const contentTypes = new Set([
  "SESSION",
  "TRANSCRIPT",
  "FRAME",
  "CAPTURE_ERROR",
  "ENDED",
  "DRAWER_PREFERENCE",
]);
async function dispatch(m, sender) {
  const fromContent = !sender.url?.startsWith(chrome.runtime.getURL(""));
  if (sender.id !== chrome.runtime.id) throw new Error("Untrusted sender.");
  if (fromContent) {
    if (["READING_STATUS", "PAGE_CAPTURE", "PAGE_EVENT"].includes(m.type)) {
      const tab = await chrome.tabs.get(sender.tab?.id);
      if (
        (sender.frameId && sender.frameId !== 0) ||
        sender.tab?.incognito ||
        tab?.incognito ||
        !readingURL(tab?.url)
      )
        throw new Error("This page is excluded from reading history.");
      if (
        ["PAGE_CAPTURE", "PAGE_EVENT"].includes(m.type) &&
        readingURL(m.url) !== readingURL(tab.url)
      )
        throw new Error("Page changed before capture.");
      return service.dispatch(m);
    }
    const url = new URL(sender.url);
    if (url.origin !== "https://www.youtube.com" || !contentTypes.has(m.type))
      throw new Error("Unsupported content request.");
    // MessageSender.url can retain the initial document URL after YouTube's
    // history navigation. Check the live tab URL instead of rejecting new videos.
    const currentTab =
      m.type === "DRAWER_PREFERENCE"
        ? null
        : await chrome.tabs.get(sender.tab.id);
    if (
      m.type !== "DRAWER_PREFERENCE" &&
      youtubeVideoId(currentTab.url) !== m.videoId
    )
      throw new Error("Video changed. Retry on the current video.");
  } else if (!sender.url?.startsWith(chrome.runtime.getURL("")))
    throw new Error("Untrusted extension page.");
  if (m.type === "READING_TOGGLE") {
    const result = await service.dispatch(m);
    await readingBadge();
    return result;
  }
  if (m.type === "CHROME_HISTORY_STATUS") {
    const status = await browserHistoryStatus(chrome);
    const tabs = await chrome.tabs.query({});
    return {
      ...status,
      tabs: tabs
        .filter((t) => !t.incognito && /^https?:/.test(t.url || ""))
        .map((t) => ({ title: t.title, url: t.url, active: t.active })),
    };
  }
  if (m.type === "CHROME_HISTORY_SYNC") {
    const result = await maintainBrowserHistory(chrome);
    await service.dispatch({ type: "RETENTION_ENABLE" });
    return result;
  }
  if (m.type === "BROWSER_AGENT") return agentRequest(m);
  if (m.type === "BROWSER_TASK") return browserTaskRequest(m);
  if (m.type === "REFRESH_PAGE") {
    const tab = await chrome.tabs.get(m.tabId);
    if (tab.incognito || !readingURL(tab.url))
      throw new Error(
        "This page cannot be saved. Open a readable article instead.",
      );
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "READ_PAGE_NOW" });
    } catch (error) {
      if (
        !/Receiving end does not exist|Could not establish connection/i.test(
          error.message,
        )
      )
        throw error;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["web-content.js"],
      });
      await chrome.tabs.sendMessage(tab.id, { type: "READ_PAGE_NOW" });
    }
    return { checked: true };
  }
  if (m.type === "MEDIA_HELPER") return helperRequest(m);
  if (m.type === "DRAWER_PREFERENCE") {
    if (m.width !== undefined) {
      if (!Number.isFinite(m.width) || m.width < 200 || m.width > 4096)
        throw new Error("Invalid drawer width.");
      await chrome.storage.local.set({ drawerWidth: Math.round(m.width) });
    }
    const value = await chrome.storage.local.get("drawerWidth");
    return {
      width: Number.isFinite(value.drawerWidth) ? value.drawerWidth : 460,
    };
  }
  if (m.type === "START_ACTIVE_VIDEO") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await startVideo(tab);
    return { started: !!tab?.id && !!youtubeVideoId(tab.url) };
  }
  if (m.type === "CONNECT_VIDEO") {
    const info = await connectVideoTab(m.tabId);
    if (info?.videoId && !info.navigating)
      await service.dispatch({
        type: "SESSION",
        videoId: info.videoId,
        title: info.title,
      });
    return info;
  }
  if (["AUDIO_START", "AUDIO_STOP", "AUDIO_HEARTBEAT"].includes(m.type))
    return audioCommand(m, service);
  if (m.type === "AUDIO_CLOCK") return audioClock(m, service);
  if (m.type === "NOTICE_INTERNAL") {
    await chrome.runtime
      .sendMessage({ type: "NOTICE", text: String(m.text).slice(0, 500) })
      .catch(() => {});
    return;
  }
  return service.dispatch(m);
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (
    !m?.type ||
    m.target === "offscreen" ||
    ["FRAME_AVAILABLE", "OUTPUT_AVAILABLE", "NOTICE"].includes(m.type)
  )
    return;
  if (m.type === "OPEN" && sender.id === chrome.runtime.id && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, { type: "OPEN_DRAWER" }).then(
      () => respond({ ok: true }),
      () =>
        respond({
          error: "Reload YTMind in chrome://extensions to reconnect this page.",
        }),
    );
    return true;
  }
  dispatch(m, sender).then(
    (data) => respond({ ok: true, data }),
    (e) => (
      console.warn("YTMind request failed", m.type, m.videoId || "", e.message),
      respond({
        error:
          e.name === "QuotaExceededError"
            ? "Storage is full. Export your notes, then clear data in Settings."
            : e.message,
      })
    ),
  );
  return true;
});
const configurePanel = () =>
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("YTMind panel setup:", error.message));
configurePanel();
async function readingBadge() {
  const { enabled } = await service.dispatch({ type: "READING_STATUS" });
  await chrome.action?.setBadgeText?.({ text: enabled ? "ON" : "OFF" });
  await chrome.action?.setBadgeBackgroundColor?.({
    color: enabled ? "#34513d" : "#6f6f6f",
  });
  await chrome.action?.setTitle?.({
    title: `YTMind · Reading history ${enabled ? "on" : "paused"}`,
  });
}
readingBadge().catch(() => {});
async function startVideo(tab, audio = true) {
  if (!tab?.id || !youtubeVideoId(tab.url)) return;
  const info = await connectVideoTab(tab.id);
  if (!info?.videoId || info.navigating) return;
  await service.dispatch({
    type: "SESSION",
    videoId: info.videoId,
    title: info.title,
  });
  const config = await service.dispatch({ type: "SETTINGS" });
  const s = await service.dispatch({
    type: "SOURCE_STATE",
    videoId: info.videoId,
  });
  if (config.autoNotes && config.apiKey && s?.transcriptCount && !s.hasNotes)
    service
      .dispatch({
        type: "GENERATE",
        videoId: info.videoId,
        mode: "notes",
        auto: true,
      })
      .catch(() => {});
  await chrome.tabs.sendMessage(tab.id, {
    type: "CAPTURE_START",
    videoId: info.videoId,
    interval: config.interval,
    profile: config.profile,
  });
  if (audio && config.apiKey && !s?.transcriptCount) {
    const health = await helperRequest({ operation: "health" }).catch(
      () => null,
    );
    if (health?.ready && health?.paired) {
      await service.dispatch({
        type: "AUDIO_STATE",
        videoId: info.videoId,
        status: "idle",
        message:
          "Full-video audio is available. Generate notes to transcribe it with Groq.",
      });
      return;
    }
  }
  if (audio && config.apiKey && !s?.transcriptCount)
    await audioCommand(
      { type: "AUDIO_START", tabId: tab.id, videoId: info.videoId },
      service,
    ).catch((e) =>
      chrome.runtime
        .sendMessage({ type: "NOTICE", text: e.message })
        .catch(() => {}),
    );
  else if (audio && !config.apiKey)
    await service.dispatch({
      type: "AUDIO_STATE",
      videoId: info.videoId,
      status: "needs-key",
      message:
        "Save your Groq API key in extension Settings to transcribe this video's audio.",
    });
}
chrome.action?.onClicked.addListener((tab) => {
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .then(() => startVideo(tab))
    .catch((error) => console.error("YTMind panel opening:", error.message));
});
const cleanup = () =>
  Promise.allSettled([service.cleanup(), maintainBrowserHistory(chrome)]);
chrome.runtime.onInstalled.addListener(() => {
  configurePanel();
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  chrome.alarms.create("cleanup", { periodInMinutes: 5 });
  cleanup();
  // Updating/reloading an extension does not refresh existing YouTube tabs.
  // Reattach their content script so the on-page launcher returns immediately.
  chrome.tabs
    .query({ url: ["http://*/*", "https://*/*"] })
    .then((tabs) =>
      Promise.allSettled(
        tabs
          .filter(
            (tab) =>
              !tab.incognito &&
              (youtubeVideoId(tab.url) || readingURL(tab.url)),
          )
          .map((tab) =>
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [
                youtubeVideoId(tab.url) ? "content.js" : "web-content.js",
              ],
            }),
          ),
      ),
    )
    .catch(() => {});
});
chrome.runtime.onStartup.addListener(cleanup);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "cleanup") cleanup();
});
export { dispatch };
