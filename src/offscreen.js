import { transcribeAudio } from "./audio.js";
let current = null;
const send = async (type, fields = {}) => {
  const response = await chrome.runtime.sendMessage({ type, ...fields });
  if (response?.error) throw new Error(response.error);
  return response?.data;
};
const notify = (text) => send("NOTICE_INTERNAL", { text }).catch(() => {});
function flush(c, discard = false) {
  const segment = c.segment;
  if (!segment) return;
  c.segment = null;
  segment.discard ||= discard;
  if (segment.recorder.state !== "inactive") segment.recorder.stop();
}
async function shutdown() {
  const c = current;
  current = null;
  if (!c) return;
  c.stopped = true;
  c.controller.abort();
  clearInterval(c.timer);
  flush(c, true);
  c.stream.getTracks().forEach((t) => t.stop());
  await c.output.close().catch(() => {});
}
function begin(c, clock) {
  const recorder = new MediaRecorder(c.stream, {
    mimeType: "audio/webm;codecs=opus",
  });
  const segment = {
    recorder,
    parts: [],
    offset: clock.currentTime,
    end: clock.currentTime,
    started: Date.now(),
    discard: false,
  };
  c.segment = segment;
  recorder.ondataavailable = (e) => {
    if (e.data.size) segment.parts.push(e.data);
  };
  recorder.onstop = () => {
    if (segment.discard || c.stopped || segment.end - segment.offset < 2)
      return;
    const file = new File(segment.parts, "tab.webm", { type: "audio/webm" });
    if (c.pending >= 2) {
      notify(
        "Audio processing is behind playback; a section was skipped. Pause playback or import the full audio for complete coverage.",
      );
      return;
    }
    c.pending++;
    c.queue = c.queue
      .then(async () => {
        if (c.stopped) return;
        const config = await send("SETTINGS");
        const segments = (
          await transcribeAudio(file, config.apiKey, {
            offset: segment.offset,
            language: config.audioLanguage || "",
            signal: c.controller.signal,
          })
        ).filter((s) => s.startTime <= segment.end);
        if (segments.length && !c.stopped)
          await send("AUDIO_APPEND", {
            videoId: c.videoId,
            expectedCreatedAt: c.createdAt,
            segments,
          });
      })
      .catch((e) => {
        if (!c.stopped) notify(e.message);
      })
      .finally(() => c.pending--);
  };
  recorder.onerror = () => {
    flush(c, true);
    notify("Live audio capture failed. Import the video audio instead.");
  };
  recorder.start();
}
async function tick(c) {
  if (c.ticking || current !== c) return;
  c.ticking = true;
  try {
    if (Date.now() > c.lease) {
      await shutdown();
      return;
    }
    const clock = await send("AUDIO_CLOCK", {
      tabId: c.tabId,
      videoId: c.videoId,
      createdAt: c.createdAt,
    });
    if (clock.videoId !== c.videoId || clock.hasTranscript) {
      await shutdown();
      return;
    }
    const playing =
      !clock.paused && !clock.adShowing && clock.playbackRate === 1;
    if (c.segment) {
      const expected = (Date.now() - c.lastWall) / 1000;
      const delta = clock.currentTime - c.lastTime;
      const jumped = !clock.paused && Math.abs(delta - expected) > 2;
      if (jumped || clock.adShowing || clock.playbackRate !== 1) flush(c, true);
      else {
        c.segment.end = clock.currentTime;
        if (
          !playing ||
          Date.now() - c.segment.started >= (c.firstChunkSaved ? 30000 : 10000)
        ) {
          flush(c);
          c.firstChunkSaved = true;
        }
      }
    }
    if (playing && !c.segment && c.pending < 2) begin(c, clock);
    c.lastTime = clock.currentTime;
    c.lastWall = Date.now();
  } catch (e) {
    notify(e.message);
    await shutdown();
  } finally {
    c.ticking = false;
  }
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (sender.id !== chrome.runtime.id || m.target !== "offscreen") return;
  (async () => {
    if (m.type === "READY") return { ready: true };
    if (m.type === "STOP") {
      await shutdown();
      return { active: false };
    }
    if (m.type === "HEARTBEAT") {
      if (current?.videoId === m.videoId) current.lease = Date.now() + 15000;
      return {
        active: current?.videoId === m.videoId,
        pending: current?.pending || 0,
      };
    }
    if (m.type === "START") {
      await shutdown();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: m.streamId,
          },
        },
        video: false,
      });
      const output = new AudioContext();
      output.createMediaStreamSource(stream).connect(output.destination);
      await output.resume();
      const c = {
        stream,
        output,
        tabId: m.tabId,
        videoId: m.videoId,
        createdAt: m.createdAt,
        lease: Date.now() + 15000,
        pending: 0,
        queue: Promise.resolve(),
        controller: new AbortController(),
        stopped: false,
      };
      current = c;
      c.timer = setInterval(() => tick(c), 1000);
      await tick(c);
      return { active: current === c };
    }
    throw new Error("Unknown audio worker request.");
  })().then(
    (data) => respond({ data }),
    (e) => respond({ error: e.message }),
  );
  return true;
});
