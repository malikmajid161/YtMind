# Technical tutorial annotation rubric

Use this rubric before evaluating the held-out video corpus. Keep reviewers blind to the system identity when scoring predictions.

## Source annotations

For each item record video ID, start/end time, modality, exact excerpt, readable frame reference, and uncertainty. Distinguish uploaded captions, ASR captions, manual text and OCR. An unreadable symbol is uncertain; do not silently infer the intended code.

| Item           | Positive annotation                                                    | Exclusions                                                                          |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Key fact       | A proposition explicitly stated or visibly demonstrated                | General domain knowledge supplied by the reviewer                                   |
| Action         | A concrete instructed step supported by an excerpt                     | A plausible next step absent from the tutorial                                      |
| Command        | Exact readable command string, preserving options/punctuation          | “Corrected” or reconstructed commands                                               |
| Prerequisite   | Explicit environment/tool/version/access requirement                   | Requirements inferred from external experience                                      |
| Missing detail | A task-critical unknown in the evaluated source scope                  | Claims that missing sampled evidence proves whole-video absence                     |
| Discrepancy    | Same referent/context with meaningfully incompatible source statements | Different stages/versions intentionally contrasted, OCR artifacts, ambiguous timing |
| Source support | Citation contains evidence supporting the claim's meaning              | A citation merely mentioning the topic                                              |

## Prediction judgments

Score each factual claim as supported, contradicted, insufficient evidence or non-factual suggestion. Record valid citation IDs separately. For code/actions, report exact match and semantic judgment separately: executable-looking code is not proof of source fidelity. Identify missing critical prerequisites and invented destructive commands independently of overall helpfulness.

For narration–screen findings, confirm both source excerpts, the temporal/referent alignment, and whether the disagreement survives inspection of the original frame. Report false alarms caused by OCR. Exact quote validation is a software gate, not a human contradiction judgment.

## Agreement and adjudication

Two independent reviewers label at least a shared calibration subset and the final primary-evaluation subset. Report agreement and the count/types of disagreements. Adjudicate using the original source; retain both initial labels and the resolved label. Freeze final test annotations before inspecting competing outputs. Store assumptions and exclusions in the corpus metadata.
