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

| Workflow              | How to use it                                                                      | Evidence boundary                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Lecture notes and PDF | Notes → generate; Library → generate all selected lecture notes → PDF or notes ZIP | Deep mode processes every stored source section; watching captures only observed content          |
| Code files            | Frames → automatic code candidates or Extract source code → download ZIP           | Exact source substrings only; OCR can misread symbols; no missing lines invented or code executed |
| Multi-video research  | Select videos with the diamond, then ask a topic in Library                        | Retrieved context across selected evidence; bounded coverage disclosed                            |
| Mistake detector      | Evidence Lab → compare narration with screen                                       | Nearby narration/OCR excerpts must match stored source text; findings are potential mismatches    |
| Actions               | Actions → generate; Evidence Lab → tutorial preflight                              | Commands and prerequisites must come from the supplied source                                     |

Pin 1–10 lectures for the notes agent. It persists its source snapshots and completed sections, supports pause/continue, and exports the collection. Keep the workspace open while requests are queued. Research reports and graph provenance remain available across sessions.

## Captionless, Urdu and static-image videos

The browser app accepts timestamped text, SRT, VTT and JSON, plus audio uploads and optional tab recording. Audio language can be auto-detected or set to English/Urdu. Review speech recognition before treating it as reliable, especially kalam, naat, singing and names.

Local OCR includes English and Urdu models, with a combined mode in Settings. Decorative lettering, low contrast, diagrams and small code remain difficult. Capture uses visual-change heuristics plus a first snapshot, periodic snapshots and a manual bypass; it does not determine educational importance. Frames without readable OCR are retained for inspection but provide no text evidence. Recognized Art Track artwork is marked as context and excluded from timed mistake comparisons.

No general guarantee covers every video type, perfect lyrics, code correctness, unseen content or factual truth. Silent visual videos need captured readable frames. Live streams use watching capture; pasted-link retrieval is limited to finite public videos. Podcasts and interviews do not have speaker diarization. Diagram interpretation and semantic retrieval remain future work.

## Data, permissions and privacy

Learning data lives in IndexedDB on the extension or browser origin. Video history, sources, generated outputs and graph evidence are saved automatically until cleared. The diamond selects videos for research; it is not required for retention. Opening the workspace refreshes current state while keeping history available in Library. Cross-workspace writes are serialized, and clearing data invalidates in-flight results. The local media helper caches audio inside ignored artifacts/media-jobs; files older than an hour are removed on subsequent media requests, including after restart.

The API key is stored locally and kept out of content scripts, reports and release packages. Groq receives source text for generation/verification and audio for transcription. Local OCR images stay local. Automatic notes and code processing can be disabled in Settings. The local helper receives video identifiers, not API keys. Remove the key separately from clearing learning data.

Extension permissions: storage, sidePanel, alarms, activeTab, tabCapture and offscreen, plus HTTP/HTTPS host access for automatic reading history. Readable page text, title, stripped URL, visit count and furthest scroll position are stored locally; Library offers pause/resume, search, export and deletion. Form fields/editable content are excluded. Known sensitive domains, account/payment paths, password/card forms, local/internal pages and incognito are excluded. These exclusions are heuristic and not a universal sensitive-data detector; pause before reading private material. Captured pages are not automatically sent to Groq. The optional browser recording workflow uses a sharing chooser; the extension's tab-audio workflow uses the installation/invocation grant.

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

### Captionless videos in the extension

The local audio helper can supply the full public video's audio when Chrome tab capture is unavailable. It fetches audio locally and the extension sends it directly to Groq for timestamped transcription, then generates notes. It does not require watching the whole video. Public availability, YouTube retrieval limits and API quotas still apply; musical transcription can be inaccurate.

Run `npm run start:helper` from this project to start the helper at `127.0.0.1:4175`. Pair it with the unpacked extension ID using `YTMIND_EXTENSION_ID`, or an ignored `artifacts/extension-id.txt` containing that ID. Only that extension origin is accepted; API keys are never sent to the helper. With the helper running, Generate study notes automatically tries full audio when captions and substantial frame text are unavailable. The helper is a separate local process and must be running for this fallback.

### Video and Shorts content reports (3.0.28)

Open a video or Short, then choose **Lab → Analyze video / Short**. Captured captions or transcribed audio are analyzed section by section for main ideas, claims, instructions, events and opinions, plus institutional criticism, allegations, harsh language, possible threats and law references when present. English reports include context, keywords and timestamped source references. Results save automatically in history; unfinished reports offer **Continue remaining discussion sections**.

The report covers captured speech, not necessarily the full video. Without complete captions, use audio transcription to obtain fuller coverage. Frame text alone is insufficient to establish speech. Quotations are checked against stored text, while translations and category judgments require review. Legal references describe the speaker's claims and are not independently checked legal advice. Original source wording remains in proof views and exports.

With the native workspace open, captionless Shorts automatically request full-audio transcription after a five-second settling period. The paired local helper and a configured Groq key are required. One job runs at a time; downloaded audio and API processing are not instantaneous. Every video and Short recorded by YTMind is retained in Library without pinning. Older outputs remain as generated until rerun.

Silent videos can use captured screen text without captions or audio. Open YTMind, play through or capture relevant slides/code, then generate notes or choose Analyze video / Short. Reports identify written evidence separately from spoken content. Clips with neither readable text nor audio are not fully understood by the current text-based analysis.

### Chrome reading history and study tools (3.0.34)

Library now saves readable webpages automatically on this device as you browse. Use **Pause reading history** / **Resume reading history** there; the extension icon's ON/OFF badge reflects that preference. Search saved page text, open its original link, export the history, or delete individual entries. Page snapshots are local and are not automatically sent to AI. Forms, editable fields, private browsing and known sensitive pages are excluded; exclusions are heuristic, so pause before reading private material. This does not record all browser actions, password entry, downloads or every media player, and does not recover browsing from before installation. Some pages and built-in PDF viewers cannot be read. Chrome may request expanded website access after this update.

Under Notes, use **Quiz me** or **Create flashcards**, then reveal answers and follow their source references. **Your notebook & saved moments** stores your own notes and labelled timestamps separately from captured evidence. Search your video Library for phrases in saved titles, transcripts, generated answers, notebook notes and bookmark labels. Use Save my notes to persist your notebook edits.


### Page workspace and 24-hour browsing memory (3.0.35)
YouTube retains its video workspace. Other tabs show page Summary, Ask, Actions, Graph, Overview and Library. Ask includes **Help me with this page**, which gives source-aware task guidance; it does not perform clicks or submissions.

Library offers **Enable Chrome history - keep 24 hours**. Chrome requests the optional history permission once. Enabling it deletes Chrome visit records older than 24 hours and activates 24-hour YTMind retention, including saved/pinned records. Export anything you want to keep first. Cleanup runs on startup and approximately every five minutes while Chrome runs, so expiration is not exact while the browser is closed. Sign-in cookies and Chrome passwords remain untouched. No cookies or password permission is requested; requests to Groq explicitly omit cookies.

Use **Open tabs & recent history** for current tab titles/URLs and recent Chrome visit metadata. The listing returns up to 10,000 matching URLs. Earlier visit metadata does not recover uncaptured page text or interactions. Each captured page has a Markdown report and JSON export with its original identity, readable text, recorded clicks/navigation/scroll milestones, personal notes and generated results. Capture excludes editable fields, password/payment forms, known sensitive sites and security challenges; coverage is partial, not a complete recording of every action. Screenshots of arbitrary websites are not recorded by this release.


### Browser Agent and Web Scraper (3.0.36)
Open **Menu > Browser Agent** on YouTube or another tab. Choose Claude or ChatGPT, describe a task, optionally attach PDF/DOCX/TXT/Markdown/CSV (up to 8 MB), then Run. YTMind opens a new provider tab in your existing Chrome profile; sign in there if required. It attempts to attach and send, monitors the response, and offers Markdown/JSON export. If a provider requires attention, use Continue after sign-in, or send manually and choose Read response. Stop monitoring cannot undo a message already sent. Provider adapters are best effort and can require manual assistance after website changes; they are not a universal autonomous browser agent. Passwords and cookies are not read or transferred. The explicitly attached document and prompt are sent to the chosen provider website. Active task data is in memory and can be lost on extension/service-worker reload.

Open **Menu > Web Scraper** for public text, links, tables or cleaned HTML from 1-10 URLs. Collection runs in a separate headless Selenium browser through the local helper. It does not use your sign-in profile. Setup once with `npm run setup:browser`, then run `npm run start:helper`. HTML collection removes scripts, forms, hidden content and most attributes; HTML export is a cleaned DOM snapshot, not a faithful archival copy or a complete website download. Collection is not performed on security challenge pages or detected password/payment forms. The selected collection mode determines extraction; arbitrary natural-language browser commands are not executed as code.

Verification commands: `npm run check`, `npm run test:browser-agent`, `node tests/browser-scraper.mjs`, `npm run test:reading`, `npm run test:ui`. Provider upload/submission/response tests use controlled fixture HTML, not a live signed-in AI account. Selenium has also been checked against a controlled webpage and a real public page (Example Domain).
