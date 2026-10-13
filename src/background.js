import { Store } from "./db.js";
import {
  defaults,
  chunks,
  retrieve,
  similarity,
  batchEvidence,
} from "./core.js";
import { generate, extractGraph } from "./agents.js";
import { analyzeLab } from "./lab.js";
import { listModels } from "./groq.js";
const store = new Store();
let queue = Promise.resolve();
const mutate = (fn) => {
  const next = queue.then(fn);
  queue = next.catch(() => {});
  return next;
};
const settings = async () => ({
  ...defaults,
  ...(await chrome.storage.local.get("settings")).settings,
});
const contentTypes = new Set([
  "SESSION",
  "TRANSCRIPT",
  "FRAME",
  "CAPTURE_ERROR",
  "ENDED",
]);
const busy = new Set();
let dataEpoch = 0;
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
  switch (m.type) {
    case "SESSION":
      if (!/^[A-Za-z0-9_-]{11}$/.test(m.videoId))
        throw new Error("Invalid YouTube video identifier.");
      return mutate(() =>
        store.session({
          id: m.videoId,
          title: String(m.title || "YouTube video").slice(0, 300),
          url: `https://www.youtube.com/watch?v=${m.videoId}`,
        }),
      );
    case "TRANSCRIPT":
      return mutate(async () => {
        const s = await store.read("sessions", m.videoId);
        if (!s || s.captionStatus === "manual") return;
        const previous = JSON.stringify(s.transcript);
        s.transcript = (m.segments || [])
          .slice(0, 20000)
          .filter(
            (x) =>
              typeof x.text === "string" &&
              Number.isFinite(x.startTime) &&
              x.startTime >= 0,
          )
          .map((x) => ({
            text: x.text.slice(0, 4000),
            startTime: x.startTime,
          }));
        s.captionStatus = s.transcript.length ? "ready" : "unavailable";
        if (previous !== JSON.stringify(s.transcript))
          s.transcriptVersion = crypto.randomUUID();
        await store.put("sessions", s);
      });
    case "FRAME":
      return mutate(async () => {
        if (
          !/^data:image\/jpeg;base64,/.test(m.image) ||
          m.image.length > 1500000
        )
          throw new Error("Frame exceeds storage limit.");
        if (!(await store.read("sessions", m.videoId))) return;
        if (
          (await store.frames(m.videoId)).filter((f) => f.status === "pending")
            .length >= 6
        )
          return { skipped: true };
        const f = {
          id: crypto.randomUUID(),
          videoId: m.videoId,
          timestamp: Math.max(0, Number(m.timestamp) || 0),
          image: m.image,
          createdAt: Date.now(),
          ocrText: "",
          status: "pending",
        };
        await store.addFrame(f);
        chrome.runtime
          .sendMessage({ type: "FRAME_AVAILABLE", videoId: m.videoId })
          .catch(() => {});
        return f.id;
      });
    case "CAPTURE_ERROR":
      chrome.runtime
        .sendMessage({
          type: "NOTICE",
          text: "Visual capture is unavailable for this video. Try captions or paste a transcript.",
        })
        .catch(() => {});
      return;
    case "ENDED": {
      const config = await settings();
      if (config.autoNotes && !busy.has(m.videoId)) {
        const s = await store.read("sessions", m.videoId);
        if (s?.transcript.length) {
          runGeneration(
            {
              videoId: m.videoId,
              mode: "notes",
              query: "Study notes",
              auto: true,
            },
            config,
          ).catch(() => {});
        }
      }
      return;
    }
    case "STATE":
      await mutate(() => store.cleanup());
      return {
        sessions: await store.read("sessions"),
        nodes: await store.read("nodes"),
        edges: await store.read("edges"),
        settings: { ...(await settings()), apiKey: undefined },
      };
    case "SETTINGS":
      return settings();
    case "PROBE":
      return listModels(String(m.apiKey || (await settings()).apiKey));
    case "SAVE_SETTINGS": {
      const old = await settings();
      const next = {
        ...old,
        apiKey: String(m.value.apiKey || "").trim(),
        model: String(m.value.model || defaults.model),
        verifierModel: String(m.value.verifierModel || defaults.verifierModel),
        interval: Math.min(60, Math.max(3, Number(m.value.interval) || 5)),
        profile: m.value.profile === "balanced" ? "balanced" : "performance",
        deep: !!m.value.deep,
        sage: !!m.value.sage,
        autoNotes: !!m.value.autoNotes,
      };
      await chrome.storage.local.set({ settings: next });
      return;
    }
    case "FRAMES":
      return store.frames(m.videoId);
    case "OCR":
      return mutate(async () => {
        const f = await store.read("frames", m.id);
        if (!f) return;
        const text = String(m.text || "").slice(0, 20000);
        const previous = (await store.frames(f.videoId)).filter(
          (x) => x.status === "ready",
        );
        if (
          !text.trim() ||
          previous.some((x) => similarity(x.ocrText, text) > 0.85)
        ) {
          await store.tx(["frames"], (t) =>
            t.objectStore("frames").delete(f.id),
          );
          return;
        }
        await store.put("frames", {
          ...f,
          ocrText: text,
          status: "ready",
          confidence: Number(m.confidence) || 0,
        });
      });
    case "OCR_FAILED":
      return mutate(async () => {
        const f = await store.read("frames", m.id);
        if (f)
          await store.put("frames", {
            ...f,
            status: "failed",
            error: "OCR failed; retry this frame.",
          });
      });
    case "OCR_RETRY":
      return mutate(async () => {
        const f = await store.read("frames", m.id);
        if (f) await store.put("frames", { ...f, status: "pending" });
      });
    case "IMPORT":
      return mutate(async () => {
        const s = await store.read("sessions", m.videoId);
        if (!s) throw new Error("Open a video first.");
        const text = String(m.text || "")
          .trim()
          .slice(0, 150000);
        if (!text) throw new Error("Paste a transcript first.");
        s.transcript = text
          .split(/\n+/)
          .map((line) => ({ text: line, startTime: 0 }));
        s.captionStatus = "manual";
        s.transcriptVersion = crypto.randomUUID();
        await store.put("sessions", s);
      });
    case "PIN":
      return mutate(async () => {
        const s = await store.read("sessions", m.videoId);
        if (!s) throw new Error("Video session is unavailable.");
        s.pinned = !!m.pinned;
        await store.put("sessions", s);
      });
    case "GENERATE":
      return runGeneration(m, await settings());
    case "LAB": {
      if (busy.has(m.videoId))
        throw new Error("A request is already running for this video.");
      busy.add(m.videoId);
      const epoch = dataEpoch;
      try {
        const s = await store.read("sessions", m.videoId);
        if (!s) throw new Error("Open a video first.");
        const output = await analyzeLab(
          await settings(),
          m.mode,
          chunks(s, await store.frames(s.id)),
        );
        await mutate(async () => {
          if (epoch !== dataEpoch)
            throw new Error("Data was cleared during analysis.");
          const current = await store.read("sessions", m.videoId);
          if (!current) throw new Error("The session expired during analysis.");
          current.outputs = [...(current.outputs || []), output].slice(-200);
          await store.put("sessions", current);
        });
        return output;
      } finally {
        busy.delete(m.videoId);
      }
    }
    case "GRAPH": {
      const epoch = dataEpoch;
      const s = await store.read("sessions", m.videoId);
      if (!s) throw new Error("Open a video first.");
      const graph = await extractGraph(
        await settings(),
        retrieve(chunks(s, await store.frames(s.id)), "", "graph"),
      );
      await mutate(() => {
        if (epoch !== dataEpoch)
          throw new Error("Data was cleared during extraction.");
        return store.mergeGraph(graph);
      });
      return graph;
    }
    case "CLEAR":
      await mutate(() => {
        dataEpoch++;
        return store.clear();
      });
      return;
    default:
      throw new Error("Unknown request.");
  }
}
async function runGeneration(m, config) {
  if (busy.has(m.videoId))
    throw new Error("A request is already running for this video.");
  busy.add(m.videoId);
  const epoch = dataEpoch;
  try {
    const sessions =
      m.mode === "research"
        ? (await store.read("sessions")).filter((s) => s.pinned)
        : [await store.read("sessions", m.videoId)].filter(Boolean);
    let all = (
      await Promise.all(
        sessions.map(async (s) => chunks(s, await store.frames(s.id))),
      )
    ).flat();
    const deep =
      config.deep && ["notes", "actions"].includes(m.mode) && !m.auto;
    const jobId = deep ? String(m.jobId || crypto.randomUUID()) : null;
    if (deep) {
      const s = sessions[0];
      if (!s) throw new Error("Open a video first.");
      if (m.jobId) {
        const job = s.jobs?.find((j) => j.id === jobId && j.mode === m.mode);
        if (!job)
          throw new Error(
            "The source snapshot is no longer available. Start a new generation.",
          );
        all = job.evidence;
      } else
        await mutate(async () => {
          if (epoch !== dataEpoch) throw new Error("Data was cleared.");
          const current = await store.read("sessions", s.id);
          if (!current) throw new Error("Session expired. Reopen the video.");
          current.jobs = [
            ...(current.jobs || []),
            { id: jobId, mode: m.mode, evidence: all },
          ].slice(-4);
          await store.put("sessions", current);
        });
    }
    const batches = deep
      ? batchEvidence(all)
      : [retrieve(all, String(m.query || "").slice(0, 2000), m.mode)];
    const batchIndex = deep
      ? Math.max(0, Math.floor(Number(m.batchIndex) || 0))
      : 0;
    const evidence = batches[batchIndex] || [];
    const result = await generate(config, m.mode, m.query, evidence);
    result.coverage = { selected: evidence.length, total: all.length };
    if (deep) {
      result.batchIndex = batchIndex;
      result.totalBatches = batches.length;
      result.jobId = jobId;
    }
    await mutate(async () => {
      if (epoch !== dataEpoch)
        throw new Error("Data was cleared during generation.");
      const targetId =
        m.mode === "research"
          ? (sessions.find((s) => s.id === m.videoId) || sessions[0])?.id
          : m.videoId;
      const s = await store.read("sessions", targetId);
      if (s) {
        s.outputs = [...(s.outputs || []), result].slice(-200);
        await store.put("sessions", s);
      }
    });
    return result;
  } finally {
    busy.delete(m.videoId);
  }
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
const cleanup = () => mutate(() => store.cleanup()).catch(() => {});
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
