# Critique of the original plans and v1

Reviewed all six supplied Markdown files and v1's installation guide. This critique distinguishes design errors, unproven hypotheses, and missing implementation contracts.

## Requirements contradictions

| Original document        | Problem                                                                                                                                     | Replacement                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRD                      | Says extend v1, while the user's current instruction is a fresh rebuild.                                                                    | Rebuild with reproducible source and preserve history with a tag. Reuse caption-fetching ideas and existing icons.                                                   |
| TRD / milestones 1 and 4 | Global 24h reset conflicts with persistent cross-video memory.                                                                              | Expire unpinned video sessions and their frames; preserve pinned evidence and graph excerpts.                                                                        |
| TRD / milestone 2        | Promises understanding without audio/captions, including diagrams, using OCR and edge density.                                              | Support readable visual text. Separate semantic diagram interpretation into an explicitly evaluated future vision module.                                            |
| Milestone 1              | YouTube-only IndexedDB would isolate data from extension pages; watch-only content-script registration misses navigation from the homepage. | Centralize storage on extension origin; register on all YouTube pages and gate work to watch pages.                                                                  |
| Milestone 2              | Edge density cannot reliably classify talking heads versus slides. Frame similarity also cannot prove semantic duplication.                 | Use heuristics as sampling filters, retain manual capture, evaluate precision/recall against labeled frames.                                                         |
| Milestone 3              | “Full transcript + all OCR” lacks request budgets, long-video coverage, and failure recovery.                                               | Snapshot source chunks; process deep outputs in bounded resumable sections; disclose sampled quick-mode coverage.                                                    |
| Milestone 4              | Arbitrary `node_1` IDs collide across outputs; label-only matching may conflate concepts; provenance dies if sessions expire.               | Normalize labels, validate refs and endpoints, deduplicate edge IDs, retain evidence excerpts with graph records. Semantic entity resolution remains a measured gap. |
| Milestone 5              | Agreement between two answers is labeled Verified; two models can repeat the same unsupported error.                                        | Independent comparison plus claim-to-evidence checks; supported/uncertain/conflicting/unchecked labels with visible limitations.                                     |

## Missing product and engineering requirements

The original plans omit privacy controls for automatic API calls, safe Markdown rendering, API-key boundaries, service-worker lifecycle, CPU profiles, OCR assets under MV3 CSP, queue backpressure, export fidelity, concurrent-tab isolation, source coverage, resumable long jobs, and reproducible installation. They describe research quality without a dataset, competing baselines, or metrics.

The replacement establishes explicit capture, automatic generation opt-in, trusted key storage, local OCR assets, bounded frame queues, per-video identifiers on every message, safe rendering, and behavioral tests. Deep section snapshots remain local. CPU performance is configurable rather than imposing a low-end design on a capable machine.

## V1 assessment

Useful assets: multiple caption fetch strategies, handling YouTube SPA navigation, Groq integration ideas, and extension icons. These informed the rebuild.

Replacement was warranted because v1 had a committed content bundle without a package manifest/build pipeline, overlapping agent naming, extensive permissions, and fragmented lifecycle/storage behavior. Its global reset attempted to delete a database that also stored persistent concepts. One error path called `this._friendlyError` despite being inside a free function, where `this` is not the helper owner. These are concrete defects rather than reasons to abandon the product idea.

## Research honesty

Neither “CPU only,” multi-agent naming, citations, nor a graph establishes a research contribution. Research claims need controlled comparisons and ablations: captions only versus captions+OCR, heuristic versus OCR deduplication, lexical versus semantic retrieval, and generation versus generation+SAGE. See the competitor benchmark plan for measurable targets. Superiority remains an objective, not a reported result.
