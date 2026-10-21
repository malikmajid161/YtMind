import { isChallengePage } from "./page-details.js";
import { pageEvidence } from "./page-source.js";
import { readingURL } from "./web-history.js";
import {
  defaults,
  chunks,
  retrieve,
  similarity,
  batchEvidence,
} from "./core.js";
import { generate, extractGraph } from "./agents.js";
import { analyzeLab } from "./lab.js";
import { analyzeDiscussion } from "./talkshow.js";
import { listModels } from "./groq.js";
import { parseTranscript, validateSegments } from "./source.js";
import { extractCode } from "./code.js";

export function createService({
  store,
  readSettings,
  writeSettings,
  emit = () => {},
}) {
  let queue = Promise.resolve();
  const mutate = (fn) => {
    const next = queue.then(() =>
      globalThis.navigator?.locks
        ? navigator.locks.request(`ytmind:${store.name}:write`, fn)
        : fn(),
    );
    queue = next.catch(() => {});
    return next;
  };
  const settings = async () => ({ ...defaults, ...(await readSettings()) });
  const busy = new Set();
  async function dispatch(m) {
    switch (m.type) {
      case "RETENTION_ENABLE":
        return mutate(async () => {
          await store.put("meta", { id: "retention-policy", hours: 24 });
          return store.cleanup();
        });
      case "READING_STATUS": {
        const preference = await store.read("meta", "reading-preference");
        return { enabled: preference?.enabled !== false };
      }
      case "READING_TOGGLE":
        return mutate(async () => {
          if (typeof m.enabled !== "boolean")
            throw new Error("Invalid reading preference.");
          await store.put("meta", {
            id: "reading-preference",
            enabled: m.enabled,
          });
          return { enabled: m.enabled };
        });
      case "PAGE_CAPTURE":
        return mutate(async () => {
          if (
            (await store.read("meta", "reading-preference"))?.enabled === false
          )
            return { skipped: true };
          const url = readingURL(m.url);
          const text = String(m.text || "")
            .slice(0, 40000)
            .trim();
          if (
            !url ||
            text.length < 20 ||
            isChallengePage(m.originalTitle || m.title, text)
          )
            return { skipped: true };
          const id = `page:${url}`;
          const old = await store.read("pages", id);
          const visitToken = String(m.visitToken || "").slice(0, 80);
          const value = {
            ...old,
            id,
            url,
            title: String(m.title || url).slice(0, 300),
            originalTitle: String(m.originalTitle || m.title || url).slice(
              0,
              300,
            ),
            siteName: String(m.siteName || new URL(url).hostname).slice(0, 150),
            text,
            firstSeenAt: old?.firstSeenAt || Date.now(),
            lastSeenAt: Date.now(),
            visits:
              (old?.visits || 0) +
              (!old || old.visitToken !== visitToken ? 1 : 0),
            visitToken,
            progress: Math.max(
              old?.progress || 0,
              Math.max(0, Math.min(100, Number(m.progress) || 0)),
            ),
          };
          const known = new Set(
            (old?.capturedText || old?.text || "")
              .split(/\n+/)
              .map((t) => t.trim())
              .filter(Boolean),
          );
          const added = text
            .split(/\n+/)
            .map((t) => t.trim())
            .filter((t) => {
              if (!t || known.has(t)) return false;
              known.add(t);
              return true;
            });
          value.capturedText = [old?.capturedText || old?.text || "", ...added]
            .filter(Boolean)
            .join("\n\n");
          value.activities = [...(old?.activities || [])];
          if (!old || old.visitToken !== visitToken)
            value.activities.push({
              kind: "visit",
              label: value.title,
              at: Date.now(),
            });
          if (value.progress > (old?.progress || 0) && value.progress >= 20)
            value.activities.push({
              kind: "reading",
              label: `Read further · ${value.progress}% scroll position`,
              at: Date.now(),
            });
          await store.put("pages", value);
          return { saved: true };
        });
      case "PAGE_EVENT":
        return mutate(async () => {
          if (
            (await store.read("meta", "reading-preference"))?.enabled === false
          )
            return { skipped: true };
          const url = readingURL(m.url);
          if (!url || !["click", "link"].includes(m.event?.kind))
            return { skipped: true };
          const page = await store.read("pages", `page:${url}`);
          if (!page) return { skipped: true };
          const label = String(m.event.label || "")
            .slice(0, 200)
            .trim();
          if (!label) return { skipped: true };
          page.activities = [
            ...(page.activities || []),
            {
              kind: m.event.kind,
              label,
              targetURL: readingURL(m.event.targetURL) || "",
              at: Date.now(),
            },
          ];
          await store.put("pages", page);
          return { saved: true };
        });
      case "PAGE_DELETE":
        return mutate(() =>
          store.tx(["pages"], (t) =>
            t.objectStore("pages").delete(String(m.id)),
          ),
        );
      case "NOTE_SAVE":
        return mutate(async () => {
          const targetStore = String(m.videoId).startsWith("page:")
            ? "pages"
            : "sessions";
          const s = await store.read(targetStore, m.videoId);
          if (!s) throw new Error("Open a saved video first.");
          s.personalNotes = String(m.text || "").slice(0, 20000);
          await store.put(targetStore, s);
          return { saved: true };
        });
      case "BOOKMARK_ADD":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s || !Number.isFinite(m.timestamp) || m.timestamp < 0)
            throw new Error("Choose a valid video moment.");
          const bookmark = {
            id: crypto.randomUUID(),
            timestamp: m.timestamp,
            label: String(m.label || "Saved moment").slice(0, 300),
          };
          s.bookmarks = [...(s.bookmarks || []), bookmark];
          await store.put("sessions", s);
          return bookmark;
        });
      case "BOOKMARK_DELETE":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s) return;
          s.bookmarks = (s.bookmarks || []).filter((b) => b.id !== m.id);
          await store.put("sessions", s);
        });
      case "AUDIO_STATE":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s) return;
          s.audioState = ["listening", "error", "needs-key", "idle"].includes(
            m.status,
          )
            ? m.status
            : "idle";
          s.audioMessage = String(m.message || "").slice(0, 500);
          await store.put("sessions", s);
        });
      case "SESSION":
        if (!/^[A-Za-z0-9_-]{11}$/.test(m.videoId))
          throw new Error("Invalid YouTube video identifier.");
        return mutate(() =>
          store.session({
            id: m.videoId,
            saved: true,
            title: String(m.title || "YouTube video").slice(0, 300),
            audioPrimary:
              typeof m.audioPrimary === "boolean" ? m.audioPrimary : undefined,
            url: `https://www.youtube.com/watch?v=${m.videoId}`,
          }),
        );
      case "TRANSCRIPT":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s || s.captionStatus === "manual") return;
          // A failed retry must never erase a previously captured source.
          if (!(m.segments || []).length && s.transcript?.length) return;
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
          s.captionStatus = s.transcript.length
            ? "ready"
            : m.status === "blocked"
              ? "blocked"
              : "unavailable";
          s.captionMessage = s.transcript.length
            ? ""
            : String(m.message || "").slice(0, 300);
          s.captionSource = String(m.source || "captions").slice(0, 80);
          if (previous !== JSON.stringify(s.transcript))
            s.transcriptVersion = crypto.randomUUID();
          await store.put("sessions", s);
          const config = await settings();
          if (
            m.autoRequested &&
            s.transcript.length &&
            config.autoNotes &&
            config.apiKey &&
            !s.outputs?.some((o) => o.mode === "notes")
          ) {
            const epoch = await store.generation();
            setTimeout(async () => {
              if (epoch === (await store.generation()))
                runGeneration(
                  { videoId: s.id, mode: "notes", auto: true },
                  config,
                ).catch(() => {});
            }, 0);
          }
        });
      case "AUDIO_APPEND":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (
            !s ||
            s.captionStatus === "manual" ||
            (s.transcript.length &&
              s.captionSource !== "live audio transcription")
          )
            return { skipped: true };
          if (s.createdAt !== m.expectedCreatedAt)
            throw new Error("Audio source session changed.");
          const fresh = validateSegments(m.segments);
          s.transcript = validateSegments([...(s.transcript || []), ...fresh]);
          s.captionStatus = "ready";
          s.captionSource = "live audio transcription";
          s.transcriptVersion = crypto.randomUUID();
          await store.put("sessions", s);
          const config = await settings();
          if (
            config.autoNotes &&
            config.apiKey &&
            !s.outputs?.some((o) => o.mode === "notes")
          )
            setTimeout(
              () =>
                runGeneration(
                  { videoId: s.id, mode: "notes", auto: true },
                  config,
                ).catch(() => {}),
              0,
            );
          return { count: fresh.length };
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
            (await store.frames(m.videoId)).filter(
              (f) => f.status === "pending",
            ).length >= 6
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
            captureReason: [
              "manual snapshot",
              "periodic snapshot",
              "visual change",
            ].includes(m.reason)
              ? m.reason
              : "uploaded image",
          };
          await store.addFrame(f);
          Promise.resolve(
            emit({ type: "FRAME_AVAILABLE", videoId: m.videoId }),
          ).catch(() => {});
          return f.id;
        });
      case "CAPTURE_ERROR":
        Promise.resolve(
          emit({
            type: "NOTICE",
            text: "Visual capture is unavailable for this video. Try captions or paste a transcript.",
          }),
        ).catch(() => {});
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
        await mutate(async () => {
          await store.preserveHistory();
          return store.cleanup();
        });
        return {
          sessions: await store.read("sessions"),
          pages: await store.read("pages"),
          readingEnabled:
            (await store.read("meta", "reading-preference"))?.enabled !== false,
          nodes: await store.read("nodes"),
          edges: await store.read("edges"),
          settings: {
            ...(await settings()),
            apiKey: undefined,
            hasApiKey: !!(await settings()).apiKey,
          },

          batch: await store.read("meta", "lecture-batch"),
        };
      case "SOURCE_STATE": {
        const s = await store.read("sessions", m.videoId);
        return s
          ? {
              id: s.id,
              createdAt: s.createdAt,
              captionSource: s.captionSource,
              captionStatus: s.captionStatus,
              captionMessage: s.captionMessage,
              transcriptCount: s.transcript.length,
              hasNotes: s.outputs?.some((o) => o.mode === "notes"),
              hasTranscript:
                s.transcript.length > 0 &&
                s.captionSource !== "live audio transcription",
            }
          : null;
      }
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
          verifierModel: String(
            m.value.verifierModel || defaults.verifierModel,
          ),
          interval: Math.min(60, Math.max(3, Number(m.value.interval) || 5)),
          profile: m.value.profile === "balanced" ? "balanced" : "performance",
          ocrLanguage: ["eng", "urd", "eng+urd"].includes(m.value.ocrLanguage)
            ? m.value.ocrLanguage
            : old.ocrLanguage,
          audioLanguage: ["", "en", "ur"].includes(m.value.audioLanguage)
            ? m.value.audioLanguage
            : old.audioLanguage,
          deep: !!m.value.deep,
          sage: !!m.value.sage,
          autoNotes: !!m.value.autoNotes,
          autoCode:
            m.value.autoCode === undefined ? old.autoCode : !!m.value.autoCode,
        };
        await writeSettings(next);
        return;
      }
      case "FRAMES":
        return store.frames(m.videoId);
      case "OCR":
        return mutate(async () => {
          const f = await store.read("frames", m.id);
          if (!f) return;
          const text = String(m.text || "").slice(0, 20000);
          const quality = {
            rawOcrText: String(m.rawText || m.text || "").slice(0, 20000),
            overallConfidence: Number(m.overallConfidence ?? m.confidence) || 0,
            uncertainLines: (m.uncertainLines || [])
              .slice(0, 200)
              .map((line) => ({
                text: String(line.text || "").slice(0, 2000),
                confidence: Number(line.confidence) || 0,
              })),
          };
          const previous = (await store.frames(f.videoId)).filter(
            (x) => x.status === "ready",
          );
          if (!text.trim()) {
            await store.put("frames", {
              ...f,
              status: "no-text",
              ...quality,
              ocrText: "",
              confidence: Number(m.confidence) || 0,
            });
            return;
          }
          if (previous.some((x) => similarity(x.ocrText, text) > 0.85)) {
            await store.tx(["frames"], (t) =>
              t.objectStore("frames").delete(f.id),
            );
            return;
          }
          await store.put("frames", {
            ...f,
            ocrText: text,
            ...quality,
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
          if (f)
            await store.put("frames", {
              ...f,
              status: "pending",
              ocrText: "",
              ocrLanguage: ["eng", "urd", "eng+urd"].includes(m.language)
                ? m.language
                : f.ocrLanguage,
            });
        });
      case "IMPORT":
      case "IMPORT_SEGMENTS":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s) throw new Error("Open a video first.");
          if (
            m.expectedCreatedAt !== undefined &&
            (s.createdAt !== m.expectedCreatedAt ||
              s.transcriptVersion !== m.expectedVersion)
          )
            throw new Error(
              "The source changed while importing. Review and import again.",
            );
          s.transcript =
            m.type === "IMPORT"
              ? parseTranscript(m.text)
              : validateSegments(m.segments);
          s.captionStatus = "manual";
          s.captionSource =
            m.source === "audio"
              ? "audio transcription"
              : "imported transcript";
          s.transcriptVersion = crypto.randomUUID();
          if (
            m.coverage &&
            Number.isFinite(m.coverage.processed) &&
            Number.isFinite(m.coverage.total)
          )
            s.ingestCoverage = {
              processed: Math.max(0, m.coverage.processed),
              total: Math.max(0, m.coverage.total),
              status: m.coverage.status === "complete" ? "complete" : "partial",
            };
          await store.put("sessions", s);
        });
      case "PIN":
        return mutate(async () => {
          const s = await store.read("sessions", m.videoId);
          if (!s) throw new Error("Video session is unavailable.");
          s.pinned = !!m.pinned;
          await store.put("sessions", s);
        });
      case "PAGE_GENERATE":
        if (
          ![
            "notes",
            "chat",
            "actions",
            "speaking",
            "quiz",
            "flashcards",
          ].includes(m.mode)
        )
          throw new Error("Choose a supported page study tool.");
        return runGeneration(
          { ...m, sourceKind: "page", videoId: String(m.pageId) },
          await settings(),
        );
      case "PAGE_GRAPH": {
        const epoch = await store.generation();
        const page = await store.read("pages", String(m.pageId));
        if (!page) throw new Error("This page has not been saved yet.");
        const graph = await extractGraph(
          await settings(),
          retrieve(pageEvidence(page), "", "graph"),
        );
        await mutate(async () => {
          if (epoch !== (await store.generation()))
            throw new Error("Data was cleared during extraction.");
          await store.mergeGraph(graph);
        });
        return graph;
      }
      case "GENERATE":
        return runGeneration(m, await settings());
      case "BATCH_START":
        return mutate(async () => {
          const sessions = (await store.read("sessions")).filter(
            (s) => s.pinned,
          );
          if (!sessions.length || sessions.length > 10)
            throw new Error("Pin between 1 and 10 lectures for a batch.");
          const previous = await store.read("meta", "lecture-batch");
          if (previous && previous.status !== "complete")
            throw new Error(
              "Continue the saved lecture batch or discard it before starting another.",
            );
          const entries = [];
          for (const s of sessions) {
            const evidence = chunks(s, await store.frames(s.id));
            if (!evidence.length)
              throw new Error(
                `Add source evidence for ${s.title} before batching.`,
              );
            const jobId = crypto.randomUUID();
            s.jobs = [
              ...(s.jobs || []),
              { id: jobId, mode: "notes", evidence },
            ].slice(-4);
            await store.put("sessions", s);
            entries.push({
              videoId: s.id,
              title: s.title,
              jobId,
              nextBatch: 0,
              totalBatches: batchEvidence(evidence).length,
              status: "waiting",
            });
          }
          const job = {
            id: "lecture-batch",
            runId: crypto.randomUUID(),
            entries,
            status: "ready",
            generation: await store.generation(),
            createdAt: Date.now(),
          };
          await store.put("meta", job);
          return job;
        });
      case "BATCH_DISCARD":
        return mutate(() =>
          store.tx(["meta"], (t) =>
            t.objectStore("meta").delete("lecture-batch"),
          ),
        );
      case "BATCH_STEP": {
        const step = async () => {
          const job = await store.read("meta", "lecture-batch");
          if (!job || job.generation !== (await store.generation()))
            throw new Error("The lecture batch is no longer available.");
          const entry = job.entries.find((e) => e.status !== "complete");
          if (!entry) return job;
          try {
            const result = await runGeneration(
              {
                mode: "notes",
                videoId: entry.videoId,
                jobId: entry.jobId,
                batchIndex: entry.nextBatch,
              },
              { ...(await settings()), deep: true },
            );
            entry.nextBatch = result.batchIndex + 1;
            entry.totalBatches = result.totalBatches;
            entry.status =
              entry.nextBatch >= entry.totalBatches ? "complete" : "waiting";
            entry.error = null;
            job.status = job.entries.every((e) => e.status === "complete")
              ? "complete"
              : "ready";
          } catch (e) {
            entry.status = "failed";
            entry.error = e.message;
            job.status = "failed";
          }
          await mutate(async () => {
            const current = await store.read("meta", "lecture-batch");
            if (
              job.generation !== (await store.generation()) ||
              current?.runId !== job.runId
            )
              throw new Error("The batch was cleared or discarded.");
            await store.put("meta", job);
          });
          return job;
        };
        return globalThis.navigator?.locks
          ? navigator.locks.request(`ytmind:${store.name}:lecture-batch`, step)
          : step();
      }
      case "LAB": {
        if (busy.has(m.videoId))
          throw new Error("A request is already running for this video.");
        busy.add(m.videoId);
        try {
          const epoch = await store.generation();
          const s = await store.read("sessions", m.videoId);
          if (!s) throw new Error("Open a video first.");
          const output = await analyzeLab(
            await settings(),
            m.mode,
            chunks(s, await store.frames(s.id)),
          );
          await mutate(async () => {
            if (epoch !== (await store.generation()))
              throw new Error("Data was cleared during analysis.");
            const current = await store.read("sessions", m.videoId);
            if (!current)
              throw new Error("The session expired during analysis.");
            current.outputs = [...(current.outputs || []), output].slice(-200);
            await store.put("sessions", current);
          });
          return output;
        } finally {
          busy.delete(m.videoId);
        }
      }
      case "GRAPH": {
        const epoch = await store.generation();
        const s = await store.read("sessions", m.videoId);
        if (!s) throw new Error("Open a video first.");
        const graph = await extractGraph(
          await settings(),
          retrieve(chunks(s, await store.frames(s.id)), "", "graph"),
        );
        await mutate(async () => {
          if (epoch !== (await store.generation()))
            throw new Error("Data was cleared during extraction.");
          return store.mergeGraph(graph);
        });
        return graph;
      }
      case "CODE": {
        const epoch = await store.generation();
        const s = await store.read("sessions", m.videoId);
        if (!s) throw new Error("Open a video first.");
        const all = chunks(s, await store.frames(s.id)).filter(
          (e) =>
            e.kind === "frame" &&
            (!Array.isArray(m.frameIds) || m.frameIds.includes(e.frameId)),
        );
        const evidence = retrieve(all, "", "graph");
        const output = await extractCode(await settings(), evidence);
        output.coverage.total = all.length;
        await mutate(async () => {
          if (epoch !== (await store.generation()))
            throw new Error("Data was cleared during code extraction.");
          const current = await store.read("sessions", s.id);
          if (!current)
            throw new Error("The source expired during code extraction.");
          current.outputs = [...(current.outputs || []), output].slice(-200);
          await store.put("sessions", current);
        });
        return output;
      }
      case "CLEAR":
        await mutate(() => {
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
    try {
      const epoch = await store.generation();
      const targetStore = m.sourceKind === "page" ? "pages" : "sessions";
      const sessions =
        m.mode === "research"
          ? (await store.read("sessions")).filter((s) => s.pinned)
          : [await store.read(targetStore, m.videoId)].filter(Boolean);
      let all = (
        await Promise.all(
          sessions.map(async (s) =>
            m.sourceKind === "page"
              ? pageEvidence(s)
              : chunks(s, await store.frames(s.id)),
          ),
        )
      ).flat();

      const deep =
        m.mode === "talkshow" ||
        (config.deep &&
          ["notes", "actions", "speaking", "quiz", "flashcards"].includes(
            m.mode,
          ) &&
          !m.auto);
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
            if (epoch !== (await store.generation()))
              throw new Error("Data was cleared.");
            const current = await store.read(targetStore, s.id);
            if (!current) throw new Error("Session expired. Reopen the video.");
            current.jobs = [
              ...(current.jobs || []),
              { id: jobId, mode: m.mode, evidence: all },
            ].slice(-4);
            await store.put(targetStore, current);
          });
      }
      let batches = deep
        ? batchEvidence(all, m.mode === "talkshow" ? 7000 : 14000)
        : [retrieve(all, String(m.query || "").slice(0, 2000), m.mode)];
      // Paraphrases and cross-language questions can have no keyword matches.
      // Let the model assess actual source support instead of reporting no source.
      if (m.mode === "chat" && all.length) {
        batches = [
          all.reduce((size, e) => size + e.text.length, 0) <= 18000
            ? all
            : batches[0].length
              ? batches[0]
              : retrieve(all, "", "notes"),
        ];
      }
      const batchIndex = deep
        ? Math.max(0, Math.floor(Number(m.batchIndex) || 0))
        : 0;
      const evidence = batches[batchIndex] || [];
      const targetId =
        m.mode === "research"
          ? (sessions.find((s) => s.id === m.videoId) || sessions[0])?.id
          : m.videoId;
      const saveOutput = async (output) => {
        await mutate(async () => {
          if (epoch !== (await store.generation()))
            throw new Error("Data was cleared during generation.");
          const current = await store.read(targetStore, targetId);
          if (!current) return;
          current.outputs = [
            ...(current.outputs || []).filter((o) => o.id !== output.id),
            output,
          ].slice(-200);
          await store.put(targetStore, current);
        });
      };
      const result =
        m.mode === "talkshow"
          ? await analyzeDiscussion(config, evidence)
          : await generate(
              config,
              m.mode,
              m.query,
              evidence,
              undefined,
              async (draft) => {
                draft.coverage = {
                  selected: evidence.length,
                  total: all.length,
                };
                if (deep)
                  Object.assign(draft, {
                    batchIndex,
                    totalBatches: batches.length,
                    jobId,
                  });
                await saveOutput(draft);
                await Promise.resolve(
                  emit({ type: "OUTPUT_AVAILABLE", videoId: targetId }),
                ).catch(() => {});
              },
            );
      result.coverage = { selected: evidence.length, total: all.length };
      if (deep) {
        result.batchIndex = batchIndex;
        result.totalBatches = batches.length;
        result.jobId = jobId;
      }
      await saveOutput(result);
      await Promise.resolve(
        emit({ type: "OUTPUT_AVAILABLE", videoId: targetId }),
      ).catch(() => {});
      return result;
    } finally {
      busy.delete(m.videoId);
    }
  }
  return {
    dispatch,
    cleanup: () =>
      mutate(async () => {
        await store.preserveHistory();
        return store.cleanup();
      }),
  };
}
