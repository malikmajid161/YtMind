import { Store } from "./db.js";
import { createService } from "./service.js";
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
    if (url.searchParams.get("v") !== m.videoId)
      throw new Error("Video changed. Retry on the current video.");
  } else if (!sender.url?.startsWith(chrome.runtime.getURL("")))
    throw new Error("Untrusted extension page.");
  return service.dispatch(m);
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (!m?.type || ["FRAME_AVAILABLE", "NOTICE"].includes(m.type)) return;
  if (m.type === "OPEN" && sender.id === chrome.runtime.id && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(
      () => respond({ ok: true }),
      () => respond({ error: "Use the toolbar icon to open YTMind." }),
    );
    return true;
  }
  dispatch(m, sender).then(
    (data) => respond({ ok: true, data }),
    (e) =>
      respond({
        error:
          e.name === "QuotaExceededError"
            ? "Storage is full. Export your notes, then clear data in Settings."
            : e.message,
      }),
  );
  return true;
});
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
const cleanup = () => service.cleanup().catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  chrome.alarms.create("cleanup", { periodInMinutes: 60 });
  cleanup();
});
chrome.runtime.onStartup.addListener(cleanup);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "cleanup") cleanup();
});
export { dispatch };
