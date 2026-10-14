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
