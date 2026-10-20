import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDiscussion, validateDiscussion } from "../src/talkshow.js";
import { batchEvidence } from "../src/core.js";
import { youtubeVideoId } from "../src/source.js";
const evidence = [
  {
    kind: "caption",
    text: "The army policy is wrong. Article 25 means equality, he said.",
    startTime: 30,
    title: "Debate",
    videoId: "Uinx1py7Jsg",
  },
];
const finding = {
  category: "institutional_criticism",
  target: "Army policy",
  rendering: "The speaker criticizes army policy.",
  context: "A policy criticism, not a threat.",
  stance: "speaker statement",
  keywords: ["army", "policy"],
  support: { ref: 1, quote: "The army policy is wrong." },
};
test("discussion rejects fabricated quotes, invalid categories and frames as speech", () => {
  const result = validateDiscussion(
    {
      findings: [
        finding,
        { ...finding, support: { ref: 1, quote: "Attack the army" } },
        { ...finding, category: "illegal" },
        { ...finding, support: { ref: 99, quote: "policy" } },
      ],
    },
    evidence,
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.rejected, 3);
  assert.equal(
    validateDiscussion({ findings: [finding] }, [
      { ...evidence[0], kind: "frame" },
    ]).findings.length,
    0,
  );
});
test("discussion preserves quoted/rebutted context and reports bounded coverage", () => {
  const result = validateDiscussion(
    { findings: [{ ...finding, stance: "rebuttal" }], moreFindings: true },
    evidence,
  );
  assert.equal(result.findings[0].stance, "rebuttal");
  assert.equal(result.truncated, true);
});
test("law claims remain unverified, original evidence retained, no speaker identity invented", async () => {
  const result = await analyzeDiscussion({}, evidence, async () =>
    JSON.stringify({
      findings: [
        {
          ...finding,
          category: "law_reference",
          support: { ref: 1, quote: "Article 25 means equality" },
          rendering: "The speaker says Article 25 means equality.",
        },
      ],
    }),
  );
  assert.match(result.answer, /Legal accuracy/);
  assert.match(result.answer, /unverified/);
  assert.equal(result.verification.status, "unchecked");
  assert.equal(result.evidence, evidence);
  assert.equal(
    result.structure.findings[0].support.quote,
    "Article 25 means equality",
  );
});
test("Shorts share video identification and full speech batching without sampling", () => {
  assert.equal(
    youtubeVideoId("https://www.youtube.com/shorts/Uinx1py7Jsg"),
    "Uinx1py7Jsg",
  );
  const all = Array.from({ length: 20 }, (_, i) => ({
    ...evidence[0],
    id: String(i),
    text: "x".repeat(1500),
    startTime: i * 60,
  }));
  assert.deepEqual(batchEvidence(all, 7000).flat(), all);
});
test("frames-only discussion fails instead of inventing audio", async () => {
  await assert.rejects(
    analyzeDiscussion({}, [{ ...evidence[0], kind: "frame" }]),
    /transcribed audio/,
  );
});

test("unmatched generated findings fail rather than saving a misleading empty report", async () => {
  await assert.rejects(
    analyzeDiscussion({}, evidence, async () => ({
      findings: [{ ...finding, support: { ref: 1, quote: "Invented quote" } }],
    })),
    /No report was saved/,
  );
});
test("ordinary historical content is retained as a neutral key point", async () => {
  const result = await analyzeDiscussion({}, evidence, async () => ({
    findings: [{ ...finding, category: "key_point" }],
  }));
  assert.match(result.answer, /Key point or claim/);
});

test("speaker names require the exact speaker label on the supporting statement", () => {
  const source = [
    {
      ...evidence[0],
      text: "Ayesha: We should compare the maps. Hassan is a guest.",
    },
  ];
  const base = {
    ...finding,
    speaker: "Ayesha",
    support: { ref: 1, quote: "Ayesha: We should compare the maps." },
  };
  assert.equal(
    validateDiscussion({ findings: [base] }, source).findings[0].speaker,
    "Ayesha",
  );
  assert.equal(
    validateDiscussion({ findings: [{ ...base, speaker: "Hassan" }] }, source)
      .findings[0].speaker,
    null,
  );
  assert.equal(
    validateDiscussion(
      {
        findings: [
          {
            ...base,
            support: { ref: 1, quote: "We should compare the maps." },
          },
        ],
      },
      source,
    ).findings[0].speaker,
    null,
  );
});
