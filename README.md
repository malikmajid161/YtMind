# YTMind

A source-aware YouTube learning workspace: visual evidence, deep study notes, actionable steps, cited Q&A, and connected knowledge across videos.

This is a fresh implementation. The previous version remains available at the `v1-before-rebuild` Git tag. Original requirements are preserved in `docs/original/`; their critique and replacements are part of this repository.

## Run the extension

Requires Node.js 22+ and Chrome 116+.

```sh
npm ci
npm run build
```

1. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
2. Select this repository's **dist** folder.
3. Pin the extension, open a YouTube video, and click YTMind's toolbar icon or on-page button.
4. Enter a Groq API key in Settings and check the connection/available models. Your key stays in extension storage, inaccessible to content scripts.
5. Generate notes or actions, ask a question, or explicitly start visual indexing.

If upgrading, remove/disable the old YTMind extension first; v1 storage is not automatically migrated or deleted. Reload YouTube after installing this build.

## What is implemented

- Native Chrome side panel with Notes, Ask, Actions, Graph, Frames, Library, and Evidence Lab.
- Caption capture using visible transcript, signed caption URL, and best-effort YouTube endpoints; manual transcript fallback.
- Local canvas capture with visual change filtering, English OCR, and text deduplication. Performance mode uses up to 1600px frames and two worker slots; balanced mode uses 960px and one slot. Capture requires a user start and a live panel lease.
- BM25 retrieval; research selects relevant evidence across pinned videos rather than letting one video dominate the context.
- Deep notes and actions process every captured source chunk in sections, persist progress, and support pause/continue. Source snapshots keep successive sections consistent while new frames arrive. Quick mode samples the source and discloses coverage.
- SAGE independently generates a comparison answer, then checks source support per claim. Invalid evidence refs are downgraded. Failures produce **Unchecked**, never a fake success.
- Evidence Lab compares temporally nearby narration and OCR with exact quoted excerpts; tutorial preflight retains source-matched commands/prerequisites/warnings. Findings remain hypotheses, with coverage disclosed.
- Proof view exposes stored source excerpts behind every output citation. Source versions preserve provenance when transcripts change.
- Persistent concept graph with normalized node IDs, deduplicated edges, and retained evidence excerpts.
- Markdown export, copy, graph JSON export, and browser **Save as PDF** through the print dialog, preserving Unicode text.
- Per-video 24-hour expiry for unpinned sessions and frames. Pinned evidence and graph excerpts persist until cleared.

## Honest limits

Captions depend on changing YouTube interfaces and signed requests; availability is not guaranteed. OCR cannot reconstruct arbitrary diagrams, recover unreadable text, or guarantee code correctness. Only frames captured while watching are available. Deep processing covers captured evidence, not unseen video content. BM25 is lexical retrieval and may miss paraphrases. Graph extraction uses selected context. Research is bounded to the retrieved context. SAGE checks source support and model consistency, not independent real-world truth.

Keep the panel open during deep jobs and OCR. Closing it stops new section requests; completed sections remain saved. The API provider's quotas may require retrying or continuing later. The side-panel design preview uses sample data and cannot generate real results. No benchmark superiority claim has been established.

## Data and network behavior

IndexedDB lives on the extension origin. API keys live in `chrome.storage.local`, with trusted-context access only. Local OCR workers, WASM, and English language data are bundled; there is no runtime OCR CDN. Images are not sent to Groq. Source text and generated answers used by SAGE are sent when you request generation; optional end-of-video overview generation explicitly enables automatic text transmission. Clear data removes all four learning stores; removing the API key is a separate control.

Permissions are limited to `storage`, `sidePanel`, and `alarms`, plus YouTube and Groq host access. No audio capture, broad browsing access, or backend server.

## Development and verification

```sh
npm run check              # meaningful core tests + unpacked build
npx playwright install chromium
npm run test:ui            # preview tabs, responsive layout, settings and graph
npm run test:extension     # packaged MV3 runtime, OCR and mocked Groq integration
npm run test:ocr           # real local browser OCR + raw controlled measurements
npm run research:retrieval # compare BM25 against preserved v1 on fixed fixtures
npm run research:live      # bounded real provider pilot; needs ignored .env.local
npm run preview           # labeled sample-data preview at localhost:4173
npm run format
```

Tests using mocked Groq responses establish routing and error behavior, not real model quality. See [validation](docs/VALIDATION.md), [requirements](TRD.md), [critique](docs/CRITIQUE.md), and [competitor benchmarks](docs/COMPETITORS.md).

The [controlled pilot](research/PILOT_RESULTS.md) and [real Groq pilot](research/LIVE_PILOT.md) preserve measured successes and failures. The [research protocol](research/PROTOCOL.md) targets English coding/technical tutorials; the [paper outline](research/PAPER_DRAFT.md) is explicitly preliminary. Neither these pilots nor unit tests establish competitor superiority.

The build uses [Chrome's side-panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Groq chat completions](https://console.groq.com/docs/openai), and [Tesseract.js](https://github.com/naptha/tesseract.js). Configurable model IDs can be updated when provider availability changes.
