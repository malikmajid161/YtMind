# YTMind resume checkpoint

Saved 14 October 2026 (Asia/Karachi). Paused at the user's request due usage limits. Resume from this checkpoint, not from scratch.

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

Open http://127.0.0.1:4173/panel.html?studio. The built extension is in dist; load it through chrome://extensions. No application server is currently running.

## Verification at pause

- 33 core tests passed and build passed.
- Packaged native MV3 smoke passed with controlled YouTube fixture, service worker, IndexedDB, generation/verification mocks and local OCR.
- Browser UI and local workspace integration passed, including persistence, seven tabs and print/PDF layout.
- Real Groq browser workspace completed eight workflows with 15 POST requests, all HTTP 200. Raw observations: research/results/live-studio.json. This is integration evidence on one authored source, not an accuracy benchmark.
- Previous extension failure was invalid worker-src blob CSP. Corrected to worker-src self. Earlier administrator-policy diagnosis was incorrect and has been corrected.
- Production dependency audit previously reported zero vulnerabilities.

## Unresolved live-source issue

Latest live YouTube probe captured one frame but zero caption segments. Caption status unavailable; title remained YouTube rather than the video title. See research/results/youtube-live.json and retained earlier probes. Automatic captions are NOT established as reliable. Manual transcripts work.

## Research state

Corpus direction: English coding and technical tutorials. Protocol, annotation rubric, competitor matrix, references and preliminary manuscript exist. BM25 top-1 27/32 versus v1 26/32; v1 has higher recall@3; paired p=1.0 gives no reliable superiority. Synthetic OCR exact match 7/8 with a meaningful code-symbol error. Eight real Groq pilot cases executed with one verification-label mismatch. Preserve all negative results. Real held-out tutorials, human labels, repeated trials, ablations and legitimate competitor comparisons remain necessary before publication.

## Secrets and local assets

Credentials exist only in ignored .env.local; never print or commit them. Previously pasted credentials should be rotated. dist, node_modules, artifacts and browser profiles are ignored. Run npm run check:secrets after staging. No Windows settings were modified.

## Resume priorities

1. Inspect GitHub CI for this checkpoint; earlier run 38456924278 failed on CSP before the local fix.
2. Fix actual YouTube caption readiness/fallback and title refresh; rerun a live probe while retaining previous observations.
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

Optional live tests skip when their result files already exist. Preserve old observations before deliberately rerunning; do not treat skipped live tests as fresh success. Remote CI status after checkpoint push is pending inspection.
