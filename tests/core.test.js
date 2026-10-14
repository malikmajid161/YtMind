import test from "node:test";
import assert from "node:assert/strict";
import {
  chunks,
  retrieve,
  similarity,
  validateGraph,
  validateVerdict,
  frameSignal,
  frameDifference,
  batchEvidence,
  combineParts,
  normalizeCitations,
} from "../src/core.js";
const evidence = [
  {
    id: "v:0",
    videoId: "v",
    title: "Video",
    text: "React state remembers a value",
    startTime: 10,
    kind: "caption",
  },
];
test("chunking retains video identity and timestamp, adds OCR evidence", () => {
  const result = chunks(
    {
      id: "v",
      title: "Video",
      transcript: [{ text: "caption", startTime: 12 }],
    },
    [{ ocrText: "const x = 1", timestamp: 15 }],
  );
  assert.equal(result[0].startTime, 12);
  assert.equal(result[1].kind, "frame");
  assert.equal(result[1].videoId, "v");
});
test("retrieval rejects irrelevant evidence, bounds context and samples the video", () => {
  assert.deepEqual(retrieve(evidence, "astronomy"), []);
  assert.equal(retrieve(evidence, "React")[0].id, "v:0");
  const all = Array.from({ length: 60 }, (_, i) => ({
    ...evidence[0],
    id: String(i),
    text: "a".repeat(950),
  }));
  const sampled = retrieve(all, "", "notes", 5000);
  assert.equal(sampled.length, 5);
  assert.equal(sampled.at(-1).id, "48");
  assert.ok(sampled.reduce((n, c) => n + c.text.length, 0) <= 5000);
});
test("OCR deduplication normalizes casing and punctuation", () => {
  assert.equal(similarity("REACT, state!", "React state"), 1);
  assert.equal(similarity("", ""), 0);
  assert.equal(similarity("React", "Python"), 0);
});
test("graph rejects fabricated refs and dangling edges", () => {
  const graph = validateGraph(
    {
      nodes: [
        { label: "React", refs: [1] },
        { label: "State", refs: [1] },
        { label: "Fake", refs: [99] },
      ],
      edges: [
        { source: "React", target: "State", relation: "manages", refs: [1] },
        { source: "React", target: "Fake", refs: [1] },
      ],
    },
    evidence,
  );
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.nodes[0].id, "react");
  assert.equal(graph.nodes[0].sources[0].startTime, 10);
});
test("SAGE cannot report support without valid evidence references", () => {
  assert.equal(
    validateVerdict(
      {
        status: "supported",
        claims: [{ text: "claim", verdict: "supported", refs: [99] }],
      },
      evidence,
    ).status,
    "uncertain",
  );
  assert.equal(
    validateVerdict(
      {
        status: "supported",
        claims: [{ text: "claim", verdict: "conflicting", refs: [1] }],
      },
      evidence,
    ).status,
    "conflicting",
  );
  assert.throws(() =>
    validateVerdict({ status: "verified", claims: [] }, evidence),
  );
});
test("flat frames are rejected and pixel differences are measured", () => {
  const pixels = new Uint8ClampedArray(160 * 90 * 4).fill(255);
  assert.equal(frameSignal(pixels, 160, 90).useful, false);
  assert.equal(frameDifference([1, 3], [2, 4]), 1);
});
test("provider citation variants become clickable canonical evidence markers", () => {
  assert.equal(
    normalizeCitations("Claim 【E1】 and ［E2］."),
    "Claim [E1] and [E2].",
  );
});
test("frame identities remain stable when an earlier frame is inserted", () => {
  const s = { id: "video", title: "V", transcript: [] };
  const frame = { id: "one", ocrText: "code", timestamp: 20 };
  const a = chunks(s, [frame])[0].id;
  const b = chunks(s, [
    { id: "two", ocrText: "earlier", timestamp: 10 },
    frame,
  ])[1].id;
  assert.equal(a, b);
});
test("manual long text is chunked into request-sized pieces without losing content", () => {
  const text = "word ".repeat(5000).trim();
  const out = chunks({ id: "v", transcript: [{ text, startTime: 0 }] });
  assert.ok(out.every((c) => c.text.length <= 1600));
  assert.equal(out.map((c) => c.text.trim()).join(" "), text);
});
test("deep batching covers all source chunks without silently sampling", () => {
  const all = Array.from({ length: 50 }, (_, i) => ({
    ...evidence[0],
    id: String(i),
    text: "x".repeat(950),
  }));
  const batches = batchEvidence(all, 5000);
  assert.equal(batches.length, 10);
  assert.deepEqual(
    batches.flat().map((e) => e.id),
    all.map((e) => e.id),
  );
});
test("deep section merge remaps answer citations and verification refs", () => {
  const make = (i) => ({
    jobId: "job",
    batchIndex: i,
    totalBatches: 2,
    answer: "Claim [E1]",
    evidence: [{ ...evidence[0], id: String(i) }],
    verification: {
      status: "supported",
      claims: [{ text: "Claim", refs: [1], verdict: "supported" }],
    },
    coverage: { total: 2 },
  });
  const merged = combineParts([make(0), make(1)]);
  assert.ok(merged.answer.includes("[E2]"));
  assert.deepEqual(merged.verification.claims[1].refs, [2]);
  assert.equal(merged.coverage.selected, 2);
});
test("BM25 prefers rare matching terms; multi-video research retains source diversity", () => {
  const all = [
    {
      ...evidence[0],
      id: "1",
      videoId: "a",
      text: "React React React rendering",
    },
    { ...evidence[0], id: "2", videoId: "a", text: "React reconciliation" },
    { ...evidence[0], id: "3", videoId: "b", text: "React state" },
  ];
  const result = retrieve(all, "React reconciliation", "chat");
  assert.equal(result[0].id, "2");
  const research = retrieve(all, "React", "research");
  assert.notEqual(research[0].videoId, research[1].videoId);
});

test("provider line-style citations retain only source IDs we actually supplied", () => {
  assert.equal(
    normalizeCitations("Claim【E1†L1-L12】【E2†L9-L12】"),
    "Claim[E1][E2]",
  );
});
