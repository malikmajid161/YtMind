# YTMind progress

Updated 14 October 2026, Asia/Karachi. **Active again after the saved checkpoint; see CHECKPOINT.md.**

- [x] Reviewed supplied Markdown and v1; revised plans and preserved originals.
- [x] Rebuilt seven-module native extension and working browser workspace.
- [x] Added shared service, IndexedDB, local OCR, cited generation, verification, graph, library, Evidence Lab and exports.
- [x] 35 core tests and build passed; packaged MV3, UI and workspace integration passed locally.
- [x] Real browser Groq integration: eight workflows, 15 successful requests; raw results saved.
- [x] Research protocol, primary-source review, competitor matrix and honest preliminary experiments saved.
- [x] First rebuild pushed; original v1 tagged v1-before-rebuild.
- [x] Checkpoint CI passed all checks (run 38502652001).
- [ ] Fix live YouTube automatic captions (title refresh now verified): latest probe zero segments, one captured frame.
- [ ] Complete documentation, installable release packaging and final review.
- [ ] Evaluate held-out real tutorials and competitors with human annotations before publication.

Earlier administrator-policy blocker diagnosis was incorrect. Invalid extension CSP was fixed and the native smoke test now passes.

No universal reliability, novelty or competitor-superiority claims are established. Research is preliminary: BM25 27/32 top-1 vs v1 26/32 (paired p=1.0); OCR 7/8 exact; one label error in eight Groq pilot cases.

Full run commands, known failures and next steps are in CHECKPOINT.md. Local credentials and generated browser artifacts remain ignored.

## Active product completion — 14 October 2026

- Implemented timestamped SRT/VTT/JSON/text imports and reviewable audio transcription.
- Real authored English speech path passed: four segments, all four expected keywords, notes generated through Groq.
- User-specified Urdu Art Track Uinx1py7Jsg (396 seconds): real full audio returned 29 Urdu-script segments in 8.4 seconds; human accuracy review remains pending. Blank instrumental segments exposed and fixed an ingestion bug.
- Added bundled Urdu OCR and auto/English/Urdu audio selection.
- Added offscreen native tab-audio fallback without a recurring recording chooser; toolbar action opens the side panel and starts indexing. Installation permission and per-tab Chrome invocation remain platform requirements.
- Added periodic frame snapshots beyond visual heuristics, preserving snapshots with no readable OCR.
- Added persistent multi-workspace invalidation, lecture-batch notes with pause/resume, and verbatim code-file extraction/export.
- Local URL audio helper and full paste-link integration are being verified. Release checks and documentation refresh remain in progress.

## User priority update — 14 October 2026

1. Debug actual YouTube caption capture returning zero segments on public/live sources. Network and DOM diagnostics underway; ASR success is not being counted as caption success.
2. Finish installable ZIP with README and installation instructions after final regression/CI checks.
3. Evaluate five held-out real tutorial videos and write eval-results.md. Human accuracy labels require an actual reviewer; a review pack will be prepared and unprovided human labels will remain pending.

## Caption debugging checkpoint — 14 October 2026

- Reproduced the zero-segment probe in a plain Chrome session without YTMind. YouTube's own transcript requests returned HTTP 400 FAILED_PRECONDITION; its player displayed "Sign in to confirm you're not a bot".
- Verified updated TranscriptFetcher against that real page: status=blocked, captionSegments=0, needsAudio=false. This is not successful live caption capture.
- Loaded-page metadata is used before fetching a second watch page; stale SPA video metadata is rejected.
- Failed caption retries preserve existing saved evidence. Panel displays the actual playback blockage; known blocked sessions do not initiate audio transcription.
- 50 unit tests and extension build passed. Browser and packaged-extension regressions are being rerun.
- Successful caption capture on an unrestricted, normally playing YouTube session remains unverified. GitHub push is held per the user's instruction to debug first.

Caption checkpoint regression results: 50/50 unit tests, build, browser UI integration and packaged MV3 integration passed. Integration provider responses are mocks; the external YouTube blockage diagnostic is real. Updated unpacked ZIP built successfully. No GitHub push performed.

## Side-panel opening correction — 14 October 2026

- Toolbar opening now uses Chrome's native openPanelOnActionClick=true behavior. Errors in the fallback opening path are logged instead of silently discarded.
- Actual side-panel initialization starts indexing through a trusted background request, independently of whether Chrome fires action.onClicked.
- Failed on-page opening shows a toolbar instruction on the brain button.
- 51 unit tests and build passed. Packaged browser integration clicked the actual content brain button, observed a real SIDE_PANEL context and verified automatic capture activation. This uses a controlled YouTube fixture, not live caption or live audio accuracy.
- dist and installable ZIP rebuilt. Reload the existing unpacked extension in chrome://extensions, then refresh YouTube. GitHub push remains held at the previous caption-debug checkpoint.

## Existing-tab reconnection and audio diagnostics — 14 October 2026

- User confirmed extension key and toolbar invocation; then reported receiving-end missing. Added trusted CONNECT_VIDEO path that pings and reattaches bundled content.js on authorized YouTube video tabs. Concurrent reconnects share one injection; unrelated sites are excluded.
- Added scripting permission for recovery and an isolated IIFE content bundle to avoid redeclaration against stale injected scripts.
- Packaged integration reloaded the extension (headless CLI profile required re-enabling the disabled extension), kept the existing watch page, and successfully recovered its content receiver without refreshing the video.
- Audio startup failures now persist in session status, paused audio indicates playback needed, and repeated audio starts retain an existing matching stream.
- 55/55 unit tests passed, packaged MV3 integration passed, dist and ZIP rebuilt. Live ASR on the user's current kalam remains unverified. New screenshot/error status is needed if audio still fails; do not claim whole-video context from live played-only capture.

## SPA navigation root cause and v3.0.1 — 14 October 2026

- Reproduced user's SESSION rejection and audio "Video session is not ready" during same-document YouTube navigation. Chrome MessageSender.url retained the initial video URL. Validation now checks live chrome.tabs.get URL, preserving origin restrictions and rejecting stale old-video messages.
- Preserves active indexing across navigation-start/finish and resumes if YouTube resets the capture lease. Waits through page transitions instead of reading stale player DOM. CONNECT_VIDEO ensures the session exists before downstream audio starts.
- Packaged browser regression switches A → B → C → A through history/navigation events without reloading the document; each source is stored under its own video ID and capture stays active. Reload/reconnect test also passes.
- On-page brain click starts indexing even with an existing panel; toolbar remains an alternate way to open the panel. Chrome tab-audio eligibility still depends on browser authorization; this change does not bypass it.
- Uses already-visible captions immediately; secondary watch metadata timeout reduced from 15 to 5 seconds. Caption DOM reading removes matching accessibility timestamp labels, preserves actual spoken duration phrases, and shares one parser.
- Fixed provider citation forms such as E1 with line suffixes to canonical E1 links, without retaining fabricated line numbers. Notes prompt omits irrelevant code sections and forbids inventing action items or translating garbled devotional captions as reliable source facts.
- Offscreen audio startup waits for its message handler rather than failing on a creation race.
- 59 unit tests and browser/packaged-extension checks passed. Full-audio workflow on user video FhMFEq6_G-k returned four HTTP 200 responses and notes in 32,804 ms. This is a local companion/browser workflow, not a native live tab capture success or a human accuracy evaluation.
- Header and manifest now show 3.0.1 so user can distinguish stale loaded code. Local dist rebuilt. Previous saved notes remain historical outputs and should be regenerated to use corrected parsing/citations.

## OCR CSP correction — v3.0.2, 14 October 2026

- User reported a blocked connect-src data:application/octet-stream WebAssembly request. Tesseract's embedded .wasm.js loader attempted a data URL fetch.
- Switched to plain packaged .js loaders and external same-origin .wasm binaries. Uses wasm-feature-detect SIMD selection with a portable LSTM fallback; no connect-src/script-src/worker-src relaxation.
- Added direct pinned detector dependency and bundled Apache license. Build excludes embedded .wasm.js variants.
- 59 core tests passed. Packaged extension OCR passed with a CSP-error assertion and a check that its selected loader contains no embedded WASM payload. English suite: 7/8 exact, two workers passed, zero external requests. Clean Urdu fixture: exact, confidence 91, zero external requests.
- Manifest/header version 3.0.2; reload loaded extension once to activate this fix. This fixes the OCR loading error; it does not establish captionless native-audio accuracy.

## Ask typing correction — v3.0.3, 14 October 2026

- User reported the Ask draft disappearing after typing a word. Background state changes rebuilt the workspace and replaced the focused textarea.
- Ask now retains the connected form element during same-video redraws, preserving text, focus, selection and input composition. Submit button state and surrounding results still update. Drafts are kept in memory separately per video and restored on tab return; they are not sent to the API before submission.
- Browser regression types a word, writes a background library update through real IndexedDB, triggers refresh, verifies the same focused textarea and text, continues typing, then switches tabs and verifies the full draft remains. Browser integration passed; 59 core tests passed.
- Version header/manifest 3.0.3. Reload extension once to activate. A page reload ends the in-memory draft lifetime; persisted draft storage was not added.

## Source modality and stale notices — v3.0.4, 14 October 2026

- User confirmed frame detection and showed 118 caption segments with completed notes. Their model answer incorrectly described garbled frame OCR as later caption text while SAGE marked that claim supported.
- Frame evidence now carries OCR provenance and engine confidence (explicitly not factual accuracy). Generation instructions preserve modality. Deterministic source-type audit downgrades supported caption/transcript claims whose references consist only of frame OCR; uncertain interpretation still requires human review.
- Missing-source error notices are scoped to video, module and source/output versions and clear when that context changes. Browser regression verifies a missing-source error clears on module switch. Ask draft/focus regressions continue to pass.
- 60 unit tests and browser integration passed. Previous notes retain their original saved answer/verdict; regenerate notes to apply new checking. Header/manifest 3.0.4.

## Tiny-line OCR handling — v3.0.5, 14 October 2026

- User reported Image too small to scale (1x36 vs minimum width 3). The diagnostic can refer to an internal line crop rather than the captured frame dimensions.
- Added decoded-image size validation: inputs narrower or shorter than three pixels return no text and never enter the OCR engine. Pixel data is not fabricated or enlarged into claimed evidence.
- Browser loader adapter classifies only the two known skipped-line diagnostics as informational messages. Unknown warnings, aborts and exceptions retain their original reporting/behavior; this is diagnostic severity handling, not a claim that unreadable text has become readable.
- Tested a sparse-text segmentation alternative, observed regression from 7/8 to 6/8 exact English fixtures and higher character error, and reverted it. Trial observations retained in research/results/ocr-segmentation-trial.json.
- 61 unit tests passed, including diagnostic routing. Actual browser tests cover 1x36 and 2x36 inputs, then readable frames and two workers. English baseline restored to 7/8 exact, Urdu clean phrase exact/confidence 91, packaged extension checks passed. No external OCR requests.
- Header/manifest v3.0.5; one extension reload applies the new adapter. An unreadable fragment remains absent from recognized text; actual user frame accuracy was not measured.

## Ask send, PDF export and OCR line quality — v3.0.6, 14 October 2026

- Added clearly labelled Send question button and Ctrl+Enter submission; focuses/scrolls the complete form into view. Browser integration at 320x700 verifies the button stays in the viewport, keyboard and click submission both produce answers, and earlier draft/focus checks remain valid.
- Fixed built-in prerequisite/code shortcut retrieval to inspect source context even without exact words; unrelated free-text questions still require relevant evidence.
- Replaced side-panel window.print calls with a dedicated regular export tab. It invokes Chrome's print/save dialog with selected output(s), full source references and live moment links. User chooses Save as PDF and Save; this is not a silent direct-download PDF writer. Supports lecture batch exports too. Export payload contains outputs only, no settings/keys; old temporary payloads pruned after a day.
- Actual browser export produced a readable one-page PDF with extractable text and source link annotation. Rendered via Poppler and visually inspected. Native packaged extension also created the export tab successfully. Provider responses in those tests are mocks; browser/PDF/storage behavior is real.
- OCR now requests structured line data. Lines below the conservative engine-confidence gate of 60 are excluded from automatic text evidence; accepted text preserves original line whitespace. Raw OCR and uncertain lines remain stored and inspectable. This threshold is an engineering gate, not calibrated semantic accuracy. A supplied clean-caption fixture is retained while weak gibberish is excluded; actual user-frame accuracy is unmeasured.
- Added Re-read frame for existing accepted/no-text frames. Retry clears prior active OCR until reprocessing completes. Old generated notes are unchanged and should be regenerated after re-reading sources.
- 64 core tests pass; browser integration and packaged-extension tests pass. English 7/8 fixture accuracy and clean Urdu fixture exact result remain unchanged. Manifest/header 3.0.6. PDFs, image renders and marker output stay in ignored local artifacts.

## 2026-10-14 — v3.0.7 Ask context and readable English

- Fixed Ask reporting no source when English keywords do not match saved Urdu/Hindi evidence. Chat includes all captured chunks up to 18,000 text characters; longer sources keep bounded relevant retrieval and fall back to spread context on a lexical miss. Coverage still reports selected versus total. This does not claim every long video fits one request.
- Truly empty readable sources now have a distinct message. Saved model summaries are not substituted for original evidence. Source absence answers must say not found in captured evidence rather than assert absence from the entire video.
- New notes and answers are prompted in English with readable short paragraphs, concise bullets and explicit translation uncertainty. Raw evidence remains original for audit. Existing saved notes require regeneration.
- PDF export labels raw text as an original-language source appendix to distinguish it from the generated answer.
- 65 unit tests pass, including service-level English-question/Urdu-source regression with a mocked provider; installable 3.0.7 ZIP built. This is not a measured live answer-accuracy result.
- Remaining broader work: persistent automatic history and favorites/research separation, robust on-page/PWA entry, autonomous visual processing, explicitly labelled outside-knowledge answers, and held-out human evaluation. Do not describe these as completed by this focused fix.
- Browser integration and packaged MV3 checks also pass after updating the empty-source UI assertion. API responses in these integration checks are mocked; browser/storage behavior is real.

## 2026-10-14 — v3.0.8 On-page drawer and related answers

- The green on-page brain button opens an extension-origin iframe drawer on the right immediately, with a close control. It no longer depends on Chrome sidePanel.open gesture propagation or tells users to use the toolbar. Only panel.html is web-accessible and only to YouTube origins; settings and keys stay in the extension origin. The toolbar native panel remains available.
- Embedded workspace starts indexing using the existing extension API. Opening the drawer does not grant Chrome tabCapture authorization; do not promise silent audio capture without the browser's required extension invocation.
- Chat source-absence answers can receive a second API call that supplies related general knowledge. Supplement is independently labelled, disallows evidence citations, and explicitly is not SAGE-verified or live web research. Unrelated questions receive no supplement. Trigger depends on source-absence wording; not a calibrated semantic classifier.
- Guarded an observed source-mixing path: visible transcript DOM is reused immediately only when initial player metadata matches the requested video. After SPA navigation, unchanged old transcript text is rejected instead of silently imported under the new title. Existing incorrectly saved sources must be recaptured; this does not rewrite historical records or prove that all source-mixing causes are eliminated.
- 68 unit tests pass, including related-answer provenance and stale transcript regression. Native unpacked integration verifies the actual embedded UI loads from the on-page click and indexing starts, with mocked Groq and a controlled YouTube fixture. Native YouTube PWA and unrestricted production-page compatibility remain unmeasured.
- Final browser integration passes. Native drawer close/reopen checks pass. Built installable 3.0.8 ZIP; reload extension and refresh already-open YouTube tabs once to replace the older injected button.

## 2026-10-14 — v3.0.9 Restore the floating launcher

- Reattach content scripts to existing YouTube video tabs after extension installation/update/reload, independently of opening a workspace panel.
- Launcher maintenance runs every second while the extension context is valid. A removed button is recreated without duplicate buttons, and the launcher is moved into the fullscreen host when appropriate. Higher stacking order avoids ordinary YouTube overlays hiding it. Launcher no longer disappears simply because navigation has no recognized video ID.
- 68 unit tests and packaged MV3 integration pass. Regression removes the actual launcher DOM node, verifies it returns within five seconds with exactly one button, and then exercises drawer opening, closing and reopening. Controlled YouTube fixture rather than a measured production-page acceptance result.

## 2026-10-14 — v3.0.10 Launcher icon

- Replaced platform-dependent pink brain emoji with an inline vector brain mark in the launcher's dark green brand color. Consistent 24px sizing, text alignment, and accessible Open YTMind label. Drawer interaction remains unchanged.
- Built installable 3.0.10 release.

## 2026-10-14 — v3.0.11 Padded brain icons

- Replaced cropped 16/48/128px icons with the complete pink brain silhouette on transparent padding. Generated the padded master using imagegen and resized to manifest icon dimensions. Also updated the user's extracted 3.0.9 icons directory. Built 3.0.11 ZIP; no runtime logic change.

## Working-folder delivery preference

- User requests direct updates to the working app/dist folder. Do not create ZIP releases unless explicitly requested. Rebuild dist after source/assets change and tell user to reload the extension already loaded from that folder.
- Rebuilt dist with 3.0.11 icons; verified all three icon hashes against public source assets.

## 2026-10-14 — v3.0.12 Earlier answers and parallel comparison

- Main answer and independent SAGE answer now start concurrently. The main answer is saved and broadcast immediately when ready, before comparator completion. Panel shows Checking support with unchecked provenance, then final result replaces the same output ID; outside-knowledge processing stays explicitly separate.
- Native drawer, native panel and local workspace refresh on provisional/final output events. Cleared-data generation epoch guards apply to both early and final saves. Resume ignores unfinished drafts.
- 69 unit tests pass, including gated delayed-comparison regression demonstrating early draft delivery before verification. Browser integration passes with mocked API. No measured live-provider speed percentage is claimed; network/rate limits, audio transcription, OCR and full-source batching can still take time.
- Updated working app/dist directly, version 3.0.12; no ZIP created per user preference.

## 2026-10-14 — v3.0.13 Reject fragmented OCR

- Added a conservative text-shape filter alongside engine confidence. High-confidence isolated fragments from the user's report are excluded from evidence; raw OCR remains stored. Retains readable English/Urdu and recognizable code statements, including delimiters within code context. This heuristic can reject very short legitimate labels and does not guarantee semantic OCR accuracy.
- Existing frame OCR is filtered when forming evidence and rendering text, so saved fragments no longer automatically contaminate new answers. Counts distinguish readable frames from snapshots saved; no-text is normal for footage without readable text, not a caption failure.
- Fixed corrupted extension display name to ASCII wording. Source and working dist manifest 3.0.13; reported Chrome version 3.0.11 requires extension Reload to take effect.
- 70 unit tests pass, including high-confidence garbage regression. Working dist rebuilt directly; no ZIP.

## 2026-10-14 — v3.0.14 Remove stale toolbar-opening path

- Legacy OPEN messages now open the in-page drawer through the content script instead of calling sidePanel.open and responding Use the toolbar icon. Current-version launcher tags replace stale pre-update buttons and handlers. Installation/reload actively reinjects current code into existing YouTube video tabs.
- Audio-grant errors describe optional audio activation separately from opening the workspace. User authorization is already given; Chrome tabCapture still requires extension invocation for the target tab, verified against official Chrome documentation. Do not promise user authorization alone bypasses that browser rule.
- Automatic audio fallback is skipped when usable captions already exist, reducing irrelevant audio activation notices. Audio remains available when needed and permitted.
- 70 unit tests pass; native fixture integration covers replacing a simulated stale toolbar-labelled button and drawer open/close/reopen. Updated app/dist 3.0.14 directly without ZIP.

## 2026-10-14 — v3.0.15 Restore rounded workspace appearance

- Removed large green Close YTMind strip. Drawer uses rounded 20px corners, 12px outer spacing, original paper background inside, and a small circular close control beside settings. Existing internal panel design unchanged.
- Native drawer integration passes; saved screenshot visually inspected for header alignment and corner appearance. Updated working dist directly; no ZIP.

## 2026-10-14 — v3.0.16 Enforce English generated prose

- Supplied report was English prose containing untranslated Hindi quotations in concepts/actions. Added post-generation script check for Hindi/Urdu prose; a conditional API rewrite translates those passages before publishing/saving answers. Already-English output incurs no extra request. Source proof text and source code remain unchanged.
- Primary/independent answers and related knowledge supplement use the gate. If rewrite still includes untranslated script, fail explicitly rather than save it silently. This is language enforcement, not a claim of measured translation accuracy.
- 73 unit tests pass, including untranslated quotation, English no-extra-call, code preservation and failed rewrite regression. Working dist updated to 3.0.16; no ZIP. Existing saved reports require regeneration and are not automatically rewritten.

## 2026-10-14 — v3.0.17–3.0.19 Responsive drawer, transcript cleanup, speaking notes

- Drawer left edge supports pointer dragging and keyboard resizing (arrows/Home/End). Expand/restore control, saved preferred width, viewport clamping and compact header prevent controls overlapping on small screens. 320px screenshot inspected; native test exercises real drag, expand/restore and viewport bounds. Browser integration passes.
- Transcript fallback now closes panels it opens in finally, including cancellation/error paths, while leaving an initially expanded user panel alone. Closing the drawer aborts pending caption reads so they do not open transcript UI afterwards. Regression verifies cleanup on an interrupted read.
- Explicitly support questions in Roman Urdu and other languages while retaining the user's English-output preference. Service regression passes Roman Urdu question through the provider with source evidence; this is routing verification, not a multilingual accuracy benchmark.
- Added Generate speaking notes in Notes. Source-grounded natural English script uses the existing API/SAGE path and full-source batches when deep mode is enabled. Stored alongside ordinary notes. Added Read aloud and Stop audio to generated outputs using browser speech synthesis, English voice selection and short utterance chunks. Voice availability/quality depends on browser/system; no downloaded audio file or measured naturalness claim.
- 75 unit tests pass, browser integration passes with mocked provider responses. Working dist 3.0.19 rebuilt directly; no ZIP generated.

## 2026-10-14 — v3.0.20 Shorts capture

- Shorts URLs were parsed already, but transcript capture treated only watch?v= pages as an open player. Uses shared YouTube URL parser for Shorts/watch/live matching and navigation checks, enabling signed live caption requests on Shorts.
- Active Short title/CC controls/player are preferred; real Shorts video without a legacy movie_player no longer waits an unnecessary minute. Removed unverified visible-transcript fallback that could reuse stale SPA source text.
- 76 unit tests pass, including open-Short player captions/title regression. Native fixture test navigates between watch videos and two Shorts, asserting distinct session captions and continued capture. Test fixtures now supply matching player metadata rather than relying on unverified DOM captions.
- Updated working dist to 3.0.20 directly; no ZIP. Missing-caption Shorts still require readable frames or permitted audio capture; this is not a claim that every Short has captions or a production corpus accuracy measurement.

## 2026-10-14 — v3.0.21 Artwork grounding and Urdu retry

- User report attributed the video title to frame text despite source containing only Friday = i Ged. Evidence blocks explicitly label video title as metadata, separately from EXTRACTED SOURCE TEXT; generation policy prohibits treating titles as observed words/lyrics.
- Sparse frame-only evidence returns an honest insufficient-source response for notes/actions/speaking rather than sending a content-summary prompt. Regression confirms the reported fragment cannot become a lyric translation. Short code statements are preserved where recognizable; heuristic is not a general semantic source-sufficiency guarantee.
- Added Re-read in Urdu, selecting local English+Urdu OCR per frame without changing global language preference. Existing accepted text is cleared while retry processes, preventing stale OCR from serving as new evidence.
- Real local OCR experiment used the user's screenshot artwork crop: accepted 16 characters, 11 Urdu-script characters, 12 excluded lines. Decorative Nastaliq artwork remains largely unreadable; do not claim accurate complete transcription. Detailed raw result stays in ignored artifacts/user-artwork-ocr.json.
- 77 unit tests pass. Working dist 3.0.21 rebuilt directly without ZIP. Existing incorrect notes must be regenerated and are not automatically rewritten.

## 2026-10-14 — v3.0.22 Native full-audio fallback

- Connected the native extension to a paired loopback audio helper on 127.0.0.1:4175. Generate on sparse captionless source tries the helper before content generation. It fetches public video audio locally, posts audio directly to Groq ASR, persists timestamped source sections and coverage, then generates the requested output. Does not use the video title or artwork as a substitute for spoken content.
- Helper accepts only same-local-origin requests or the configured extension origin. CORS preflight and health pairing are explicit; tests reject foreign web origins and other extension IDs. Groq keys stay in the extension, never sent to the local helper. Added only loopback-port host/CSP access.
- Started a hidden project helper process for the user's observed unpacked extension ID. Pairing file is ignored. Reboot/process termination requires npm run start:helper; no Windows startup settings were changed.
- Real Uinx1py7Jsg run processed 396 seconds, obtained 38 ASR segments / 893 transcript characters and 1576 English note characters. All six provider calls HTTP200; 77.547 seconds end to end, SAGE uncertain. No human transcription reference or accuracy score. Result metadata tracked in research/results/native-helper-live.json; source audio/transcript/answer remain in ignored artifacts. First English-rewrite failure was corrected with Arabic-aware bounded second-pass rewrite.
- Native UI-to-helper/ASR/notes pipeline passes in a controlled browser test with mocked media and provider responses; real helper/provider smoke is a separate HTTP-based run, not a claim of manual production Chrome acceptance.
- 79 unit tests pass. Native extension integration passes. Working dist updated to 3.0.22 without ZIP.

## 2026-10-14 — v3.0.23 Drawer storage/lifecycle fix

- Reported content.js crash attempted chrome.storage.local access after API namespace became unavailable. Width preference reads/writes now tolerate absent storage and synchronous/asynchronous invalid-context errors, falling back to 460px without blocking drawer opening.
- Launcher ownership uses a per-injection instance ID rather than only version. Same-version reinjection replaces stale onclick closures. Prior current-generation timers, navigation listeners and runtime message listener are disposed when code is reinjected.
- 81 unit tests pass, including missing/invalidated storage reproductions and valid preference persistence. Native regression reinjects current content bundle, verifies instance replacement and one launcher, then exercises drawer and reload reconnection.
- Updated working dist to 3.0.23 without ZIP. User must Reload extension to activate changed injected code.

## 2026-10-14 — v3.0.24 Refresh without losing history

- Opening the drawer creates a fresh workspace document and reads current stored state. Returning to a visible panel refreshes current state without clearing sources/outputs.
- Production SESSION records save automatically; previously stored records are marked saved before cleanup. Saved records no longer expire after 24 hours, including unpinned videos. Existing already-deleted records cannot be reconstructed.
- Library lists all saved video history sorted by most recent visit, and saved notes/answers can be opened there. Output bodies are rendered on demand when a history entry is expanded. Diamond is selection for research, independent of retention.
- Width/storage lifecycle repair from 3.0.23 also passes the final native reinjection/reload regression after retaining both version and instance checks for malformed stale launchers.
- 82 unit tests pass, including old unpinned source/output/frame retention across cleanup and service reopening. Browser integration verifies unpinned history output access; native extension integration passes. Working dist 3.0.24 updated directly without ZIP.

## 2026-10-14 — v3.0.25 Remove storage access from page script

- Repeated report references content.js:606 reading local; current 3.0.24 line 606 is expand-button UI, not storage. Retained error or stale injection does not match current build.
- Moved drawer width preference storage exclusively to background worker. Page script uses a narrow DRAWER_PREFERENCE message and falls back safely when runtime is missing/invalidated. Compiled content.js contains no storage or .local access.
- Background validates YouTube/extension sender, exposes only numeric width, and rejects out-of-range values or foreign origins. No arbitrary storage access or API key exposure.
- 83 unit tests pass, including an accessor trap that would throw if page code touches storage. Working dist 3.0.25 rebuilt directly; no ZIP. Old error entries may remain in Chrome until cleared and old video documents may need one refresh after update.

## 2026-10-14 — Repeated content.js:606 diagnostic

- Read Chrome Profile 1's YTMind entry without modifying the profile. Observed ID iljnghflfclicckiehblmeiomodjpncc and correct loaded path app/dist. Persisted entry did not provide the live loaded version.
- On-disk manifest 3.0.25; content.js contains no storage/.local references. Reported repeated stack does not match current on-disk source. Likely historical error or stale injected page context, but live recurrence is not yet established.
- Desktop computer-use and browser-use initialization both failed with kernel-assets path error. Cannot inspect/clear live Chrome error cards through those tools; did not fabricate a live UI check or modify Chrome profile files.
- Need user to clear old error entries and reproduce from a new YouTube tab after extension reload, confirming live version 3.0.25. No additional speculative code patch or ZIP.

## 2026-10-14 — v3.0.26 Actual helper pairing failure fixed

- User still saw old optional tab-capture notice and insufficient-source result. Real localhost helper was running and configured for the correct extension, but actual native background fetch returned ready:true/paired:false because Chrome omitted Origin on that request.
- Moved all native helper requests out of the YouTube-embedded panel to validated background operations. Proxy only permits fixed loopback media endpoints, strict video/job/index identifiers, bounded audio sizes and byte-preserving transfer. Content pages cannot invoke this privileged helper API.
- Background sends X-YTMind-Extension containing its own runtime ID. Helper accepts the configured ID for originless extension requests while still rejecting foreign web origins even if they send that header. Added regression for this exact mismatch.
- Restarted only the identified project native-helper process with updated code. Real isolated Chrome extension ID iljnghflfclicckiehblmeiomodjpncc now reports ready:true/paired:true through its background worker, not a mocked health request. Native integration also completes the audio-to-notes path using controlled media/provider responses.
- Opening source with ready helper no longer attempts blocked tabCapture or displays the misleading toolbar activation warning. Displays full-video audio availability; clicking Generate starts fetching/transcription and later replaces source status with ASR segment count. Helper failures remain explicit rather than silently regenerating the old insufficient-source answer.
- 86 unit tests and native integration pass. One earlier native run timed out at pre-existing title/focus wait; subsequent full native run passed. This does not claim a newly measured production ASR accuracy result; previous real six-minute audio/provider result remains the live evidence.
- Working dist 3.0.26 rebuilt directly without ZIP. Source history preserved.

## 20 October 2026 — v3.0.27: talk-show and Shorts speech analysis

- Restored tracked project source from GitHub to the original app path after the workspace folder was found missing. No local files overwritten. Ignored configuration, media-tool downloads and API keys are not recovered by Git.
- Added Lab → Analyze talk show / Short. Reports identify institutional criticism, allegations, insults, profanity, possible threats, policy discussion and law references, with English renderings, context, interpreted keywords and timestamped source proof.
- Every retained finding must contain a quotation matching a captured speech excerpt. Frame OCR and title metadata cannot establish spoken claims. Interpretations and translations remain unchecked; criticism is not treated as illegal, and legal descriptions are explicitly unverified speaker claims.
- All captured speech chunks are processed in bounded sections even when Deep mode is off. Snapshot, progress, reports, resume and history use the existing generation pipeline. Frame-only videos request audio rather than substituting OCR for speech.
- Shorts use the existing active-Short caption/navigation handling and shared video identifier/audio/report pipeline. This does not imply full-video audio is available when only live playback fragments were captured.
- Verification: 92 automated tests passed and extension build succeeded. Added forged-quote/frame rejection, law-labeling, Shorts batching, full-section service coverage and cross-instance persistence tests. Browser integration uses mocked provider outputs; real talk-show accuracy has not been measured. See final test update below.
- Updated working app/dist in place; no ZIP created.
- Final browser verification passed in installed Chrome: new discussion report generation and reload persistence, existing workspace workflows, 320px layout and no page errors. Groq responses mocked; browser, IndexedDB and OCR real.

## 20 October 2026 — v3.0.28: general video analysis and Shorts follow

- Correct working checkout: C:\Users\Admin\Documents\projects\Yt_Mind\app. Chrome loads its dist folder; the Desktop copy is secondary.
- Broadened analysis to any video genre, including neutral history, education, devotional and entertainment content. Lab button is now Analyze video / Short. Main ideas, claims, instructions, events and opinions are retained; sensitive speech/laws are additional categories only when present.
- Reports whose generated quotations all fail source matching now fail explicitly rather than saving a misleading empty result. Old reports are preserved in history and need rerunning to use the new analysis.
- While the native workspace is open, each captionless Short automatically starts paired-helper full-audio ingestion after a five-second settling period. Requires configured API key; respects automatic-notes preference; one job at a time; no repeated automatic retries per Short per workspace lifetime.
- Existing automatic Library history remains enabled for all recorded videos and Shorts without pinning. Captured transcript, frames and outputs survive navigation and reopening; pre-install viewing cannot be recovered as source content.
- Verified 96 tests and extension build. Browser integration uses mocked API output, real browser/storage/OCR. Real-video extraction/translation accuracy is not a completed human benchmark.

## 20 October 2026 — v3.0.29: structured analysis request recovery

- Replaced the generic 400 advice with distinct safe messages for JSON-validation failures, unavailable models and context limits. Raw provider messages/source text are not displayed. A JSON-validation failure receives one bounded retry.
- Video analysis uses a strict JSON schema on supported GPT-OSS models, low reasoning effort, and a 6000-token output budget (previously 2400 for all requests). Other models retain JSON-object mode and source-quote validation.
- The exact user's 400 response body was unavailable, so its cause is not established. A direct live request using the locally configured key and default model succeeded, showing that this local model/key combination was available.
- Verified 98 tests, build and a real Groq analysis call on a controlled historical-text fixture: one source-matched key point retained, status unchecked. This is request/integration verification, not real-video accuracy measurement.
