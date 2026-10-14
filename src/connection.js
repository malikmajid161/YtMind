import { youtubeVideoId } from "./source.js";

const pending = new Map();
export async function connectVideoTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!youtubeVideoId(tab.url)) return null;
  if (pending.has(tabId)) return pending.get(tabId);
  const connect = (async () => {
    const ping = async () => {
      const info = await chrome.tabs.sendMessage(tabId, { type: "GET_VIDEO" });
      const current = await chrome.tabs.get(tabId);
      return info?.videoId !== youtubeVideoId(current.url)
        ? { ...info, navigating: true }
        : info;
    };
    try {
      return await ping();
    } catch (error) {
      if (
        !/Receiving end does not exist|Could not establish connection/i.test(
          error.message,
        )
      )
        throw error;
    }
    // Existing tabs lose the content-script receiver when an extension reloads.
    // Reattach only the bundled script, only on an authorized YouTube video.
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return ping();
  })();
  pending.set(tabId, connect);
  try {
    return await connect;
  } finally {
    pending.delete(tabId);
  }
}
