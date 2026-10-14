# Module-by-module competitive plan

Reviewed 13 October 2026. The user's objective is to improve against competitors across every module, with efficient use of a capable machine. This is an expanding benchmark set, not a claim that every product on the market has been identified or beaten.

## Documented reference capabilities

Official sources describe product capabilities; their marketing claims are not independent quality measurements. Missing documentation does not prove that a competitor lacks a feature.

| Competitor                                                                                      | Relevant documented capabilities                                                                      | What YTMind must learn from it                                                                                |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Eightify](https://eightify.app/)                                                               | Timestamped summaries, transcription, multilingual summaries, comment overview and sharing            | Fast time-to-value, intuitive source navigation and polished summaries                                        |
| [Glasp](https://glasp.co/youtube-summary)                                                       | YouTube transcript/summary beside video, model choices, highlighting and note-app exports             | Strong capture-to-highlight-to-export workflow; timestamps are table stakes                                   |
| [NotebookLM / Gemini Notebook](https://support.google.com/gemininotebook/answer/16215270?hl=en) | Multiple source types, source-based answers, research; documented YouTube import is caption text only | Source selection, comparative research and source discipline; visual frame evidence is a separate opportunity |
| [Recall](https://www.recall.it/)                                                                | Connected knowledge graph, knowledge-base chat, quizzes, spaced repetition and Markdown export        | Connected memory is already competitive territory; a decorative graph does not establish an advantage         |
| [NoteGPT](https://notegpt.io/youtube-video-summarizer)                                          | Long/batch video summaries, no-subtitle processing claims, translation and customizable summaries     | Long-source coverage, batch workflows and personalization must be evaluated                                   |
| [YouLearn](https://www.youlearn.ai/)                                                            | Referenced answers, summaries, quizzes, personalized exams and AI tutoring from learning materials    | Understanding and retention matter beyond generating notes                                                    |
| [Readwise Reader](https://readwise.io/read)                                                     | YouTube transcript highlighting, annotations, resurfacing and export integrations                     | Retrieval of saved ideas, editing and integrations are product essentials                                     |

## Module comparison and improvement contracts

| Module                  | Reference products/baselines                         | Implemented in this rebuild                                                                     | Required improvement and win condition                                                                                                               |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingestion               | Glasp, NoteGPT, Eightify                             | Visible/signed/end-point captions; manual fallback; video isolation                             | Higher reliable-source rate on the fixed corpus; evaluate audio fallback, language selection and playlist ingestion                                  |
| Visual evidence         | Caption-only baseline; manually transcribed slides   | Local English/Urdu OCR, timestamps, change filtering, two worker slots, high-resolution profile | Useful-frame recall, code exactness and low OCR error on code/math/slides; diagram interpretation requires a dedicated model and evidence evaluation |
| Notes                   | Eightify, Glasp, NoteGPT                             | Deep section coverage, snapshots, resume and citations                                          | Better key-fact coverage at equal latency/cost; chapter synthesis, editable notes and configurable output depth                                      |
| Action extraction       | General summaries versus manual tutorial checklist   | Source-ordered actions, literal command policy and SAGE                                         | Lower invented-step rate, better prerequisite/command recall; structured checklists and dependencies                                                 |
| Q&A                     | NotebookLM, YouLearn, Recall                         | BM25 context, source timestamps and safe rendering                                              | Higher answerable-question accuracy and unanswerable abstention; hybrid semantic retrieval and conversation state                                    |
| Memory graph            | Recall                                               | Stable label IDs, evidence-backed edges, persistent excerpts, search                            | Better entity/edge precision and lower duplicate rate; semantic entity resolution, aliases and scalable graph UX                                     |
| Research                | NotebookLM, Recall                                   | Pinned sources, diversified retrieval and cited synthesis                                       | Better cross-source coverage and contradiction recall; exhaustive comparative mode and collection-level research                                     |
| SAGE                    | Generation alone; independent-answer agreement alone | Source-based claim check, validated refs and honest statuses                                    | Better unsupported-claim/contradiction detection with measured false alarms and incremental latency/cost                                             |
| Learning assessment     | YouLearn, Recall, Readwise                           | Follow-up exploration questions                                                                 | Grounded quizzes/flashcards, personalized review and measured learning retention; not implemented yet                                                |
| Editing and portability | Glasp, Readwise, Recall                              | Copy, Markdown, browser PDF and graph JSON                                                      | Editable annotations, source corrections, backup/import and integrations with preserved provenance                                                   |
| Reliability             | Same workload under simulated failures               | Bounded queues, expiry rules, serial writes, key isolation, partial-output persistence          | Zero cross-video contamination in regression suite; recoverable quota/provider/OCR failures; lifecycle stress tests                                  |
| Performance             | Captions-only and single-worker baselines            | Configurable resolution/worker count; backpressure; section-level generation                    | Measured p50/p95 latency, peak memory, playback impact and cost per useful output; optimize without losing coverage                                  |
| Experience              | Each product's actual task completion flow           | Native six-tab workspace, timestamp navigation, graph keyboard access                           | Faster task completion and fewer recovery dead ends in observed user tasks                                                                           |

## Fair benchmark protocol

Start with a fixed, rights-appropriate corpus of at least 30 videos: captioned lectures, captionless text-heavy slides, code tutorials, mathematics, noisy/low-resolution content, multilingual material, long videos and videos with insufficient evidence. Add at least 10 related-video groups with genuine agreements/disagreements. Annotate key facts, exact commands, timestamps, useful visual frames and graph relations before comparing outputs.

Use equivalent inputs and requested output depth. Keep two evaluations distinct: end-to-end ingestion + reasoning, and reasoning on identical supplied evidence. Otherwise ingestion failures can be confused with reasoning quality. Record date, product tier, selected model, settings, API usage, hardware, browser and raw outputs.

Evaluate with blinded human judgments where feasible. Report sample size and uncertainty. Use the same rubric for YTMind and competitors. Public feature claims are not benchmark results; do not invent unavailable competitor scores.

## Metrics and target gates

These are proposed product gates, not achieved measurements:

- Citation validity: 100% of refs resolve; separately judge whether the evidence supports the claim.
- Critical commands: zero invented destructive commands; report exact-match and prerequisite recall.
- Notes: at least 90% annotated key-fact coverage with unsupported-fact rate below 2% on the selected corpus.
- Frames: at least 90% useful text-frame recall; report OCR character error and code exact-match by content type.
- Graph: at least 90% evaluated edge precision and under 5% duplicate concept rate.
- SAGE: measure precision/recall on unsupported and contradicted claims; avoid one blended score hiding failure types.
- Research: source coverage, citation support, contradiction recall and omission rate.
- Reliability: no cross-video result contamination; no stale write resurrection after clear-data tests.
- Performance: compare quality-adjusted latency/cost and record memory/playback impact on the user's hardware. Do not impose unmeasured universal timing promises.

## Ablations

Compare captions only versus captions+OCR; single versus two-worker OCR; quick versus deep notes; BM25 versus a future hybrid retriever; generation alone versus SAGE; agreement-only verification versus claim-to-source checking; normalized-label graph merging versus future semantic entity resolution.

## Next priorities

1. Validate the packaged runtime and live caption/provider paths, then collect real evidence benchmarks.
2. Improve source inspection/editing, code OCR and retrieval recall; these affect every downstream module.
3. Add structured actions, final chapter synthesis, semantic entity resolution and exhaustive comparative research.
4. Add grounded quizzes/review, collections and integrations with measurable user value.

No release should describe the entire competitive program as complete merely because the extension loads or unit tests pass.
