import { Store } from "./db.js";
import { createService } from "./service.js";
import { audioCommand, audioClock } from "./capture-audio.js";
import { youtubeVideoId } from "./source.js";
import { connectVideoTab } from "./connection.js";
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
]);
async function dispatch(m, sender) {
  const fromContent = !sender.url?.startsWith(chrome.runtime.getURL(""));
  if (sender.id !== chrome.runtime.id) throw new Error("Untrusted sender.");
  if (fromContent) {
    const url = new URL(sender.url);
    if (url.origin !== "https://www.youtube.com" || !contentTypes.has(m.type))
      throw new Error("Unsupported content request.");
    // MessageSender.url can retain the initial document URL after YouTube's
    // history navigation. Check the live tab URL instead of rejecting new videos.
    const currentTab = await chrome.tabs.get(sender.tab.id);
    if (youtubeVideoId(currentTab.url) !== m.videoId)
      throw new Error("Video changed. Retry on the current video.");
  } else if (!sender.url?.startsWith(chrome.runtime.getURL("")))
    throw new Error("Untrusted extension page.");
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
    ["FRAME_AVAILABLE", "NOTICE"].includes(m.type)
  )
    return;
  if (m.type === "OPEN" && sender.id === chrome.runtime.id && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(
      () => {
        startVideo(sender.tab).catch((error) =>
          chrome.runtime
            .sendMessage({ type: "NOTICE", text: error.message })
            .catch(() => {}),
        );
        respond({ ok: true });
      },
      () => respond({ error: "Use the toolbar icon to open YTMind." }),
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
  if (audio && config.apiKey)
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
const cleanup = () => service.cleanup().catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  configurePanel();
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  chrome.alarms.create("cleanup", { periodInMinutes: 60 });
  cleanup();
  // Updating/reloading an extension does not refresh existing YouTube tabs.
  // Reattach their content script so the on-page launcher returns immediately.
  chrome.tabs
    .query({ url: "https://www.youtube.com/*" })
    .then((tabs) =>
      Promise.allSettled(
        tabs
          .filter((tab) => youtubeVideoId(tab.url))
          .map((tab) => connectVideoTab(tab.id)),
      ),
    )
    .catch(() => {});
});
chrome.runtime.onStartup.addListener(cleanup);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "cleanup") cleanup();
});
export { dispatch };
