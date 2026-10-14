# Validation record

Updated 14 October 2026. Executed results are distinguished from unmeasured claims.

| Check                   | Result                                                     | Evidence scope                                                                                                               |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Core tests              | 35 passed                                                  | Retention, source/version identity, chunking, citation variants, key boundary, stale writes, provider failures, quote checks |
| Unpacked build          | Passed                                                     | Reproducible source, manifest and local OCR assets                                                                           |
| Browser UI              | Passed                                                     | Seven tabs, graph search, proof view, settings and 320px layout; no page errors                                              |
| Local OCR               | 7/8 exact; two-worker smoke passed; zero external requests | Synthetic English canvas images under comparable CSP                                                                         |
| Packaged extension      | Locally passed                                             | Controlled native smoke passed after worker CSP fix; live captions remain unresolved                                         |
| Retrieval               | BM25 27/32 top-1; v1 26/32, with higher recall@3           | Controlled authored excerpts; no reliable superiority claim                                                                  |
| Real Groq pilot         | 8/8 executed; one expected-label mismatch                  | Real requests on synthetic evidence, not human factual-accuracy scores                                                       |
| Live videos/competitors | Not benchmarked                                            | Representative live capture and competitor comparisons remain                                                                |

OCR misread useState(0) as useState(®). Retrieval challenge cases expose paraphrase failures. SAGE labeled an unsupported flag conflicting rather than uncertain. Initial model-404 and verifier-429 failures remain in the record. Current defaults were updated after account discovery; model availability does not guarantee quota.

See research/PILOT_RESULTS.md, research/LIVE_PILOT.md and raw JSON results. These are pilot observations, not publication-ready evidence.

## Repeat checks

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:ui
npm run test:ocr
npm run test:extension
npm run research:retrieval
npm run research:report
npm run research:live
npm run research:live-report
```

Real provider tests need an ignored .env.local key. Browser checks may need approved execution outside the sandbox. TEST_BROWSER_EXE can choose an installed browser for UI/OCR. Full extension testing requires policy permitting unpacked extensions; do not bypass administrator policy. CI runs the packaged checks on an isolated runner and preserves artifacts.

## Reliability and release discipline

YouTube DOM/endpoints, provider models/quotas, storage and scheduling change. No never-break guarantee is made. Relevant behavior checks, reproducible builds, honest runtime records and recoverable failures are release gates. Failed verification stays unchecked; partial deep output stays visibly partial; in-flight results cannot resurrect cleared data. Keys are ignored locally and checked against tracked files before committing.

Publication still requires a held-out real tutorial corpus, independent human annotation, repeated model trials, memory/playback profiling and legitimate competitor comparisons. The paper outline preserves those gaps.
