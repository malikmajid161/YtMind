let creating;
import { youtubeVideoId } from "./source.js";
async function ensureOffscreen() {
  if (!(await chrome.offscreen.hasDocument())) {
    if (!creating)
      creating = chrome.offscreen
        .createDocument({
          url: "offscreen.html",
          reasons: ["USER_MEDIA"],
          justification:
            "Transcribe the YouTube tab the user started indexing, without repeated capture dialogs.",
        })
        .finally(() => (creating = null));
    await creating;
  }
  // Document creation can complete before its message handler is installed.
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await offscreen("READY");
      return;
    } catch (error) {
      if (
        !/Receiving end does not exist|Could not establish connection/i.test(
          error.message,
        ) ||
        attempt === 9
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
async function offscreen(type, fields = {}) {
  if (!(await chrome.offscreen.hasDocument())) return { active: false };
  const result = await chrome.runtime.sendMessage({
    target: "offscreen",
    type,
    ...fields,
  });
  if (result?.error) throw new Error(result.error);
  return result?.data;
}
export async function audioCommand(m, service) {
  try {
    const result = await handleAudio(m, service);
    if (m.type === "AUDIO_START")
      await service.dispatch({
        type: "AUDIO_STATE",
        videoId: m.videoId,
        status: result?.active ? "listening" : "idle",
        message: result?.reason || "",
      });
    return result;
  } catch (error) {
    if (m.type === "AUDIO_START")
      await service.dispatch({
        type: "AUDIO_STATE",
        videoId: m.videoId,
        status: "error",
        message: error.message,
      });
    throw error;
  }
}
async function handleAudio(m, service) {
  if (m.type === "AUDIO_STOP") return offscreen("STOP");
  if (m.type === "AUDIO_HEARTBEAT")
    return offscreen("HEARTBEAT", { videoId: m.videoId });
  const tab = await chrome.tabs.get(m.tabId);
  const url = new URL(tab.url);
  if (
    url.origin !== "https://www.youtube.com" ||
    youtubeVideoId(tab.url) !== m.videoId
  )
    throw new Error("Open the current YouTube watch tab before indexing.");
  const s = await service.dispatch({
    type: "SOURCE_STATE",
    videoId: m.videoId,
  });
  if (!s) throw new Error("Video session is not ready.");
  if (s.hasTranscript)
    return { active: false, reason: "Existing transcript is available." };
  if (s.captionStatus === "blocked")
    throw new Error(
      `YouTube blocked playback: ${s.captionMessage || "check the video player"}. Retry captions after playback is available.`,
    );
  const config = await service.dispatch({ type: "SETTINGS" });
  if (!config.apiKey)
    throw new Error("Add your Groq key before live audio transcription.");
  await ensureOffscreen();
  const existing = await offscreen("HEARTBEAT", { videoId: m.videoId });
  if (existing?.active) return existing;
  await offscreen("STOP");
  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: m.tabId,
    });
  } catch {
    throw new Error(
      "Click YTMind's toolbar icon on this video once, then start indexing. No recording chooser is required.",
    );
  }
  return offscreen("START", {
    streamId,
    tabId: m.tabId,
    videoId: m.videoId,
    createdAt: s.createdAt,
  });
}
export async function audioClock(m, service) {
  const tab = await chrome.tabs.get(m.tabId);
  const url = new URL(tab.url);
  if (
    url.origin !== "https://www.youtube.com" ||
    youtubeVideoId(tab.url) !== m.videoId
  )
    throw new Error("The captured video changed.");
  const info = await chrome.tabs.sendMessage(m.tabId, { type: "GET_VIDEO" });
  const s = await service.dispatch({
    type: "SOURCE_STATE",
    videoId: m.videoId,
  });
  if (!s || s.createdAt !== m.createdAt)
    throw new Error("Audio session was cleared or expired.");
  return {
    ...info,
    hasTranscript: s.hasTranscript,
  };
}
