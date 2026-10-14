# YTMind: An Auditable Browser Workflow for Learning from Technical Video Evidence

**Working manuscript outline — not ready for submission.** Results are preliminary controlled pilots. Author names, venue, real-video corpus and human evaluation remain to be added. No unsupported claim of universal novelty or superiority is made.

## Abstract draft

Technical video learners need more than short summaries: they must recover exact commands, identify prerequisites, inspect visible code and reconcile conflicting source statements. YTMind implements a browser workflow that connects timestamped captions and local OCR with resumable study-note generation, source-quoted tutorial preflight, temporal narration–screen comparison and inspectable claim support. A pilot on 32 hand-authored retrieval queries found top-1 accuracy of 27/32 for BM25 versus 26/32 for the preserved v1 retriever, while v1 retained better recall@3. Local OCR exactly matched 7/8 synthetic text images but misread one code symbol. A real-provider pilot completed eight controlled source cases and exposed a verification label error. These results establish feasibility and identify failure modes; they do not establish real-video superiority. A fixed technical-tutorial corpus and blinded human evaluations are proposed for confirmatory testing.

## 1. Motivation and scope

Summaries can omit task-critical commands or prerequisites. Caption text can differ from visible code, and small OCR errors can turn plausible-looking snippets into unusable instructions. The target workflow is English coding/technical tutorial study in the browser, with explicit source provenance and local capture. It is not general visual understanding, guaranteed code reconstruction or independent fact checking.

## 2. Related work

[ALCE](https://arxiv.org/abs/2305.14627) motivates separating citation quality from factual correctness. [VideoRAG with long-context videos](https://arxiv.org/abs/2502.01549) and [VideoRAG over a video corpus](https://arxiv.org/abs/2501.05874) establish multimodal retrieval and cross-video knowledge grounding as prior work. [LongVideoBench](https://arxiv.org/abs/2407.15754) illustrates the difficulty of extended temporal reasoning. The product comparison in `docs/COMPETITORS.md` identifies existing summary, tutoring, memory, annotation and research workflows. YTMind's proposed contribution is an inspectable tutorial-evidence workflow and its evaluation, not the invention of OCR, RAG or knowledge graphs.

## 3. System

The extension uses a content script for video identity, timestamps, captions and canvas capture; an extension-origin service worker for IndexedDB and provider access; and a native side panel for interaction and local OCR. Source text is sent to Groq for explicit generation requests; images remain local. Bounded frame queues and selectable OCR worker counts control resource use.

Deep outputs snapshot captured sources and process bounded sections, preserving partial progress and citation remapping. A preflight module retains commands and supporting excerpts only when they match selected source text. Evidence Lab pairs nearby caption/OCR chunks and labels model interpretations as hypotheses. SAGE compares an independent generated answer with the original and checks claims against source excerpts; missing/invalid verification remains unchecked.

## 4. Evaluation methods

Separate software correctness, controlled component pilots and held-out end-to-end research. Use identical evidence for reasoning comparisons, and separate ingestion quality from reasoning quality. The full plan is specified in [PROTOCOL.md](PROTOCOL.md) and the source annotation rules in [ANNOTATION_RUBRIC.md](ANNOTATION_RUBRIC.md). Record software/prompt/model versions, hardware, raw predictions, token usage, temporal/source identities and provider failures. Reviewers should be blind to system identity.

## 5. Pilot observations

See [controlled results](PILOT_RESULTS.md) and [real Groq pilot](LIVE_PILOT.md) for reproducible measurements and raw data. The small retrieval difference is not statistically reliable; lexical challenge cases remain difficult. OCR's aggregate character error hides an important code-symbol failure. Real-provider source checks show useful behavior on simple examples but include a label-boundary error and a generic preflight question. Initial unavailable-model and rate-limit failures are retained in the record.

## 6. Required confirmatory experiments

Use at least 30 rights-appropriate real tutorials with annotated commands, code, prerequisites, source discrepancies and insufficient-evidence questions. Compare caption-only/visual evidence, quick/deep processing, lexical/hybrid retrieval, generation/SAGE, and preflight/general actions. Measure accuracy, coverage, error detection, false alarms, review effort, latency, cost, memory and playback impact. Obtain legitimate competitor outputs on the same tasks; unavailable access must be documented. Do not reuse development fixtures as held-out evidence.

## 7. Limitations and research integrity

The current results use authored fixtures and one stochastic provider run. Exact quote matching validates excerpt existence, not its interpretation. Bundled OCR now supports English and Urdu, but only small controlled fixtures have been measured and it cannot guarantee symbols or diagrams. Lexical retrieval misses paraphrases. Comparison models in the final pilot share a family. The packaged extension smoke passed after a worker CSP correction; a live YouTube probe still returned zero caption segments. Controlled runtime checks do not establish live-source reliability. No claims of hallucination elimination, never-breaking software, universal novelty or market superiority are supported.

## 8. Availability

Release source, fixed prompts, evaluation scripts, fixture metadata, raw predictions and scoring procedures with the paper. Exclude API keys and restrict redistribution of source content to appropriate rights. Complete independent human annotation and real-video measurements before submission.

## References

Bibliographic entries are preserved in [references.bib](references.bib). Verify publication metadata and venue formatting before finalizing the manuscript.
