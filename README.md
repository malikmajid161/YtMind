# YTMind 3.0

A working YouTube learning app with source-linked notes, PDF export, code-file extraction, multi-video research, narration–screen comparison and action lists.

## Browser app: paste a link

Requires Node.js 22+, Python 3.10+ and Chrome for browser tests. The media helper installs inside the project; it does not change Windows settings.

```sh
npm ci
npm run setup:media
npm run build
npm start
```

Open http://127.0.0.1:4173, add your own Groq key in Settings, paste a YouTube URL and choose its audio language. Automatic link processing fetches audio locally, transcribes it with Groq, then generates notes and checks their source support. Existing source text is preserved when reopening a saved video.

Public videos up to two hours are split into approximately 20-minute audio sections. Each section must fit the 24 MB upload limit. Private, unavailable, age-restricted and live sources can fail retrieval; use the watching extension or upload your own source instead. Provider quotas can pause verification. Successful source sections remain saved if a later section fails.

## Extension: click the brain

For this checkout, select **app/dist** using **Load unpacked** at chrome://extensions. Select the folder containing `manifest.json`; the **app** source folder itself is not an installable extension. If `dist` is missing, run `npm run build` inside `app` first.

Alternatively, run `npm run package`, extract the generated ZIP, then select its folder containing `manifest.json` using **Load unpacked**. Click the green YTMind brain button on a YouTube watch page to open the workspace in a drawer on the right. Close YTMind dismisses the drawer; clicking the brain opens it again. The Chrome toolbar icon remains an alternative native side-panel entry point. Settings must contain your Groq key for generation and audio transcription.

The extension uses captions when available. Missing captions use the tab-audio API and an offscreen worker; this path does not show a recurring screen-sharing chooser. Chrome requires installation permissions and an extension invocation for the target tab. The on-page brain button opens the panel, but the toolbar icon is required to grant tab-audio access. Stop indexing stops audio and frames. A short panel heartbeat expires capture when the workspace closes.

Live capture discards ads and sections interrupted by seeking or speed changes. Use normal-speed playback for aligned speech timestamps. The first audio section is approximately ten seconds, then sections are approximately thirty seconds. Transcription latency and provider quotas vary. Backpressure is bounded and skipped audio is disclosed; import the full audio when complete coverage matters.

The native packaged extension and offscreen lifecycle pass automated checks. A headless keyboard test could not invoke the toolbar action and did not exercise actual tab-audio activation; desktop toolbar acceptance remains unverified. Its failed observation is retained in research/results/native-audio-smoke.json.

## Agent workflows

| Workflow              | How to use it                                                                    | Evidence boundary                                                                                 |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Lecture notes and PDF | Notes → generate; Library → generate all pinned lecture notes → PDF or notes ZIP | Deep mode processes every stored source section; watching captures only observed content          |
| Code files            | Frames → automatic code candidates or Extract source code → download ZIP         | Exact source substrings only; OCR can misread symbols; no missing lines invented or code executed |
| Multi-video research  | Pin videos, then ask a topic in Library                                          | Retrieved context across pinned evidence; bounded coverage disclosed                              |
| Mistake detector      | Evidence Lab → compare narration with screen                                     | Nearby narration/OCR excerpts must match stored source text; findings are potential mismatches    |
| Actions               | Actions → generate; Evidence Lab → tutorial preflight                            | Commands and prerequisites must come from the supplied source                                     |

Pin 1–10 lectures for the notes agent. It persists its source snapshots and completed sections, supports pause/continue, and exports the collection. Keep the workspace open while requests are queued. Research reports and graph provenance remain available across sessions.

## Captionless, Urdu and static-image videos

The browser app accepts timestamped text, SRT, VTT and JSON, plus audio uploads and optional tab recording. Audio language can be auto-detected or set to English/Urdu. Review speech recognition before treating it as reliable, especially kalam, naat, singing and names.

Local OCR includes English and Urdu models, with a combined mode in Settings. Decorative lettering, low contrast, diagrams and small code remain difficult. Capture uses visual-change heuristics plus a first snapshot, periodic snapshots and a manual bypass; it does not determine educational importance. Frames without readable OCR are retained for inspection but provide no text evidence. Recognized Art Track artwork is marked as context and excluded from timed mistake comparisons.

No general guarantee covers every video type, perfect lyrics, code correctness, unseen content or factual truth. Silent visual videos need captured readable frames. Live streams use watching capture; pasted-link retrieval is limited to finite public videos. Podcasts and interviews do not have speaker diarization. Diagram interpretation and semantic retrieval remain future work.

## Data, permissions and privacy

Learning data lives in IndexedDB on the extension or browser origin. Unpinned sessions expire after 24 hours; pinned sessions and graph evidence persist until cleared. Cross-workspace writes are serialized, and clearing data invalidates in-flight results. The local media helper caches audio inside ignored artifacts/media-jobs; files older than an hour are removed on subsequent media requests, including after restart.

The API key is stored locally and kept out of content scripts, reports and release packages. Groq receives source text for generation/verification and audio for transcription. Local OCR images stay local. Automatic notes and code processing can be disabled in Settings. The local helper receives video identifiers, not API keys. Remove the key separately from clearing learning data.

Extension permissions: storage, sidePanel, alarms, activeTab, tabCapture and offscreen, plus YouTube and Groq host access. No microphone input or broad browsing access. The optional browser recording workflow uses a sharing chooser; the extension's tab-audio workflow uses the installation/invocation grant.

## Verification and research

```sh
npm run check
npx playwright install chromium
npm run test:ui
npm run test:extension
npm run test:ocr
npm run test:ocr:urdu
npm run package
```

Explicit live tests use only an ignored .env.local key: test:audio:live, test:art-track:live, test:link:live, test:batch:live and test:code:live. They can incur provider usage and produce observations under research/results. Mocked tests are separate engineering evidence; they do not establish real model quality.

Measured real workflows include the user's 6:36 Urdu Art Track, paste-link generation/verification, automatic code export, and notes for five authored lecture excerpts. The excerpts are not five full lecture videos. Some SAGE checks hit quotas and remained Unchecked. Raw failures and scope limitations are retained. See docs/VALIDATION.md and docs/VIDEO_COVERAGE.md.

The research protocol targets English coding/technical tutorials. The paper is preliminary: synthetic pilots and integration tests do not establish competitor superiority or publication-ready accuracy. See research/PROTOCOL.md, research/PILOT_RESULTS.md and research/PAPER_DRAFT.md. Original plans are preserved in docs/original and v1 in the v1-before-rebuild tag.
