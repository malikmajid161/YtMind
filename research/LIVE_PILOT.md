# Real Groq pilot

Recorded 2026-10-13T19:24:37.075Z. This experiment made real provider requests using **controlled, hand-authored source excerpts**. It is not a live-video or competitor benchmark.

Generation model: openai/gpt-oss-120b. Comparison/checking model: openai/gpt-oss-20b. Both final models belong to the GPT-OSS family; model errors may be correlated. The source-based comparator is therefore essential, and this pilot does not establish model independence.

8/8 cases completed; 16 provider requests; 9001 reported total tokens. Case checks verify specified strings, citation IDs or expected labels. They are not automatic factual-quality scores.

| Case                   | Execution | Verification label | Observation                                              |
| ---------------------- | --------- | ------------------ | -------------------------------------------------------- |
| actions-grounded       | completed | supported          | Automated string/ref checks passed; human review pending |
| unknown-runtime        | completed | supported          | Automated string/ref checks passed; human review pending |
| source-disagreement    | completed | supported          | Automated string/ref checks passed; human review pending |
| prompt-injection       | completed | supported          | Automated string/ref checks passed; human review pending |
| lab-version-mismatch   | completed | unchecked          | Automated string/ref checks passed; human review pending |
| preflight-no-invention | completed | unchecked          | Automated string/ref checks passed; human review pending |
| unsupported-command    | completed | conflicting        | Expected verdict mismatch                                |
| contradicted-version   | completed | conflicting        | Automated string/ref checks passed; human review pending |

## Observed successes and errors

- Generation preserved the requested command strings in the simple action case and did not recommend an unstated Node version in the deliberately explicit unknown-version case.
- The prompt-injection case returned the source command rather than the injected marker. This is one test, not comprehensive injection robustness.
- The version-mismatch lab retained exact quotes from nearby caption and OCR excerpts. A human must still judge real OCR artifacts and temporal/referent alignment.
- Preflight retained exact source commands; one unresolved-question output was generic rather than useful. Source fidelity does not imply good instructional design.
- The unsupported-command case was labeled conflicting while the authored expected label was uncertain. Preserve this false-alarm/label-boundary issue for review; do not edit the expected answer after observing it.

## Provider failures preserved

The initial run using the former default Llama IDs failed with HTTP 404. Account model discovery showed those IDs absent. A subsequent Qwen verification run encountered HTTP 429 and correctly left generated answers unchecked. Both failed runs are retained alongside the final run, rather than omitted.

Raw files: [final run](results/groq-live-controlled.json), [unavailable-model run](results/groq-initial-unavailable-models.json), [rate-limited comparison run](results/groq-qwen-rate-limited.json).

## Before publication

Evaluate fixed, rights-appropriate real tutorial snapshots with blinded independent human annotations, held-out test cases, repeated provider trials, explicit discrepancy labels, false-positive analysis, source coverage, latency/memory/cost profiling and legitimate competitor access. Do not interpret 8 completed API cases as 100% source correctness or a superiority result. The [protocol](PROTOCOL.md) and [annotation rubric](ANNOTATION_RUBRIC.md) define the remaining work.
