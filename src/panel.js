import { marked } from "marked";
import DOMPurify from "dompurify";
import { time, defaults, combineParts } from "./core.js";
import { recognize } from "./ocr.js";
import { demoState, demoFrames } from "./preview-data.js";
import { studioMode, localService, sourceId, fileFrame } from "./studio.js";
import { parseTranscript } from "./source.js";
import { transcribeAudio, recordTabAudio } from "./audio.js";
import { zipSync, strToU8 } from "fflate";
import { openPDFExport } from "./pdf-export.js";
const $ = (s) => document.querySelector(s);
const preview = !globalThis.chrome?.runtime?.id && !studioMode;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state = { sessions: [], nodes: [], edges: [], settings: defaults },
  videoId = null,
  tabId = null,
  frames = [],
  active = location.hash.slice(1) || "notes",
  capture = false,
  followRequested = false,
  audioActive = false,
  videoPaused = true,
  ocrBusy = false,
  requestBusy = false,
  batchRunning = false,
  batchPaused = false,
  pauseRequested = false,
  signature = "",
  selectedNode = null,
  researchResult = null;
if (active === "settings") active = "notes";
async function api(type, fields = {}) {
  if (studioMode) return localService().dispatch({ type, ...fields });
  if (preview) {
    if (type === "STATE") return structuredClone(demoState);
    if (type === "SETTINGS") return { ...defaults };
    if (type === "FRAMES") return demoFrames;
    throw new Error(
      "This is a design preview. Load the extension in Chrome to use this feature.",
    );
  }
  const r = await chrome.runtime.sendMessage({ type, ...fields });
  if (r?.error) throw new Error(r.error);
  return r?.data;
}
let sourceNoticeContext = null;
const sourceContext = () =>
  JSON.stringify([
    videoId,
    active,
    session()?.transcriptVersion,
    session()?.captionStatus,
    frames.map((f) => [f.id, f.status]),
    session()?.outputs?.map((o) => o.id),
  ]);
function notice(text, error = false) {
  sourceNoticeContext =
    error &&
    (text.startsWith("No matching source content yet") ||
      text.startsWith("No readable source text"))
      ? sourceContext()
      : null;
  $("#notice").textContent = text;
  $("#notice").className = error ? "error" : "";
  $("#notice").hidden = !text;
}
const session = () => state.sessions.find((s) => s.id === videoId);
const questionDrafts = new Map();
let renderedVideoId = null,
  renderedTab = null;
async function content(type, fields = {}) {
  if (studioMode) {
    if (type === "SEEK") {
      window.open(
        `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(fields.timestamp || 0)}s`,
        "_blank",
        "noopener",
      );
      return;
    }
    throw new Error(
      "Automatic capture/captions require the extension. In this workspace, paste a transcript or upload a frame.",
    );
  }
  if (preview)
    throw new Error("Use the installed extension to control a video.");
  if (!tabId) throw new Error("Open a YouTube watch page first.");
  const r = await chrome.tabs.sendMessage(tabId, { type, videoId, ...fields });
  if (r?.error) throw new Error(r.error);
  return r;
}
async function refresh(force = false) {
  try {
    state = await api("STATE");
    if (studioMode) {
      videoId =
        localStorage.getItem("ytmind-studio-active") || state.sessions[0]?.id;
    } else if (preview) {
      videoId = state.sessions[0]?.id;
    } else {
      const [t] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (t?.id) {
        try {
          const info = await api("CONNECT_VIDEO", { tabId: t.id });
          if (info?.navigating) return;
          if (
            t.id === tabId &&
            info.videoId &&
            (info.videoId !== videoId || !info.capturing) &&
            followRequested
          ) {
            await chrome.tabs.sendMessage(t.id, {
              type: "CAPTURE_START",
              videoId: info.videoId,
              interval: state.settings.interval,
              profile: state.settings.profile,
            });
            await api("AUDIO_START", {
              videoId: info.videoId,
              tabId: t.id,
            }).catch((e) => notice(e.message, true));
            info.capturing = true;
          }
          if (t.id !== tabId) followRequested = false;
          if (info.capturing) followRequested = true;
          if (t.id !== tabId || info.videoId !== videoId) {
            capture = false;
            selectedNode = null;
          }
          videoId = info.videoId;
          videoPaused = info.paused;
          tabId = t.id;
          capture = !!info.capturing;
        } catch {
          videoId = null;
          tabId = null;
          capture = false;
          followRequested = false;
        }
      }
    }
    const s = session();
    $("#video-title").textContent = s?.title || "Open a YouTube video";
    $("#source-status").textContent = s
      ? s.transcript.length
        ? `${s.transcript.length} ${s.captionSource?.includes("audio") ? "speech recognition" : s.captionStatus === "manual" ? "imported text" : "caption"} segments · ${s.ingestCoverage?.status === "partial" ? "partial audio source" : "source ready"}`
        : s.captionStatus === "blocked"
          ? `YouTube blocked playback · ${s.captionMessage || "Check the video player and retry captions"}`
          : s.audioState === "error" || s.audioState === "needs-key"
            ? s.audioMessage
            : audioActive
              ? videoPaused
                ? "Audio ready · play the video to capture speech"
                : "Listening to tab audio · first source section is processing"
              : s.captionStatus === "pending"
                ? "Loading YouTube captions · audio fallback is checked separately"
                : "No captions yet · add audio or frames"
      : "Your next rabbit hole starts here";
    $("#retention").textContent = s?.pinned
      ? "Saved to library"
      : s
        ? `${Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 3600000))}h remaining`
        : "24h session";
    $("#pin").textContent = s?.pinned ? "◆" : "◇";
    $("#pin").disabled = !s;
    $("#pin").setAttribute(
      "aria-label",
      s?.pinned ? "Unpin video from library" : "Pin video to library",
    );
    frames = s ? await api("FRAMES", { videoId }) : [];
    if (sourceNoticeContext && sourceNoticeContext !== sourceContext())
      notice("");
    const next = JSON.stringify([
      active,
      videoId,
      s?.captionStatus,
      s?.outputs?.map((o) => o.id),
      frames.map((f) => [f.id, f.status]),
      state.nodes.length,
      state.edges.length,
      state.sessions.map((s) => [s.id, s.pinned]),
      capture,
    ]);
    if (force || next !== signature) {
      signature = next;
      render();
    }
    if (!preview) processFrames();
  } catch (e) {
    notice(e.message, true);
  }
}
const headings = {
  notes: [
    "A little clarity, saved.",
    "STUDY NOTES",
    "Turn what you watched into something you can return to.",
  ],
  chat: [
    "Follow your curiosity.",
    "SOURCE Q&A",
    "Ask a question. Get an answer with a trail back to the video.",
  ],
  actions: [
    "From watching to doing.",
    "ARIA",
    "Extract the steps, commands, and prerequisites in your source.",
  ],
  graph: [
    "Ideas, connected.",
    "KNOWLEDGE MEMORY",
    "Connect concepts across videos, with evidence for every relationship.",
  ],
  vera: [
    "Read between the frames.",
    "VERA",
    "Capture slides and code while you watch. OCR happens on your device.",
  ],
  library: [
    "Keep the good stuff.",
    "YOUR LIBRARY",
    "Pin videos to keep their evidence, then explore them together.",
  ],
  lab: [
    "Question the evidence.",
    "EVIDENCE LAB",
    "Inspect possible narration–screen disagreements, or prepare a source-backed tutorial checklist.",
  ],
};
function empty(icon, title, description) {
  return `<div class="empty"><span class="empty-icon">${icon}</span><h3>${title}</h3><p>${description}</p></div>`;
}
function render() {
  const oldAskForm = $("#ask-form");
  if (oldAskForm)
    questionDrafts.set(
      renderedVideoId,
      oldAskForm.querySelector("#question").value,
    );
  for (const b of document.querySelectorAll("[data-tab]")) {
    b.classList.toggle("active", b.dataset.tab === active);
    b.setAttribute("aria-current", b.dataset.tab === active ? "page" : "false");
  }
  const [title, label, description] = headings[active] || headings.notes;
  let html = `<div class="section-heading"><h2>${title}</h2><span class="tag">${label}</span></div><p class="description">${description}</p>`;
  const s = session();
  if (["notes", "actions"].includes(active)) {
    html += `<button class="primary" data-generate="${active}" ${!s || requestBusy ? "disabled" : ""}>${active === "notes" ? "Generate study notes" : "Extract action steps"}<span>↗</span></button>`;
    if (requestBusy)
      html +=
        '<button class="text-button" id="pause-generation">Pause after this section</button>';
    const last = s?.outputs?.filter((o) => o.mode === active).at(-1);
    const output = last?.jobId
      ? combineParts(s.outputs.filter((o) => o.jobId === last.jobId))
      : last;
    if (
      output?.totalBatches > 0 &&
      (output.completedParts || output.batchIndex + 1) < output.totalBatches &&
      !requestBusy
    )
      html += `<button class="text-button" data-resume="${esc(output.jobId)}" data-mode="${active}">Continue remaining sections (${output.completedParts || output.batchIndex + 1}/${output.totalBatches} done)</button>`;
    html += output
      ? coverageHTML(output) + outputHTML(output)
      : empty(
          active === "notes" ? "✎" : "↗",
          active === "notes"
            ? "Your next idea lives here."
            : "Make your next move.",
          active === "notes"
            ? "Generate notes from your video’s captions and indexed frames. Every key point links back to its source."
            : "Find concrete steps in your video. Missing details stay missing, so you can check the original.",
        );
    html += `<div class="hint-card"><span>◇</span><div><b>A small habit, a lasting library.</b><br>Pin this video above to keep its sources and notes beyond your 24-hour session.</div></div>`;
    html += sourceTools();
  } else if (active === "chat") {
    html += `<div class="prompt-chips"><button data-prompt="Explain the main idea">The main idea</button><button data-prompt="What prerequisites are mentioned?">Prerequisites</button><button data-prompt="Explain the code shown in the video">Explain the code</button></div><form id="ask-form"><label for="question">Your question</label><textarea id="question" maxlength="2000" placeholder="What would you like to understand?" required></textarea><button id="send-question" class="primary" type="submit" ${!s || requestBusy ? "disabled" : ""}>${requestBusy ? "Processing…" : "Send question"}<span aria-hidden="true">↗</span></button><small class="ask-help">Ctrl+Enter to send · Enter for a new line</small></form>`;
    const outputs = s?.outputs?.filter((o) => o.mode === "chat") || [];
    html += outputs.length
      ? outputs
          .slice(-8)
          .reverse()
          .map(
            (o) =>
              `<div class="question">${esc(o.query)}</div>${outputHTML(o)}`,
          )
          .join("")
      : empty(
          "✳",
          "A good question changes things.",
          "Your answers will appear here, alongside the video moments that support them.",
        );
    html += sourceTools();
  } else if (active === "vera") {
    html += `<button id="extract-code" class="primary" ${!s || requestBusy ? "disabled" : ""}>Extract source code into files</button><p class="muted">Code is retained only when it matches captured OCR exactly. Missing lines are not invented. Review before running.</p>`;
    for (const output of (s?.outputs || [])
      .filter((o) => o.mode === "code")
      .slice(-2)
      .reverse())
      html +=
        outputHTML(output) +
        `<button class="secondary" data-code-zip="${output.id}">Download code files ZIP</button>`;
    html += studioMode
      ? `<label class="muted" for="frame-time">Frame timestamp in seconds</label><input id="frame-time" type="number" min="0" value="0"><div class="toolbar"><label class="secondary" for="frame-files">Add frame images<input id="frame-files" type="file" accept="image/*" multiple hidden ${!s ? "disabled" : ""}></label></div><p class="muted">Images are processed locally. Set their video time so citations point to the right moment.</p>`
      : `<div class="toolbar"><button class="secondary" id="capture-toggle" ${!s ? "disabled" : ""}>${capture ? "Pause indexing" : "Start live indexing"}</button><button class="secondary" id="capture-once" ${!s ? "disabled" : ""}>Capture this moment</button></div><div class="status-line">${frames.filter((f) => f.status === "ready").length} / 100 frames indexed · ${capture ? "watching while this panel is open" : "capture paused"}</div><p class="muted">OCR reads visible text in the language selected in Settings. Visual-change filtering is a heuristic; periodic snapshots every minute and manual capture bypass it. Missing captions use tab-audio transcription after toolbar activation.</p>`;
    html += frames.length
      ? frames
          .slice()
          .reverse()
          .map(
            (f) =>
              `<article class="frame"><img src="${esc(f.image)}" alt="Video frame at ${time(f.timestamp)}" loading="lazy"><div class="frame-body"><div class="frame-meta"><button class="citation" data-seek="${f.timestamp}" data-video="${f.videoId}">${time(f.timestamp)} ↗</button><span>${f.status === "ready" ? `OCR ${Math.round(f.confidence)}% confidence` : esc(f.status)}</span></div>${frameOCRText(f)}</div></article>`,
          )
          .join("")
      : empty(
          "▧",
          "Keep a moment of insight.",
          "Play a video and start indexing, or capture a slide manually. Clear frames with readable text work best.",
        );
  } else if (active === "graph") {
    html += `<button class="primary" id="extract-graph" ${!s || requestBusy ? "disabled" : ""}>Connect this video’s concepts<span>↗</span></button><div class="toolbar"><button class="secondary" id="export-graph">Export graph JSON</button></div><label class="sr-only" for="graph-search">Search concepts</label><input id="graph-search" placeholder="Find a concept…" type="search"> <div id="graph-area"></div><p class="muted">Saved graph evidence persists. Connections describe what videos say, and are not independently verified facts.</p>`;
  } else if (active === "lab") {
    html += `<button class="primary" data-lab="conflicts" ${!s || requestBusy ? "disabled" : ""}>Compare narration with screen text<span>↗</span></button><div class="toolbar"><button class="secondary" data-lab="preflight" ${!s || requestBusy ? "disabled" : ""}>Build tutorial preflight</button></div><p class="muted">The comparison needs caption and OCR evidence within 75 seconds. Retained excerpts are matched exactly; interpretations remain hypotheses. A sampled preflight may miss requirements outside its selected source.</p>`;
    const outputs = (s?.outputs || []).filter((o) =>
      ["lab-conflicts", "preflight"].includes(o.mode),
    );
    html += outputs.length
      ? outputs
          .slice(-4)
          .reverse()
          .map((o) => coverageHTML(o) + outputHTML(o))
          .join("")
      : empty(
          "⇄",
          "Trust starts with a closer look.",
          "Capture a readable slide and its narration, then inspect what the sources actually say.",
        );
  } else if (active === "library") {
    const pinned = state.sessions.filter((s) => s.pinned);
    html += `<section class="batch-card"><h3>Lecture notes agent</h3><p class="muted">Generate notes for 1–10 pinned lectures. Every captured source section is processed through Groq; progress is saved between requests. Keep this workspace open.</p><div class="source-controls"><button id="batch-start" class="primary" ${!pinned.length || requestBusy ? "disabled" : ""}>Generate all lecture notes</button>${state.batch && state.batch.status !== "complete" ? `<button id="batch-resume" class="secondary" ${requestBusy ? "disabled" : ""}>Continue saved batch</button><button id="batch-discard" class="text-button" ${requestBusy ? "disabled" : ""}>Discard batch progress</button>` : ""}${batchRunning ? '<button id="batch-pause" class="secondary">Pause after current section</button>' : ""}</div>${state.batch ? `<ul>${state.batch.entries.map((e) => `<li>${esc(e.title)} · ${e.nextBatch}/${e.totalBatches} sections · ${esc(e.status)}${e.error ? ` · ${esc(e.error)}` : ""}</li>`).join("")}</ul><div class="toolbar"><button id="batch-export" class="secondary">Download lecture notes ZIP</button><button id="batch-pdf" class="secondary">Save lecture notes as PDF</button></div>` : ""}</section>`;
    html += pinned.length
      ? pinned
          .map(
            (s) =>
              `<article class="library-card"><span>◇</span><div><h3><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a></h3><small>${s.transcript.length} segments · ${s.outputs?.length || 0} saved outputs</small></div><button class="icon-button" data-unpin="${s.id}" aria-label="Unpin ${esc(s.title)}">×</button></article>`,
          )
          .join("")
      : empty(
          "◇",
          "Build your own trail.",
          "Pin a video using the diamond beside its title. Its evidence stays available for cross-video research.",
        );
    html += `<form id="research-form" class="research-form"><label for="research-topic">Explore a topic across pinned videos</label><input id="research-topic" placeholder="e.g. State management tradeoffs" maxlength="2000" required><button class="primary" ${!pinned.length || requestBusy ? "disabled" : ""}>Generate research report<span>↗</span></button></form>`;
    const savedReport =
      researchResult ||
      state.sessions
        .flatMap((s) => s.outputs || [])
        .filter((o) => o.mode === "research")
        .sort((a, b) => a.createdAt - b.createdAt)
        .at(-1);
    if (savedReport)
      html += coverageHTML(savedReport) + outputHTML(savedReport);
    if (state.batch)
      for (const entry of state.batch.entries) {
        const parts = (
          state.sessions.find((s) => s.id === entry.videoId)?.outputs || []
        ).filter((o) => o.jobId === entry.jobId);
        if (parts.length)
          html +=
            `<h3>${esc(entry.title)}</h3>` + outputHTML(combineParts(parts));
      }
  }
  const view = $("#workspace");
  if (
    oldAskForm &&
    active === "chat" &&
    renderedTab === "chat" &&
    renderedVideoId === videoId
  ) {
    // Keep the form connected so background updates cannot interrupt typing,
    // cursor selection or input-method composition.
    const next = document.createElement("div");
    next.innerHTML = html;
    const updatedForm = next.querySelector("#ask-form");
    oldAskForm.querySelector("button[type=submit]").disabled =
      updatedForm.querySelector("button[type=submit]").disabled;
    oldAskForm.querySelector("button[type=submit]").innerHTML =
      updatedForm.querySelector("button[type=submit]").innerHTML;
    for (const child of [...view.childNodes])
      if (child !== oldAskForm) child.remove();
    let afterForm = false;
    for (const child of [...next.childNodes]) {
      if (child === updatedForm) {
        afterForm = true;
        continue;
      }
      if (afterForm) view.append(child);
      else view.insertBefore(child, oldAskForm);
    }
  } else {
    view.innerHTML = html;
    if (active === "chat")
      $("#question").value = questionDrafts.get(videoId) || "";
  }
  renderedVideoId = videoId;
  renderedTab = active;
  if (active === "graph") drawGraph();
}
function frameOCRText(frame) {
  const accepted =
    frame.status === "ready"
      ? `<p class="frame-ocr-text" dir="auto">${esc(frame.ocrText)}</p>`
      : frame.status === "no-text"
        ? '<p class="muted">No reliable text was accepted. The snapshot is saved.</p>'
        : frame.status === "failed"
          ? `<button class="text-button" data-retry-ocr="${esc(frame.id)}">Retry OCR</button>`
          : '<p class="muted">Waiting for local OCR…</p>';
  const uncertain = frame.uncertainLines?.length
    ? `<p class="muted">${frame.uncertainLines.length} low-confidence line(s) excluded from automatic text evidence.</p>`
    : "";
  return (
    accepted +
    uncertain +
    (["ready", "no-text"].includes(frame.status)
      ? `<button class="text-button" data-retry-ocr="${esc(frame.id)}">Re-read frame</button>`
      : "") +
    (frame.rawOcrText
      ? `<details><summary>Raw OCR · review original recognition</summary><pre dir="auto">${esc(frame.rawOcrText)}</pre></details>`
      : "")
  );
}
function sourceTools() {
  return `<details><summary>Missing captions? Add your own source</summary><p class="muted">${studioMode ? "Import source text or transcribe audio." : "Open YouTube’s transcript panel and retry, or import your source."} Timestamped text, SRT, VTT and JSON preserve video citations. Plain text starts at 0:00.</p>${studioMode ? "" : '<button class="secondary" id="retry-captions">Retry captions</button>'}<div class="source-controls"><label class="secondary file-control">Import subtitles<input id="subtitle-file" type="file" accept=".txt,.srt,.vtt,.json" /></label><label class="secondary file-control">Upload audio<input id="audio-file" type="file" accept=".wav,.mp3,.mp4,.m4a,.mpeg,.mpga,.ogg,.flac,.webm" /></label><button class="secondary" id="record-tab-audio">Record tab audio</button></div><form id="import-form"><label class="sr-only" for="manual-source">Transcript text</label><textarea id="manual-source" maxlength="150000" placeholder="Paste the video transcript…" required></textarea><button class="text-button">Use this transcript</button></form></details>`;
}
function coverageHTML(o) {
  if (!o.coverage) return "";
  return `<p class="coverage">${o.totalBatches ? "Deep mode" : "Selected context"} · ${o.coverage.selected} of ${o.coverage.total} source chunks processed${o.totalBatches ? ` · ${o.completedParts || o.batchIndex + 1}/${o.totalBatches} sections saved` : ""}${o.coverage.selected < o.coverage.total ? " · This output does not cover the entire source." : ""}</p>`;
}
function markdown(text, evidence = []) {
  let safe = DOMPurify.sanitize(marked.parse(String(text)), {
    FORBID_TAGS: ["img", "style", "iframe", "form", "input", "button"],
    FORBID_ATTR: ["style"],
  });
  const wrapper = document.createElement("div");
  wrapper.innerHTML = safe;
  for (const a of wrapper.querySelectorAll("a")) {
    const url = a.getAttribute("href") || "";
    if (!/^https?:\/\//i.test(url)) a.removeAttribute("href");
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noreferrer noopener");
  }
  // Replace citation text nodes only; never modify code or attributes.
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT),
    nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (n.parentElement.closest("pre,code,a")) continue;
    const parts = n.textContent.split(/(\[E\d+\])/g);
    if (parts.length === 1) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      const match = p.match(/^\[E(\d+)\]$/),
        source = match && evidence[Number(match[1]) - 1];
      if (source) {
        const b = document.createElement("button");
        b.className = "citation";
        b.textContent = `${time(source.startTime)} ↗`;
        b.dataset.seek = source.startTime;
        b.dataset.video = source.videoId;
        b.title = `${source.title} · ${source.kind}`;
        frag.append(b);
      } else frag.append(document.createTextNode(p));
    }
    n.replaceWith(frag);
  }
  return wrapper.innerHTML;
}
const badgeLabels = {
  supported: "Source-supported",
  uncertain: "Needs a closer look",
  conflicting: "Conflicting evidence",
  unchecked: "Unchecked",
};
function outputHTML(o) {
  const v = o.verification || { status: "unchecked", claims: [] };
  return `<article class="result" data-output="${esc(o.id)}"><div class="result-head"><span class="eyebrow">${o.mode === "notes" ? "YOUR STUDY NOTES" : o.mode === "actions" ? "YOUR ACTION PLAN" : o.generalKnowledge ? "VIDEO + GENERAL KNOWLEDGE" : "FROM YOUR SOURCES"}</span><span class="badge ${esc(v.status)}">${o.generalKnowledge ? "Includes general knowledge" : badgeLabels[v.status] || "Unchecked"}</span></div><h3 class="result-source-title">${esc(o.mode === "research" ? "Multi-video research" : o.evidence[0]?.title || "Source notes")}</h3><div class="markdown" dir="auto">${markdown(o.answer, o.evidence)}</div><div class="sources"><div class="eyebrow">BACK TO THE SOURCE · ${o.evidence.length} MOMENTS</div>${o.evidence
    .map(
      (e, i) =>
        `<div class="source-proof"><button class="source-link" data-seek="${e.startTime}" data-video="${esc(e.videoId)}"><span>E${i + 1} · ${esc(e.title)}<small>${esc(e.kind)} ${session()?.captionStatus === "manual" ? "· manually supplied" : ""}</small></span><span class="stamp">${time(e.startTime)} ↗</span></button><a class="print-source-link" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.videoId)}&t=${Math.floor(e.startTime)}s">https://www.youtube.com/watch?v=${esc(e.videoId)}&amp;t=${Math.floor(e.startTime)}s</a><details><summary>Proof view · read stored excerpt</summary><pre>${esc(e.text)}</pre></details></div>`,
    )
    .join(
      "",
    )}</div><details class="verification"><summary>SAGE · inspect source support</summary><p class="muted">${esc(v.reason || "Model-based support check. It can miss errors; inspect the cited evidence.")}</p><p class="muted">Source support is not a guarantee of factual truth. Agreement between models is not proof.</p>${(v.claims || []).map((c) => `<div class="claim">${esc(c.text)}<small>${esc(c.verdict)} · evidence ${(c.refs || []).join(", ") || "none"}</small></div>`).join("")}</details>${v.status === "conflicting" && o.alternative ? `<details open><summary>Independent answer · compare both versions</summary><div class="markdown">${markdown(o.alternative, o.evidence)}</div></details>` : ""}<div class="toolbar"><button class="secondary" data-copy="${o.id}">Copy</button><button class="secondary" data-export="${o.id}">Download .md</button><button class="secondary" data-pdf="${o.id}">Save as PDF</button></div></article>`;
}
function drawGraph(query = "") {
  const nodes = state.nodes
      .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 30),
    ids = new Set(nodes.map((n) => n.id));
  const area = $("#graph-area");
  if (!area) return;
  if (!nodes.length) {
    area.innerHTML = empty(
      "⌘",
      query ? "No matching concepts." : "An idea rarely lives alone.",
      "Extract concepts from a video to begin connecting your learning.",
    );
    return;
  }
  const pos = new Map(
    nodes.map((n, i) => [
      n.id,
      {
        x: 190 + 125 * Math.cos((i * 2 * Math.PI) / nodes.length),
        y: 140 + 95 * Math.sin((i * 2 * Math.PI) / nodes.length),
      },
    ]),
  );
  area.innerHTML = `<svg class="graph-canvas" viewBox="0 0 380 280" aria-label="Knowledge graph">${state.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map(
      (e) =>
        `<line x1="${pos.get(e.source).x}" y1="${pos.get(e.source).y}" x2="${pos.get(e.target).x}" y2="${pos.get(e.target).y}" stroke="#c1cfb2" stroke-width="1.5"/>`,
    )
    .join("")}${nodes
    .map((n, i) => {
      const p = pos.get(n.id);
      return `<g data-node="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.label)}"><circle cx="${p.x}" cy="${p.y}" r="${i === 0 ? 16 : 11}" fill="${i === 0 ? "#263e2e" : "#c3e896"}"/><text text-anchor="middle" x="${p.x}" y="${p.y + 29}">${esc(n.label.slice(0, 24))}</text></g>`;
    })
    .join(
      "",
    )}</svg><p class="muted">Showing ${nodes.length} of ${state.nodes.length} concepts. Select a node for its sources.</p><div id="node-detail"></div>`;
  if (selectedNode) showNode(selectedNode);
}
function showNode(id) {
  selectedNode = id;
  const n = state.nodes.find((n) => n.id === id);
  if (!n || !$("#node-detail")) return;
  const relations = state.edges.filter(
    (e) => e.source === id || e.target === id,
  );
  $("#node-detail").innerHTML =
    `<div class="concept"><h3>${esc(n.label)}</h3><span class="tag">${esc(n.type)}</span>${relations.map((e) => `<p class="muted">${esc(e.source)} → ${esc(e.relation)} → ${esc(e.target)}</p>`).join("")}${n.sources.map((s) => `<button class="source-link" data-seek="${s.startTime}" data-video="${s.videoId}">${esc(s.title)}<span class="stamp">${time(s.startTime)} ↗</span></button>`).join("")}</div>`;
}
async function run(mode, query = "", resumeJob = null) {
  if (requestBusy) return;
  requestBusy = true;
  pauseRequested = false;
  const originVideo = videoId;
  render();
  notice(
    state.settings.sage
      ? "Reading sources, then checking support with SAGE…"
      : "Reading your source evidence…",
  );
  try {
    const existing = resumeJob
      ? (session()?.outputs || []).filter((o) => o.jobId === resumeJob)
      : [];
    let batchIndex = existing.length
        ? Math.max(...existing.map((o) => o.batchIndex)) + 1
        : 0,
      jobId = resumeJob;
    let result;
    do {
      result = await api("GENERATE", {
        videoId: originVideo,
        mode,
        query,
        batchIndex,
        jobId,
      });
      if (mode === "research") researchResult = result;
      jobId = result.jobId;
      batchIndex++;
      await refresh(true);
      notice(
        result.totalBatches
          ? `Section ${batchIndex} of ${result.totalBatches} saved${batchIndex < result.totalBatches ? " · processing the next section…" : "."}`
          : "Saved. Use the timestamps to inspect your sources.",
      );
    } while (
      result.totalBatches > batchIndex &&
      !pauseRequested &&
      videoId === originVideo
    );
    if (pauseRequested)
      notice(
        "Paused. Completed sections are saved; continue when you’re ready.",
      );
  } catch (e) {
    notice(e.message, true);
  } finally {
    requestBusy = false;
    render();
  }
}
async function processFrames() {
  if (ocrBusy || document.hidden) return;
  const pending = frames.filter((f) => f.status === "pending");
  if (!pending.length) return;
  ocrBusy = true;
  const codeFrames = [];
  const origin = pending[0].videoId;
  try {
    let index = 0;
    const count = state.settings.profile === "performance" ? 2 : 1;
    const language = state.settings.ocrLanguage || "eng";
    await Promise.all(
      Array.from({ length: count }, async (_, slot) => {
        while (index < pending.length) {
          const frame = pending[index++];
          try {
            const data = await recognize(frame.image, slot, language);
            await api("OCR", { id: frame.id, ...data });
            if (
              /\b(?:const|let|function|def|class|import)\b|=>|#include|<\/?[A-Za-z]/.test(
                data.text,
              )
            )
              codeFrames.push(frame.id);
          } catch (e) {
            await api("OCR_FAILED", { id: frame.id });
            notice("Local OCR failed. Retry the frame or use captions.", true);
          }
        }
      }),
    );
    if (
      codeFrames.length &&
      state.settings.autoCode &&
      !requestBusy &&
      state.settings.hasApiKey
    )
      await api("CODE", { videoId: origin, frameIds: codeFrames }).catch((e) =>
        notice(`Automatic code extraction paused: ${e.message}`, true),
      );
  } finally {
    ocrBusy = false;
    await refresh();
  }
}
function findOutput(id) {
  if (researchResult?.id === id) return researchResult;
  const all = state.sessions.flatMap((s) => s.outputs || []),
    parts = all.filter((o) => o.jobId === id);
  return parts.length ? combineParts(parts) : all.find((o) => o.id === id);
}
function exportText(o) {
  return `# ${o.mode === "research" ? "YTMind research" : o.evidence[0]?.title || session()?.title || "YTMind notes"}\n\n${o.answer}\n\n---\nSAGE: ${badgeLabels[o.verification?.status] || "Unchecked"}\nSource support is not a guarantee of truth.\n\n## Evidence\n${o.evidence.map((e, i) => `- E${i + 1}: [${e.title} · ${time(e.startTime)}](https://www.youtube.com/watch?v=${e.videoId}&t=${Math.floor(e.startTime)}s) (${e.kind})\n  ${e.text}`).join("\n")}`;
}
function download(text, name, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function openSettings() {
  const s = await api("SETTINGS");
  $("#api-key").value = s.apiKey;
  $("#model").value = s.model;
  $("#verifier-model").value = s.verifierModel;
  $("#interval").value = s.interval;
  $("#profile").value = s.profile;
  $("#ocr-language").value = s.ocrLanguage || "eng";
  $("#live-audio-language").value = s.audioLanguage || "";
  $("#deep").checked = s.deep;
  $("#sage").checked = s.sage;
  $("#auto-notes").checked = s.autoNotes;
  $("#auto-code").checked = s.autoCode;
  $("#settings-dialog").showModal();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button,[data-node]");
  if (!b) return;
  try {
    if (b.dataset.tab) {
      active = b.dataset.tab;
      location.hash = active;
      signature = "";
      render();
      return;
    }
    if (b.dataset.generate) {
      await run(b.dataset.generate);
      return;
    }
    if (b.dataset.lab) {
      requestBusy = true;
      render();
      notice("Checking source excerpts…");
      try {
        await api("LAB", { videoId, mode: b.dataset.lab });
        await refresh(true);
        notice("Evidence Lab result saved. Inspect the quoted sources.");
      } finally {
        requestBusy = false;
        render();
      }
      return;
    }
    if (b.dataset.resume) {
      await run(b.dataset.mode, "", b.dataset.resume);
      return;
    }
    if (b.dataset.prompt) {
      $("#question").value = b.dataset.prompt;
      $("#question").focus();
      return;
    }
    if (b.dataset.node) {
      showNode(b.dataset.node);
      return;
    }
    if (b.dataset.seek !== undefined) {
      if (b.dataset.video === videoId)
        await content("SEEK", { timestamp: Number(b.dataset.seek) });
      else if (studioMode)
        window.open(
          `https://www.youtube.com/watch?v=${encodeURIComponent(b.dataset.video)}&t=${Math.floor(Number(b.dataset.seek))}s`,
          "_blank",
          "noopener",
        );
      else if (!preview)
        await chrome.tabs.create({
          url: `https://www.youtube.com/watch?v=${b.dataset.video}&t=${Math.floor(Number(b.dataset.seek))}s`,
        });
      return;
    }
    if (b.dataset.unpin) {
      await api("PIN", { videoId: b.dataset.unpin, pinned: false });
      await refresh(true);
      return;
    }
    if (b.dataset.retryOcr) {
      await api("OCR_RETRY", { id: b.dataset.retryOcr });
      await refresh(true);
      return;
    }
    if (b.dataset.copy) {
      await navigator.clipboard.writeText(
        exportText(findOutput(b.dataset.copy)),
      );
      notice("Copied notes and source references.");
      return;
    }
    if (b.dataset.export) {
      const o = findOutput(b.dataset.export);
      download(exportText(o), `ytmind-${o.mode}.md`);
      return;
    }
    if (b.dataset.pdf) {
      const output = findOutput(b.dataset.pdf);
      await openPDFExport(
        [output],
        output.evidence?.[0]?.title || session()?.title || "YTMind notes",
      );
      notice(
        "PDF export opened. Choose Save as PDF, then Save in the print dialog.",
      );
      return;
    }
    switch (b.id) {
      case "settings-open":
        await openSettings();
        break;
      case "check-connection": {
        b.disabled = true;
        $("#connection-status").textContent = "Checking Groq…";
        try {
          const models = await api("PROBE", { apiKey: $("#api-key").value });
          $("#available-models").innerHTML = models
            .map((model) => `<option value="${esc(model)}"></option>`)
            .join("");
          const unavailable = [
            $("#model").value,
            $("#verifier-model").value,
          ].filter((id) => !models.includes(id));
          $("#connection-status").textContent =
            `Connected · ${models.length} chat models available.${unavailable.length ? " Choose available replacements for: " + unavailable.join(", ") : " Selected models are available."}`;
        } catch (e) {
          $("#connection-status").textContent = e.message;
        } finally {
          b.disabled = false;
        }
        break;
      }
      case "settings-close":
        $("#settings-dialog").close();
        break;
      case "pin":
        await api("PIN", { videoId, pinned: !session()?.pinned });
        await refresh(true);
        break;
      case "pause-generation":
        pauseRequested = true;
        notice("Will pause after the current section finishes.");
        break;
      case "capture-toggle":
        capture = !capture;
        followRequested = capture;
        await content(capture ? "CAPTURE_START" : "CAPTURE_STOP", {
          interval: state.settings.interval,
          profile: state.settings.profile,
        });
        if (!studioMode && !preview) {
          if (capture)
            await api("AUDIO_START", { videoId, tabId }).catch((e) =>
              notice(e.message, true),
            );
          else await api("AUDIO_STOP");
        }
        render();
        break;
      case "capture-once":
        await content("CAPTURE_ONCE");
        notice("Capturing the current frame. Keep this panel open for OCR.");
        break;
      case "retry-captions":
        await content("RETRY_CAPTIONS");
        notice("Retrying captions. Open YouTube’s transcript panel if needed.");
        break;
      case "extract-graph":
        requestBusy = true;
        render();
        notice("Finding source-backed connections…");
        try {
          await api("GRAPH", { videoId });
          await refresh(true);
          notice("Concepts saved to your graph.");
        } finally {
          requestBusy = false;
          render();
        }
        break;
      case "export-graph":
        download(
          JSON.stringify({ nodes: state.nodes, edges: state.edges }, null, 2),
          "ytmind-graph.json",
          "application/json",
        );
        break;
      case "clear-data":
        if (
          confirm(
            "Delete all sessions, frames, notes and graph data? This cannot be undone.",
          )
        ) {
          if (capture) await content("CAPTURE_STOP");
          capture = false;
          await api("CLEAR");
          researchResult = null;
          selectedNode = null;
          $("#settings-dialog").close();
          await refresh(true);
          notice("Learning data cleared. Reload the video to start again.");
        }
        break;
      case "remove-key": {
        const value = await api("SETTINGS");
        await api("SAVE_SETTINGS", { value: { ...value, apiKey: "" } });
        $("#api-key").value = "";
        notice("API key removed.");
        break;
      }
    }
  } catch (err) {
    notice(err.message, true);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "source-form") {
      const id = sourceId($("#source-url").value);
      await api("SESSION", {
        videoId: id,
        title: $("#source-title").value || "YouTube tutorial",
      });
      localStorage.setItem("ytmind-studio-active", id);
      videoId = id;
      await refresh(true);
      notice("Source connected. Add its transcript or frame images to begin.");
      if ($("#link-auto-ingest").checked && !session()?.transcript.length)
        await ingestLink(id, $("#link-audio-language").value);
    }
    if (e.target.id === "ask-form") await run("chat", $("#question").value);
    if (e.target.id === "research-form")
      await run("research", $("#research-topic").value);
    if (e.target.id === "import-form") {
      await api("IMPORT", { videoId, text: $("#manual-source").value });
      await refresh(true);
      notice(
        "Transcript saved. Supplied timestamps are preserved; plain text starts at 0:00.",
      );
    }
    if (e.target.id === "settings-form") {
      await api("SAVE_SETTINGS", {
        value: {
          apiKey: $("#api-key").value,
          model: $("#model").value,
          verifierModel: $("#verifier-model").value,
          interval: $("#interval").value,
          profile: $("#profile").value,
          ocrLanguage: $("#ocr-language").value,
          audioLanguage: $("#live-audio-language").value,
          deep: $("#deep").checked,
          sage: $("#sage").checked,
          autoNotes: $("#auto-notes").checked,
          autoCode: $("#auto-code").checked,
        },
      });
      $("#settings-dialog").close();
      await refresh(true);
      notice("Settings saved. Open a YouTube video to begin.");
      if (capture && !studioMode && !preview)
        await api("AUDIO_START", { videoId, tabId }).catch((e) =>
          notice(e.message, true),
        );
    }
  } catch (err) {
    notice(err.message, true);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "question")
    questionDrafts.set(renderedVideoId, e.target.value);
  if (e.target.id === "graph-search") drawGraph(e.target.value);
});
document.addEventListener("keydown", (e) => {
  if (
    e.target.id === "question" &&
    (e.ctrlKey || e.metaKey) &&
    e.key === "Enter" &&
    !e.isComposing
  ) {
    e.preventDefault();
    if (!$("#send-question").disabled) $("#ask-form").requestSubmit();
    return;
  }
  const n = e.target.closest("[data-node]");
  if (n && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    showNode(n.dataset.node);
  }
});
document.addEventListener("focusin", (e) => {
  if (e.target.id === "question")
    $("#ask-form").scrollIntoView({ block: "center", behavior: "smooth" });
});
if (studioMode) {
  document.body.classList.add("studio");
  $("#connect-source").hidden = false;
  $("#preview-label").hidden = false;
  $("#preview-label").textContent =
    "LOCAL WORKSPACE · stored in this browser · requested AI processing uses Groq";
  window.addEventListener("ytmind-local", (e) => {
    if (e.detail.type === "FRAME_AVAILABLE") refresh();
    if (e.detail.type === "NOTICE") notice(e.detail.text, true);
  });
} else if (preview) $("#preview-label").hidden = false;
else
  chrome.runtime.onMessage.addListener((m) => {
    if (m.type === "FRAME_AVAILABLE") refresh();
    if (m.type === "NOTICE") notice(m.text, true);
  });
await refresh(true);
// Chrome opens the panel directly on toolbar clicks. Start indexing from the
// actual side-panel document, without depending on an action event callback.
if (!studioMode && !preview && location.hash !== "#settings") {
  const contexts = await chrome.runtime
    .getContexts({
      contextTypes: ["SIDE_PANEL"],
      documentUrls: [location.href],
    })
    .catch(() => []);
  if (contexts.length || new URLSearchParams(location.search).has("embedded")) {
    await api("START_ACTIVE_VIDEO").catch((error) =>
      notice(error.message, true),
    );
    await refresh(true);
  }
}
document.addEventListener("change", async (e) => {
  if (e.target.id !== "frame-files") return;
  const origin = videoId,
    files = [...e.target.files].slice(0, 6);
  const timestamp = Math.max(0, Number($("#frame-time").value) || 0);
  try {
    for (const file of files) {
      const image = await fileFrame(file);
      const added = await api("FRAME", { videoId: origin, timestamp, image });
      if (added?.skipped)
        notice(
          "OCR queue is full. Wait for the current frames, then add more.",
          true,
        );
    }
    await refresh(true);
    notice("Images queued for local OCR.");
  } catch (err) {
    notice(err.message, true);
  }
});
if (!preview) {
  const config = await api("SETTINGS");
  if (!config.apiKey || location.hash === "#settings") await openSettings();
}
setInterval(async () => {
  if (capture && !document.hidden)
    content("CAPTURE_START", {
      interval: state.settings.interval,
      profile: state.settings.profile,
    }).catch(() => {
      capture = false;
    });
  if (capture && !studioMode && !preview && !document.hidden)
    audioActive = !!(
      await api("AUDIO_HEARTBEAT", { videoId }).catch(() => null)
    )?.active;
  await refresh();
}, 5000);

let sourceDraft = null;
function closeSourceDraft() {
  if (sourceDraft) {
    sourceDraft.cancelled = true;
    sourceDraft.controller?.abort();
    sourceDraft.recording?.cancel();
  }
  sourceDraft = null;
  $("#source-dialog").close();
}
function openSourceDraft() {
  const s = session();
  if (!s) throw new Error("Connect a video before importing its source.");
  if (sourceDraft) closeSourceDraft();
  sourceDraft = {
    videoId: s.id,
    expectedCreatedAt: s.createdAt,
    expectedVersion: s.transcriptVersion,
    source: "transcript",
    cancelled: false,
  };
  $("#review-source").value = "";
  $("#review-source").disabled = false;
  $("#save-reviewed-source").disabled = true;
  $("#transcribe-audio").hidden = true;
  $("#stop-recording").hidden = true;
  $("#audio-offset").value = "0";
  $("#audio-language").value = "";
  $("#audio-offset").disabled = false;
  $("#source-progress").textContent =
    "Review the source and its timestamps before saving.";
  $("#source-dialog").showModal();
  return sourceDraft;
}
function reviewSegments(segments) {
  // JSON retains subsecond timestamps through review and editing.
  $("#review-source").value = JSON.stringify(segments, null, 2);
  $("#save-reviewed-source").disabled = false;
}
function readyAudio(draft, file) {
  if (draft.cancelled || sourceDraft !== draft) return;
  draft.audio = file;
  $("#stop-recording").hidden = true;
  $("#transcribe-audio").hidden = false;
  $("#source-progress").textContent =
    `Audio ready (${(file.size / 1024 / 1024).toFixed(1)} MB). Transcribe sends this audio to Groq.`;
}
document.addEventListener("change", async (e) => {
  if (!["subtitle-file", "audio-file"].includes(e.target.id)) return;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const draft = openSourceDraft();
    if (e.target.id === "audio-file") {
      readyAudio(draft, file);
      return;
    }
    if (file.size > 1024 * 1024)
      throw new Error("Choose a subtitle file under 1 MB.");
    const segments = parseTranscript(await file.text());
    if (!draft.cancelled && sourceDraft === draft) reviewSegments(segments);
  } catch (err) {
    if (sourceDraft) $("#source-progress").textContent = err.message;
    else notice(err.message, true);
  } finally {
    e.target.value = "";
  }
});
document.addEventListener("click", async (e) => {
  const id = e.target.closest("button")?.id;
  if (
    ![
      "record-tab-audio",
      "stop-recording",
      "transcribe-audio",
      "save-reviewed-source",
      "source-dialog-close",
    ].includes(id)
  )
    return;
  try {
    if (id === "source-dialog-close") {
      closeSourceDraft();
      return;
    }
    if (id === "record-tab-audio") {
      const draft = openSourceDraft();
      $("#source-progress").textContent =
        "Choose the video tab and enable Share tab audio. Play at normal speed without seeking. Recording stops after 30 minutes or at 24 MB. Enter its video start time before transcribing.";
      const recording = await recordTabAudio({
        onStop: (file) => readyAudio(draft, file),
        onError: (text) => {
          if (sourceDraft === draft) $("#source-progress").textContent = text;
        },
      });
      if (draft.cancelled) recording.cancel();
      else {
        draft.recording = recording;
        $("#stop-recording").hidden = false;
      }
      return;
    }
    if (!sourceDraft) return;
    const draft = sourceDraft;
    if (id === "stop-recording") {
      draft.recording?.stop();
      return;
    }
    if (id === "transcribe-audio") {
      if (draft.controller) return;
      draft.controller = new AbortController();
      $("#transcribe-audio").disabled = true;
      $("#audio-offset").disabled = true;
      $("#source-progress").textContent =
        "Transcribing with Groq… Existing source remains unchanged.";
      try {
        const config = await api("SETTINGS");
        const segments = await transcribeAudio(draft.audio, config.apiKey, {
          signal: draft.controller.signal,
          offset: Number($("#audio-offset").value),
          language: $("#audio-language").value,
        });
        if (draft.cancelled || sourceDraft !== draft) return;
        draft.source = "audio";
        reviewSegments(segments);
        $("#source-progress").textContent =
          `${segments.length} speech segments ready. Review code symbols, commands and timestamps before saving.`;
      } finally {
        draft.controller = null;
        $("#transcribe-audio").disabled = false;
        $("#audio-offset").disabled = false;
      }
      return;
    }
    if (id === "save-reviewed-source") {
      const segments = parseTranscript($("#review-source").value);
      await api("IMPORT_SEGMENTS", {
        videoId: draft.videoId,
        expectedCreatedAt: draft.expectedCreatedAt,
        expectedVersion: draft.expectedVersion,
        segments,
        source: draft.source,
      });
      closeSourceDraft();
      await refresh(true);
      notice("Reviewed transcript saved with its timestamps.");
    }
  } catch (err) {
    if (sourceDraft) $("#source-progress").textContent = err.message;
    else notice(err.message, true);
  }
});
$("#source-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeSourceDraft();
});
window.addEventListener("pagehide", () => closeSourceDraft());

let linkIngest = null;
async function ingestLink(id, language) {
  if (requestBusy || linkIngest)
    throw new Error(
      "Finish or cancel the current job before importing another link.",
    );
  const controller = new AbortController();
  linkIngest = controller;
  requestBusy = true;
  const original = session();
  let expectedVersion = original.transcriptVersion;
  try {
    const config = await api("SETTINGS");
    if (!config.apiKey)
      throw new Error(
        "Add your Groq API key in Settings before automatic link processing.",
      );
    notice(
      "Fetching the video's audio… This happens locally; private or unavailable sources may fail.",
    );
    const response = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: id }),
      signal: controller.signal,
    });
    const created = await response.json();
    if (!response.ok)
      throw new Error(created.error || "The media helper is unavailable.");
    let job;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (controller.signal.aborted) throw new Error("Link import cancelled.");
      const check = await fetch(`/api/media/${created.id}`, {
        signal: controller.signal,
      });
      job = await check.json();
      if (!check.ok || job.status === "failed")
        throw new Error(job.error || "Video retrieval failed.");
    } while (job.status === "processing");
    await api("SESSION", {
      videoId: id,
      title: job.metadata.title,
      audioPrimary: job.metadata.audioPrimary,
    });
    let segments = [];
    for (const [index, chunk] of job.chunks.entries()) {
      notice(
        `Transcribing section ${index + 1}/${job.chunks.length} with Groq…`,
      );
      const audio = await fetch(chunk.audioUrl, { signal: controller.signal });
      if (!audio.ok)
        throw new Error("Audio section is unavailable. Retry the link import.");
      const file = new File([await audio.blob()], "source.mp3", {
        type: "audio/mpeg",
      });
      segments.push(
        ...(await transcribeAudio(file, config.apiKey, {
          offset: chunk.start,
          language,
          signal: controller.signal,
        })),
      );
      await api("IMPORT_SEGMENTS", {
        videoId: id,
        expectedCreatedAt: original.createdAt,
        expectedVersion,
        segments,
        source: "audio",
        coverage: {
          processed: Math.min(chunk.end, job.metadata.duration),
          total: job.metadata.duration,
          status: index === job.chunks.length - 1 ? "complete" : "partial",
        },
      });
      const stored = (await api("STATE")).sessions.find((s) => s.id === id);
      expectedVersion = stored?.transcriptVersion;
      await refresh(true);
    }
    notice("Audio source saved. Generating source-linked notes…");
  } catch (e) {
    throw new Error(
      controller.signal.aborted
        ? "Link import cancelled. Completed source sections remain saved."
        : e.message,
    );
  } finally {
    requestBusy = false;
    linkIngest = null;
    await refresh(true);
  }
  if (videoId === id) await run("notes");
}
window.addEventListener("pagehide", () => linkIngest?.abort());

async function runLectureBatch(start = false) {
  if (requestBusy) return;
  requestBusy = true;
  batchRunning = true;
  batchPaused = false;
  try {
    if (start) await api("BATCH_START");
    let job;
    do {
      notice(
        "Lecture agent is reading the next source section and checking its output…",
      );
      job = await api("BATCH_STEP");
      await refresh(true);
      if (job.status === "failed")
        throw new Error(
          job.entries.find((e) => e.error)?.error ||
            "Batch paused after an API failure. Retry the saved batch.",
        );
    } while (job.status !== "complete" && !batchPaused);
    notice(
      job.status === "complete"
        ? "All lecture notes are saved. Export the collection as PDF or ZIP."
        : "Lecture batch paused. Completed sections are saved.",
    );
  } catch (e) {
    notice(e.message, true);
  } finally {
    requestBusy = false;
    batchRunning = false;
    await refresh(true);
  }
}
document.addEventListener("click", async (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  try {
    if (button.id === "batch-start") await runLectureBatch(true);
    if (button.id === "batch-resume") await runLectureBatch();
    if (button.id === "batch-pause") batchPaused = true;
    if (button.id === "batch-discard") {
      await api("BATCH_DISCARD");
      await refresh(true);
    }
    if (button.id === "batch-export") {
      const files = {};
      for (const [i, entry] of (state.batch?.entries || []).entries()) {
        const parts = (
          state.sessions.find((s) => s.id === entry.videoId)?.outputs || []
        ).filter((o) => o.jobId === entry.jobId);
        if (parts.length)
          files[`lecture-${i + 1}-${entry.videoId}.md`] = strToU8(
            `# ${entry.title}\n\n` + exportText(combineParts(parts)),
          );
      }
      if (!Object.keys(files).length)
        throw new Error("Generate lecture notes before exporting.");
      download(zipSync(files), "ytmind-lecture-notes.zip", "application/zip");
    }
    if (button.id === "batch-pdf") {
      const outputs = (state.batch?.entries || []).flatMap((entry) => {
        const parts = (
          state.sessions.find((s) => s.id === entry.videoId)?.outputs || []
        ).filter((o) => o.jobId === entry.jobId);
        return parts.length ? [combineParts(parts)] : [];
      });
      await openPDFExport(outputs, "YTMind lecture notes");
      notice("Lecture PDF export opened. Choose Save as PDF, then Save.");
    }
    if (button.id === "extract-code") {
      if (requestBusy) return;
      requestBusy = true;
      render();
      notice("Extracting verbatim code candidates from screen evidence…");
      try {
        await api("CODE", { videoId });
        await refresh(true);
        notice(
          "Source code candidates saved. Review and download their files.",
        );
      } finally {
        requestBusy = false;
        render();
      }
    }
    if (button.dataset.codeZip) {
      const output = findOutput(button.dataset.codeZip);
      if (!output?.structure?.snippets.length)
        throw new Error("No source-backed code was retained.");
      const files = { "SOURCE.md": strToU8(exportText(output)) };
      for (const snippet of output.structure.snippets)
        files[snippet.fileName] = strToU8(snippet.code);
      download(zipSync(files), "ytmind-source-code.zip", "application/zip");
    }
  } catch (err) {
    notice(err.message, true);
  }
});
window.addEventListener("pagehide", () => {
  batchPaused = true;
});
