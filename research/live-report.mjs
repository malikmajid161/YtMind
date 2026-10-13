import { readFile, writeFile } from "node:fs/promises";
const report = JSON.parse(
  await readFile("research/results/groq-live-controlled.json", "utf8"),
);
const completed = report.results.filter((r) => r.status === "completed");
const tokens = report.requests.reduce(
  (sum, r) => sum + (r.usage?.total_tokens || 0),
  0,
);
const rows = report.results
  .map(
    (r) =>
      `| ${r.id} | ${r.status} | ${r.output?.verification?.status || "—"} | ${r.checks?.expectedVerdict === false ? "Expected verdict mismatch" : r.status === "failed" ? r.error : "Automated string/ref checks passed; human review pending"} |`,
  )
  .join("\n");
const text = `# Real Groq pilot

Recorded ${report.date}. This experiment made real provider requests using **controlled, hand-authored source excerpts**. It is not a live-video or competitor benchmark.

Generation model: ${report.models.generation}. Comparison/checking model: ${report.models.verification}. Both final models belong to the GPT-OSS family; model errors may be correlated. The source-based comparator is therefore essential, and this pilot does not establish model independence.

${completed.length}/${report.results.length} cases completed; ${report.requestCount} provider requests; ${tokens} reported total tokens. Case checks verify specified strings, citation IDs or expected labels. They are not automatic factual-quality scores.

| Case | Execution | Verification label | Observation |
| --- | --- | --- | --- |
${rows}

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
`;
await writeFile("research/LIVE_PILOT.md", text);
console.log("Generated research/LIVE_PILOT.md from actual provider records.");
