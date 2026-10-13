import { readFile, writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { retrieve } from "../src/core.js";
import { embed, cosineSimilarity } from "./baselines/v1-embedder.js";
const corpus = JSON.parse(
  await readFile(new URL("./corpus.json", import.meta.url), "utf8"),
);
const stress = JSON.parse(
  await readFile(new URL("./stress-corpus.json", import.meta.url), "utf8"),
);
const docs = corpus.documents.map((d, i) => ({
  ...d,
  videoId: "video-" + i,
  title: d.id,
  startTime: i * 30,
  kind: "caption",
}));
const embeddings = await Promise.all(docs.map((d) => embed(d.text)));
const rows = [];
for (const q of [
  ...corpus.queries,
  ...stress.queries.map((q) => ({ ...q, group: "stress" })),
]) {
  const start = performance.now();
  const bm25 = retrieve(docs, q.question);
  const bm25Ms = performance.now() - start;
  const oldStart = performance.now(),
    vector = await embed(q.question);
  const v1 = docs
    .map((d, i) => ({ ...d, score: cosineSimilarity(vector, embeddings[i]) }))
    .sort((a, b) => b.score - a.score);
  const v1Ms = performance.now() - oldStart;
  const evaluate = (result) => {
    const rank = result.findIndex((d) => q.relevant.includes(d.id)) + 1;
    return {
      top1: rank === 1,
      recallAt3: rank > 0 && rank <= 3,
      reciprocalRank: rank ? 1 / rank : 0,
      rank,
      ranking: result.slice(0, 5).map((d) => d.id),
    };
  };
  rows.push({
    ...q,
    bm25: { ...evaluate(bm25), latencyMs: bm25Ms },
    v1: { ...evaluate(v1), latencyMs: v1Ms },
  });
}
const average = (rows, name, key) =>
  rows.reduce((n, r) => n + Number(r[name][key]), 0) / rows.length;
const summarize = (rows) =>
  Object.fromEntries(
    ["bm25", "v1"].map((name) => [
      name,
      {
        top1Accuracy: average(rows, name, "top1"),
        recallAt3: average(rows, name, "recallAt3"),
        meanReciprocalRank: average(rows, name, "reciprocalRank"),
        meanQueryLatencyMs: average(rows, name, "latencyMs"),
      },
    ]),
  );
const report = {
  date: new Date().toISOString(),
  scope: corpus.scope,
  baseline:
    "Actual preserved v1 hashed TF + bigram embedding and cosine similarity; document embeddings precomputed",
  documentCount: docs.length,
  queryCount: rows.length,
  overall: summarize(rows),
  smoke: summarize(rows.filter((r) => r.group !== "stress")),
  stress: summarize(rows.filter((r) => r.group === "stress")),
  paraphrases: summarize(rows.filter((r) => r.group === "paraphrase")),
  rows,
};
await mkdir("research/results", { recursive: true });
await writeFile(
  "research/results/retrieval-controlled.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.overall));
