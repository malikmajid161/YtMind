# YTMind — revised technical requirements

Revision: 13 October 2026. This document supersedes the original v2 plans. User direction: rebuild from scratch, use a capable system, and improve against competitors module by module.

## Product objective

Build an evidence-aware YouTube learning and research workspace. Users should understand a video, act on a tutorial, preserve important source material, and connect ideas across videos without losing the trail back to exact source moments.

Competitive success requires demonstrated accuracy, coverage, usability, latency and cost; a checklist of agent names is insufficient. [Competitor analysis](docs/COMPETITORS.md) defines benchmarks and remaining gaps.

## Architecture

- Manifest V3 native side panel; content script on YouTube, active only on watch pages.
- Content script owns DOM interaction, captions, timestamps and canvas capture. It never accesses the API key.
- Background service worker owns IndexedDB, settings, provider calls and validated messages. Serialized writes prevent lost updates; clear-data epochs prevent in-flight output resurrection.
- Panel owns rendering, explicit user requests, local OCR worker slots and resumable deep-section orchestration.
- Groq provides generation and comparison; no YTMind server. OCR worker, WASM and English language data are bundled.
- Vanilla JavaScript modules and esbuild, committed package lock, no opaque source-less bundles.

## Data model and lifecycle

| Store    | Identity and payload                                                                                                | Retention                            |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| sessions | video ID, title, URL, created/expiry times, transcript, caption status, pins, output history, deep source snapshots | Unpinned: 24h. Pinned: until cleared |
| frames   | UUID, video ID, timestamp, JPEG, OCR text/confidence/status                                                         | Follows session; max 100 per video   |
| nodes    | Normalized concept label, display label/type, timestamped evidence excerpts                                         | Until cleared                        |
| edges    | Source/target/relation tuple, evidence excerpts                                                                     | Until cleared                        |

Do not reset persistent learning memory when a temporary session expires. Clear all learning data clears every store. API-key removal is separate. V1 storage is not migrated automatically.

## Module contracts

1. Ingestion: attempt captions, expose failure, support manual transcript. Every asynchronous result is associated with its originating video. Manual text has 0:00 provenance and is not presented as timestamp-accurate.
2. VERA: explicit capture start; sample playable non-ad frames, gate similar/flat frames, run local OCR, deduplicate text, cap stored frames and pending queue. Performance/balanced CPU profiles. No guaranteed diagram semantics or exact code.
3. Retrieval: BM25 with bounded evidence, separate source IDs, and source diversity in research. Deep notes/actions use all captured chunks in immutable bounded sections. Quick outputs disclose sampling.
4. ARIA/Notes: grounded Markdown and visible evidence. Preserve literal commands/code; avoid invented prerequisites. Save sections progressively and support pause/continue. Exports include source links and grounding limitations.
5. KGMA: validate JSON, refs and edge endpoints; normalize IDs, merge provenance, expose node sources and relationships. Persistent graph evidence is independent of ephemeral sessions.
6. Research: query pinned video evidence; consolidate differences and cite video/timestamp. No silent inclusion of unrelated sessions or uncaptured video content.
7. SAGE: independent comparison plus source-based claim checking. Model agreement alone is insufficient. Verification failures are Unchecked; missing refs cannot be supported. Display disagreements and inspectable claim refs.

## Interface

Notes, Ask, Actions, Graph, Frames, Library and Evidence Lab, plus onboarding/settings. Empty states explain the next step. Source timestamp buttons seek the current video or open another source video. Proof view exposes stored excerpts; Lab compares nearby narration/OCR and builds quote-validated preflight checklists. Settings expose key, account model discovery, capture interval, CPU profile, deep processing, SAGE and optional automatic overview generation. Markdown is sanitized. Graph is keyboard-operable. A sample-data preview is clearly labeled.

## Quality gates

Reproducible unpacked build, core behavior tests, browser UI checks, packaged extension integration and bundled OCR smoke checks. External endpoint changes and real model quality require live testing. Performance budgets and competitor superiority require the benchmark corpus; they cannot be inferred from unit tests. See [validation](docs/VALIDATION.md).

## Beyond the first rebuild

Benchmark and improve caption resilience, multilingual/code/math OCR, semantic diagram extraction, hybrid retrieval, entity resolution, graph scale, comparative research coverage, annotation/editing, learning assessment, integrations and measured performance. GPU/WASM/WebGPU paths may be added when useful on the user's capable system; they are not mandatory browser dependencies.
