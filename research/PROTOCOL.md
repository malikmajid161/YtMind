# YTMind research protocol

Date: 14 October 2026. Chosen corpus: **English coding and technical tutorials**.

## Research question

Can a browser-based, provenance-preserving tutorial assistant improve useful source coverage and the detection of source discrepancies or missing instructions while keeping inference cost, local resource use and user review effort acceptable?

The hypothesis is about a measured workflow, not the novelty of video RAG, OCR, graphs or multi-agent labels. Do not claim that no other app implements a related feature.

## Related work and implications

- [ALCE: Enabling Large Language Models to Generate Text with Citations](https://arxiv.org/abs/2305.14627) separates fluency, correctness and citation quality. YTMind must measure source support separately from citation existence and interface correctness.
- [VideoRAG: Retrieval-Augmented Generation with Extreme Long-Context Videos](https://arxiv.org/abs/2502.01549) combines cross-video graph grounding with multimodal context. A cross-video graph is prior art; YTMind's proposed emphasis is local tutorial workflows, explicit visual/text disagreement inspection and source-quoted preflight.
- [VideoRAG: Retrieval-Augmented Generation over Video Corpus](https://arxiv.org/abs/2501.05874) uses visual and textual video information for retrieval and generation. OCR-derived text must not be represented as equivalent to direct visual reasoning.
- [LongVideoBench](https://arxiv.org/abs/2407.15754) evaluates reasoning over extended interleaved video/subtitle content. Small controlled screenshots and lexical fixtures do not establish long-video understanding.

These papers inform the protocol; their benchmark scores must not be compared directly with YTMind's different tasks and fixtures.

## Candidate contribution

An inspectable tutorial-learning workflow connecting: timestamped captions and OCR; resumable source snapshots for deep coverage; source-quoted preflight steps; temporal narration–screen comparisons; and claim/evidence review. Exact excerpt validation only proves excerpt existence. It does not validate a paraphrase, classify a real contradiction, or prove a source claim true.

## Corpus design

Collect at least 30 public, rights-appropriate technical videos across JavaScript/React, Python, Git, SQL, containers and browser APIs. Include at least:

- 10 captioned tutorials with exact commands and prerequisites;
- 5 text-heavy/silent tutorials;
- 5 tutorials with small or degraded code text;
- 5 long tutorials with information far from the queried timestamp;
- 5 difficult cases with missing prerequisites, genuine modality/version discrepancies or insufficient evidence.

Content categories may overlap. Record URLs, creator/license/usage basis, access date, duration, caption language/source and any redactions. Preserve the exact evaluated transcript/frame snapshots and checksums; do not redistribute copyrighted full videos without appropriate rights.

Two reviewers annotate commands, prerequisites, important facts, useful frame intervals, readable code, source disagreements and questions with no answer in the source. Resolve disagreements explicitly. Keep a calibration/development split separate from the final held-out test split. The current hand-authored fixtures are not that held-out corpus.

## Systems and ablations

1. Preserved v1 hashed TF/bigram retrieval versus BM25 on identical excerpts.
2. Captions only versus captions+OCR, with both end-to-end and identical-source reasoning evaluations.
3. Quick sampled notes versus every-section deep notes; measure fact recall and cost.
4. Single-worker versus two-worker OCR; measure latency and memory without mixing quality settings.
5. Source-quoted preflight versus general action summarization; evaluate exact commands and fabricated/missing prerequisites.
6. Temporal Evidence Lab versus ordinary video Q&A; evaluate true disagreements, false alarms and OCR-induced artifacts.
7. Generation alone, agreement-only checking, and SAGE claim-to-source checking on the same outputs.
8. Current competitor workflows on the same videos, dates, tiers and output instructions, subject to legitimate access.

## Measurements

- Ingestion success and time to first usable evidence.
- Retrieval top-1, recall@k, MRR, answerable versus unanswerable cases and paraphrase robustness.
- OCR character/word error, command/code exact match and useful-frame recall, by resolution/content type.
- Notes fact coverage, unsupported factual statements, timestamp/citation accuracy and user editing effort.
- Actions command fidelity, prerequisite recall, invented-step rate and step order.
- Evidence Lab discrepancy precision/recall, source-pair accuracy, OCR-confound false alarms and review time.
- SAGE false-supported claims, contradiction/unsupported-claim precision/recall, calibration and marginal cost.
- Graph entity/edge precision, duplicates, provenance completeness and source retrieval.
- Research source coverage, contradiction recall and cross-video answer support.
- p50/p95 latency, cold/warm OCR, peak memory, CPU, playback dropped frames and provider token usage.

Report numerator/denominator and uncertainty, not just rounded percentages. Use paired comparisons when systems share cases. Pre-register primary metrics before evaluating the held-out corpus. Report multiple-comparison limitations and negative results.

## Reproducibility

Commit software/version/model IDs, prompt templates, fixture/corpus metadata, annotation rubric, raw predictions and scoring scripts. Redact credentials. Freeze source snapshots and preserve code commit hashes. Record hardware/browser, provider response dates and rate-limit failures. Run repeated trials for stochastic generation, and document unavailable competitor features or access limitations.

## Current evidence boundary

Engineering tests, controlled OCR and synthetic retrieval experiments are real executions, but they are pilot evidence. Real Groq/SAGE quality, live-video ingestion, competitor comparisons and human discrepancy judgments are not evaluated yet. A publication must not describe those results as established.
