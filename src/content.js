import { TranscriptFetcher } from "./transcript.js";
import { frameSignal, frameDifference } from "./core.js";
try {
  performance.setResourceTimingBufferSize(3000);
} catch {}
const id = () =>
  location.pathname === "/watch"
    ? (() => {
        const value = new URLSearchParams(location.search).get("v");
        return /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
      })()
    : null;
let current = null,
  lease = 0,
  interval = 5,
  resolution = 1600,
  lastCapture = 0,
  lastPrint = null,
  busy = false,
  epoch = 0,
  endedVideo = null,
  captionController = null;
const send = async (m) => {
  const r = await chrome.runtime.sendMessage(m);
  if (r?.error) throw new Error(r.error);
  return r?.data;
};
async function captions(videoId, token) {
  const result = await new TranscriptFetcher(captionController?.signal).fetch(
    videoId,
  );
  if (current !== videoId || epoch !== token) return;
  if (result.title && result.title !== "YouTube")
    await send({ type: "SESSION", videoId, title: result.title });
  await send({
    type: "TRANSCRIPT",
    videoId,
    segments: result.transcript,
    source: result.source,
  });
}
async function navigate(force = false) {
  const next = id();
  if (next === current && !force) return;
  current = next;
  const token = ++epoch;
  captionController?.abort();
  captionController = new AbortController();
  lease = 0;
  lastPrint = null;
  lastCapture = 0;
  endedVideo = null;
  document.getElementById("ytmind-launch")?.remove();
  if (!next) return;
  const button = document.createElement("button");
  button.id = "ytmind-launch";
  button.textContent = "✦ YTMind";
  button.title = "Open your video study workspace";
  Object.assign(button.style, {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    zIndex: "2000",
    background: "#b9f078",
    color: "#172316",
    border: "1px solid #243a23",
    borderRadius: "24px",
    padding: "12px 18px",
    font: "600 14px system-ui",
    cursor: "pointer",
    boxShadow: "0 4px 24px #0004",
  });
  button.onclick = () => send({ type: "OPEN" }).catch(() => {});
  document.body.append(button);
  await send({
    type: "SESSION",
    videoId: next,
    title:
      document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() ||
      document.title.replace(/ - YouTube$/, ""),
  });
  captions(next, token).catch(() => {
    if (current === next && epoch === token)
      send({ type: "TRANSCRIPT", videoId: next, segments: [] }).catch(() => {});
  });
}
async function capture(manual = false) {
  const video = document.querySelector("video.html5-main-video");
  if (
    busy ||
    !current ||
    !video ||
    video.readyState < 2 ||
    document.querySelector(
      "#movie_player.ad-showing, #movie_player.ad-interrupting",
    ) ||
    document.hidden
  )
    return;
  if (
    !manual &&
    (Date.now() > lease ||
      video.paused ||
      Date.now() - lastCapture < interval * 1000)
  )
    return;
  busy = true;
  const videoId = current,
    token = epoch;
  lastCapture = Date.now();
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(resolution, video.videoWidth);
    canvas.height = Math.round(
      (canvas.width * video.videoHeight) / video.videoWidth,
    );
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const small = document.createElement("canvas");
    small.width = 160;
    small.height = 90;
    const sc = small.getContext("2d", { willReadFrequently: true });
    sc.drawImage(canvas, 0, 0, 160, 90);
    const signal = frameSignal(sc.getImageData(0, 0, 160, 90).data, 160, 90);
    if (
      !manual &&
      (!signal.useful || frameDifference(lastPrint, signal.fingerprint) < 8)
    )
      return;
    const image = canvas.toDataURL("image/jpeg", 0.65);
    if (current !== videoId || epoch !== token) return;
    await send({ type: "FRAME", videoId, timestamp: video.currentTime, image });
    lastPrint = signal.fingerprint;
  } catch {
    lease = 0;
    send({ type: "CAPTURE_ERROR", videoId }).catch(() => {});
  } finally {
    busy = false;
  }
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (m.type === "GET_VIDEO") {
    respond({
      videoId: current,
      title: document
        .querySelector("h1.ytd-watch-metadata")
        ?.textContent?.trim(),
      capturing: Date.now() < lease,
    });
    return;
  }
  if (m.videoId !== current) {
    respond({ error: "Video changed. Refresh the panel." });
    return;
  }
  if (m.type === "CAPTURE_START") {
    lease = Date.now() + 15000;
    interval = m.interval || 5;
    resolution = m.profile === "balanced" ? 960 : 1600;
    respond({ ok: true });
  }
  if (m.type === "CAPTURE_STOP") {
    lease = 0;
    respond({ ok: true });
  }
  if (m.type === "CAPTURE_ONCE") {
    capture(true);
    respond({ ok: true });
  }
  if (m.type === "SEEK") {
    const video = document.querySelector("video.html5-main-video");
    if (video) video.currentTime = Math.max(0, Number(m.timestamp) || 0);
    respond({ ok: true });
  }
  if (m.type === "RETRY_CAPTIONS") {
    captions(current, epoch).catch(() => {});
    respond({ ok: true });
  }
});
document.addEventListener("yt-navigate-finish", () =>
  navigate(true).catch(() => {}),
);
document.addEventListener("yt-navigate-start", () => {
  lease = 0;
  ++epoch;
  captionController?.abort();
});
setInterval(() => {
  if (!chrome.runtime?.id) return;
  if (id() !== current) navigate().catch(() => {});
  capture().catch(() => {});
  const video = document.querySelector("video.html5-main-video");
  if (video?.ended && current && endedVideo !== current) {
    endedVideo = current;
    send({ type: "ENDED", videoId: current }).catch(() => {});
  }
}, 1000);
navigate().catch(() => {});
