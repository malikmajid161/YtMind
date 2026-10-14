import { readFile, writeFile } from "node:fs/promises";
const retrieval = JSON.parse(
  await readFile("research/results/retrieval-controlled.json", "utf8"),
);
const ocr = JSON.parse(
  await readFile("research/results/ocr-controlled.json", "utf8"),
);
const pct = (n) => (n * 100).toFixed(1) + "%";
function wilson(successes, n) {
  const z = 1.96,
    p = successes / n,
    denom = 1 + (z * z) / n,
    center = (p + (z * z) / (2 * n)) / denom,
    half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return `${pct(center - half)}–${pct(center + half)}`;
}
const row = (name, metrics, rows, key) => {
  const wins = rows.filter((r) => r[key].top1).length;
  return `| ${name} | ${wins}/${rows.length} | ${pct(metrics.top1Accuracy)} | ${wilson(wins, rows.length)} | ${pct(metrics.recallAt3)} | ${metrics.meanReciprocalRank.toFixed(3)} |`;
};
const b = retrieval.rows.filter((r) => r.bm25.top1 && !r.v1.top1).length,
  c = retrieval.rows.filter((r) => !r.bm25.top1 && r.v1.top1).length,
  n = b + c;
const choose = (n, k) => {
  let value = 1;
  for (let i = 1; i <= k; i++) value = (value * (n - i + 1)) / i;
  return value;
};
let p = 1;
if (n) {
  p = Math.min(
    1,
    (2 *
      Array.from({ length: Math.min(b, c) + 1 }, (_, i) => choose(n, i)).reduce(
        (a, v) => a + v,
        0,
      )) /
      2 ** n,
  );
}
const bucket = (kind) => {
  const r = ocr.results.filter((r) => r.kind === kind);
  return `| ${kind} | ${r.filter((x) => x.exactMatch).length}/${r.length} | ${pct(r.filter((x) => x.exactMatch).length / r.length)} |`;
};
const text = `# Controlled pilot results

Generated from committed raw results. These are real local executions on **synthetic fixtures**, not live-video quality measurements, competitor trials or publication-ready evidence.

## Retrieval against preserved v1

${retrieval.documentCount} hand-authored English technical excerpts; ${retrieval.queryCount} queries, including 8 additional lexical challenge queries. The baseline is the actual v1 hashed TF/bigram embedder with cosine ranking and precomputed document vectors. BM25 is the rebuilt lexical retriever. No proprietary competitor scores were obtained.

| System | Top-1 count | Top-1 accuracy | 95% Wilson interval | Recall@3 | MRR |
| --- | --- | --- | --- | --- | --- |
${row("BM25", retrieval.overall.bm25, retrieval.rows, "bm25")}
${row("v1", retrieval.overall.v1, retrieval.rows, "v1")}

Paired top-1 disagreements: BM25-only correct ${b}, v1-only correct ${c}. Exact two-sided McNemar p-value: **${p.toFixed(4)}**. This small, authored sample does not establish a statistically reliable superiority claim. Confidence intervals reflect binomial uncertainty within these selected cases and do not eliminate corpus selection bias.

| Subset | BM25 top-1 | v1 top-1 | BM25 recall@3 | v1 recall@3 |
| --- | --- | --- | --- | --- |
| 24 smoke queries | ${pct(retrieval.smoke.bm25.top1Accuracy)} | ${pct(retrieval.smoke.v1.top1Accuracy)} | ${pct(retrieval.smoke.bm25.recallAt3)} | ${pct(retrieval.smoke.v1.recallAt3)} |
| 8 challenge queries | ${pct(retrieval.stress.bm25.top1Accuracy)} | ${pct(retrieval.stress.v1.top1Accuracy)} | ${pct(retrieval.stress.bm25.recallAt3)} | ${pct(retrieval.stress.v1.recallAt3)} |

Both methods struggle on paraphrases with little lexical overlap. BM25 does not dominate every metric. The next experiment should evaluate a hybrid/semantic retriever on a separately annotated held-out video corpus; do not tune this fixture set and present the new score as independent validation. Query timings are single-run pilot timings, not a stable latency benchmark.

## Bundled browser OCR

Browser ${ocr.browser}; ${ocr.hardware.cpu}, ${ocr.hardware.logicalCpus} logical CPUs, ${ocr.hardware.ramGiB} GiB RAM. Images are controlled English text drawn on a canvas at specified sizes and fonts. Stored raw results include all strings, timings and confidence values.

Exact match: **${ocr.results.filter((r) => r.exactMatch).length}/${ocr.sampleSize} (${pct(ocr.exactMatchRate)})**; 95% Wilson interval **${wilson(ocr.results.filter((r) => r.exactMatch).length, ocr.sampleSize)}**. Mean per-image character error rate: **${pct(ocr.meanCharacterErrorRate)}**. No external OCR/model asset requests were observed. Two worker slots also recognized separate images concurrently.

| Content | Exact-match count | Accuracy |
| --- | --- | --- |
${["prose", "command", "code"].map(bucket).join("\n")}

Observed failures:
${
  ocr.results
    .filter((r) => !r.exactMatch)
    .map((r) => `- ${r.id}: expected \`${r.text}\`; observed \`${r.actual}\`.`)
    .join("\n") || "- None in this small fixture set."
}

The code error is material even though aggregate character error is low. Do not silently repair an OCR symbol and claim exact source extraction. Real video blur, compression, small fonts, themes and motion remain untested here.

## What remains necessary for a paper

Execute the [research protocol](PROTOCOL.md) on rights-appropriate real tutorials with human source annotations, frozen splits, real provider outputs, SAGE/Evidence Lab error analysis, playback/memory profiling, repeated trials and legitimate competitor comparisons. The packaged-extension smoke now passes locally after correcting its worker CSP; live YouTube captions remain unresolved. Software unit/UI tests are separate engineering evidence.

Raw data: [retrieval](results/retrieval-controlled.json), [OCR](results/ocr-controlled.json). The current results support a working pilot and expose failure modes; they do not establish universal uniqueness, hallucination elimination, or market superiority.
`;
await writeFile("research/PILOT_RESULTS.md", text);
console.log("Generated research/PILOT_RESULTS.md from raw measurements.");
