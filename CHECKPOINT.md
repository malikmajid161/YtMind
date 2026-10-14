# YTMind resume checkpoint

Saved 14 October 2026 (Asia/Karachi). Resumed after the requested usage-limit checkpoint. Continue from the current code, not from scratch.

## Code and location

Repository: C:/Users/Admin/Desktop/Yt_Mind/app
Remote: https://github.com/malikmajid161/YtMind
First rebuild pushed: 591e704434953af5d0676d4bc845a9ce0f4cfe03. Original version preserved by tag v1-before-rebuild. This checkpoint commit saves the subsequent working browser workspace, service refactor, caption changes, tests and raw observations. Use git log -1 for its final commit ID.

## Working application

Seven modules: Notes, Ask, Actions, Graph, Frames, Library and Evidence Lab. Includes source-linked answers, independent model verification, deep generation with pause/continue, local OCR, source proof views, pins, retention, exports and model discovery.

Both native MV3 extension and browser workspace use the shared src/service.js. Browser workspace accepts pasted transcripts and uploaded timestamped frames; automatic YouTube capture uses the extension.

From the app directory:

```powershell
npm run check
npm start
```

Open http://127.0.0.1:4173/panel.html?studio. The built extension is in dist; load it through chrome://extensions. Run npm start to launch the local application server.

## Verification at pause

- 35 core tests passed and build passed.
- Packaged native MV3 smoke passed with controlled YouTube fixture, service worker, IndexedDB, generation/verification mocks and local OCR.
- Browser UI and local workspace integration passed, including persistence, seven tabs and print/PDF layout.
- Real Groq browser workspace completed eight workflows with 15 POST requests, all HTTP 200. Raw observations: research/results/live-studio.json. This is integration evidence on one authored source, not an accuracy benchmark.
- Previous extension failure was invalid worker-src blob CSP. Corrected to worker-src self. Earlier administrator-policy diagnosis was incorrect and has been corrected.
- Production dependency audit previously reported zero vulnerabilities.

## Unresolved live-source issue

Latest live YouTube probe captured one frame but zero caption segments. Caption status unavailable; title refresh is now fixed and verified as React in 100 Seconds. See research/results/youtube-live.json and retained earlier probes. Automatic captions are NOT established as reliable. Manual transcripts work.

## Research state

Corpus direction: English coding and technical tutorials. Protocol, annotation rubric, competitor matrix, references and preliminary manuscript exist. BM25 top-1 27/32 versus v1 26/32; v1 has higher recall@3; paired p=1.0 gives no reliable superiority. Synthetic OCR exact match 7/8 with a meaningful code-symbol error. Eight real Groq pilot cases executed with one verification-label mismatch. Preserve all negative results. Real held-out tutorials, human labels, repeated trials, ablations and legitimate competitor comparisons remain necessary before publication.

## Secrets and local assets

Credentials exist only in ignored .env.local; never print or commit them. Previously pasted credentials should be rotated. dist, node_modules, artifacts and browser profiles are ignored. Run npm run check:secrets after staging. No Windows settings were modified.

## Resume priorities

1. Check latest CI if changes are made. Checkpoint CI 38502652001 passed; earlier run 38456924278 failed on CSP before the fix.
2. Fix actual YouTube caption readiness/fallback; title refresh is fixed; rerun a live probe while retaining previous observations.
3. Review service/capture lifecycle and cross-tab races, then run meaningful regression checks for fixes.
4. Refresh remaining documentation, review final diff and package installable ZIP/release.
5. Expand real tutorial evaluation with human annotation and competitor comparisons; revise the paper from measured results.

Useful checks:

```powershell
$env:TEST_BROWSER_EXE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:ui
npm run test:ocr
$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\Admin\Desktop\Yt_Mind\app\artifacts\browsers'
npm run test:extension
npm run research:retrieval
npm run research:report
```

Optional live tests skip when their result files already exist. Preserve old observations before deliberately rerunning; do not treat skipped live tests as fresh success. Checkpoint CI run 38502652001 passed all checks, including packaged extension, UI and OCR. Subsequent changes require their own CI check.

## Resume update

Checkpoint commit 07a4034 was pushed and CI run 38502652001 passed. Subsequent live probes verified the corrected video title but still found zero caption segments and one captured frame. YouTube returned empty caption responses and HTTP 400 for get_transcript; the rendered transcript panel was empty. New regressions cover signed caption URL preservation and restoring temporary CC state on cancelled navigation. All 35 core tests pass. Prior observations remain saved separately.

## Local delivery

The working app can be started with npm start and opened at http://127.0.0.1:4173/panel.html?studio. The latest local extension package is artifacts/releases/ytmind-v3-unpacked.zip (ignored build output). Extract it into a folder, enable Developer mode at chrome://extensions, and select that folder using Load unpacked. Keys are configured in Settings and are not included in the ZIP. Automatic caption failure has a manual transcript fallback; live caption reliability remains unfinished.

## Push checkpoint — 14 October 2026

The working browser app and unpacked MV3 extension are being pushed with audio/subtitle imports, Urdu OCR, URL audio retrieval, lecture batching, code-file export, source auditing and bounded API retries. Notes and Actions persist to IndexedDB. The automatic YouTube caption bug is NOT fixed: a direct YouTube UI get_transcript request returned HTTP 400 FAILED_PRECONDITION. Keep this separate from successful ASR fallback observations.

The user will manually test five video types and fill claim judgments. Evaluation export files and automatic full-context extension intake are still pending work. Scrubbing paused moments also needs an explicit capture-on-seek path before this protocol can be declared ready.

### Caption diagnosis, 14 October 2026

Plain Chrome without the extension reproduced YouTube HTTP 400 FAILED_PRECONDITION and a visible bot-confirmation challenge. Updated production capture code evaluated on the real page correctly returned blocked (zero source segments, no audio fallback). Loaded-page metadata reuse and saved-caption retention regressions pass. Live caption success remains unverified; do not claim the bug fully fixed. User requested debugging before pushing, so current changes remain local.

Side-panel fix: Chrome native toolbar behavior enabled; side-panel startup activates indexing. 51 unit tests passed; actual content-button click created SIDE_PANEL context and activated capture in packaged integration. dist/ and ZIP rebuilt. User must reload the loaded extension and YouTube tab to pick up code changes.

14 Oct reconnection: tested extension reload/re-enable with existing YouTube tab and recovered content listener without video refresh. 55 tests passed; audio errors are persistent; matching capture stream no longer restarts on duplicate start. Rebuilt dist and ZIP. User must reload extension once to obtain new scripting permission/reconnection code. Current kalam native audio still requires real user playback validation.

v3.0.1 checkpoint: same-document sender.url retained old ID, causing new SESSION rejection. Live tab URL validation fixed it. Packaged A/B/C/A transitions preserve capture and save correctly without reload. 59 tests + browser integration passed. Offscreen startup ready handshake, caption fast path/accessibility label cleanup and citation normalization included. Specific user video FhMFEq6_G-k full-audio browser pipeline passed in 32.8 seconds with four HTTP 200 calls; native audio remains separately unverified. Reload extension once, then confirm header /03.0.1. On-page brain opens panel. Past saved notes do not automatically rewrite themselves.

v3.0.2: fixed OCR CSP data: WASM fetch by using plain JS loaders plus same-origin binary WASM. SIMD detected and portable fallback packaged. Strict CSP unchanged. 59 unit tests; native packaged OCR; English 7/8; authored Urdu exact/91; all passed with zero external OCR requests. User should see /03.0.2 after one extension reload.

v3.0.3 fixes disappearing Ask input on background redraws by retaining the connected form node and tracking per-video in-memory drafts across tab changes. Real browser regression checks focus, text, continued typing and tab return after an IndexedDB update. 59 core tests and browser checks passed. Drafts do not persist through a full panel reload.

v3.0.4: user confirms frames/captions working. Fixed stale no-source notices and introduced deterministic source-modality downgrade for caption/transcript claims backed only by frame OCR. 60 tests + browser integration passed. Stored old notes remain historical; regenerate for new audit. Human accuracy, captionless native audio and five-video evaluation remain pending.

v3.0.5: added input size guard (<3px), classified only known tiny-line diagnostics as informational, preserved unknown warnings/aborts. Sparse segmentation trial degraded code OCR and was rejected, with results retained. 61 unit tests, English 7/8, Urdu fixture exact/91, packaged extension passed. User frame readability remains unmeasured; no fabricated OCR. Reload once and confirm /03.0.5.
