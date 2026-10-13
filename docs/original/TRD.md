# YTMind 2.0 — Technical Requirements Document

## Project Overview

YTMind 2.0 is a Chrome Extension that attaches an intelligent multi-agent panel to YouTube. When a user watches a video, a team of specialized AI agents works in the background to extract knowledge, detect key actions, build a cross-session memory, and produce structured outputs — all without requiring audio or captions.

**Core Direction:** Lightweight agentic understanding of silent/tutorial videos on CPU using visual-only processing.

**API:** Groq API (not OpenAI)
**Platform:** Chrome Extension (Manifest V3)
**Storage:** IndexedDB (in-browser, no server required)
**Session Duration:** 24 hours — data resets after, user is notified

---

## What is Already Built (v1 Baseline)

- Chrome Extension shell with YouTube panel injection
- RAG pipeline (ask questions about current video)
- Summarize feature
- Caption-failure detection
- Groq API integration

> **Do not rebuild v1. Extend it.**

---

## Agents to Build (v2 Modules)

### ARIA — Action Item Extractor
Extract all actionable steps from a video transcript or captions.
Output: numbered list of steps the viewer must take.
Trigger: user clicks "Extract Actions" or automatically when tutorial-type video detected.

### VERA — Visual Frame Indexer
Periodically capture frames from the video. Decide which frames contain meaningful content (code, diagrams, text, equations). Discard empty or redundant frames. Store selected frames with timestamps.
Trigger: runs silently in background during video playback.

### KGMA — Knowledge Graph Memory Agent
After each video session, extract key concepts and entities. Store them in IndexedDB as nodes and relationships. When user watches a new video on the same topic, connect new knowledge to existing nodes.
Output: a visual knowledge graph the user can browse.

### SAGE — Hallucination Checker
When RAG answers a user question, a second agent independently checks the answer against the source transcript/frames. If mismatch found, flag the answer as potentially incorrect.
Output: answer with confidence tag (Verified / Uncertain / Conflicting).

### Notes Agent
At the end of any lecture/tutorial video, produce structured markdown notes automatically. Include: title, key points, code snippets (if any), action items, and summary.
Output: downloadable markdown or PDF file.

### Multi-Video Research Agent
User can pin multiple videos on the same topic. This agent reads all their stored data from KGMA and produces a single consolidated research report.
Output: structured report combining insights from all pinned videos.

---

## Real Use Cases (Priority Order)

1. Auto Notes from lecture videos
2. Action Item extraction from tutorial videos
3. Code extraction from coding tutorial videos (via VERA frames)
4. Multi-video research summary
5. Hallucination-checked Q&A (SAGE)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3, Vanilla JS or React |
| LLM | Groq API (llama3 or mixtral) |
| Vision/OCR | Tesseract.js (in-browser OCR) |
| Frame Capture | Canvas API |
| Storage | IndexedDB |
| Notes Export | jsPDF or markdown download |
| Knowledge Graph UI | D3.js or Cytoscape.js |

---

## Constraints

- Everything runs in-browser — no backend server
- Must work on CPU only — no GPU dependency
- Works on silent videos (no audio/captions required)
- Session data expires after 24 hours
- Must be research-paper quality work

---

## Folder Structure Expected

```
ytmind-v2/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   └── injector.js
├── agents/
│   ├── aria.js
│   ├── vera.js
│   ├── kgma.js
│   ├── sage.js
│   ├── notes-agent.js
│   └── research-agent.js
├── panel/
│   ├── panel.html
│   ├── panel.js
│   └── panel.css
├── storage/
│   └── indexeddb.js
├── utils/
│   ├── ocr.js
│   ├── groq.js
│   └── session.js
└── export/
    └── pdf-generator.js
```

---

## Milestones

See individual milestone files:
- `milestone-1.md` — Foundation & Session Layer
- `milestone-2.md` — VERA (Visual Frame Agent)
- `milestone-3.md` — ARIA (Action Extractor) + Notes Agent
- `milestone-4.md` — KGMA (Knowledge Graph Memory)
- `milestone-5.md` — SAGE (Hallucination Checker) + Multi-Video Research Agent
