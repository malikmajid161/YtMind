import test from "node:test";
import assert from "node:assert/strict";
import {
  matchedQuote,
  pairedEvidence,
  validateComparisons,
  validatePreflight,
  analyzeLab,
} from "../src/lab.js";
const all = [
  {
    id: "a",
    videoId: "v",
    kind: "caption",
    text: "Install version 2. Run npm install.",
    startTime: 10,
    title: "Tutorial",
  },
  {
    id: "b",
    videoId: "v",
    kind: "frame",
    text: "Install version 3. npm install",
    startTime: 15,
    title: "Tutorial",
  },
  {
    id: "c",
    videoId: "other",
    kind: "frame",
    text: "Install version 2",
    startTime: 12,
    title: "Other video",
  },
];
test("quote matching preserves command punctuation and rejects invented text", () => {
  assert.ok(matchedQuote({ ref: 1, quote: "npm install" }, all));
  assert.equal(
    matchedQuote({ ref: 1, quote: "npm install --force" }, all),
    null,
  );
  assert.equal(matchedQuote({ ref: 99, quote: "npm install" }, all), null);
});
test("modality pairs stay within the same video and temporal window", () => {
  assert.deepEqual(pairedEvidence(all).pairs, [[1, 2]]);
  assert.equal(
    pairedEvidence([{ ...all[0], startTime: 1000 }, all[1]]).pairs.length,
    0,
  );
});
test("comparison validation rejects invented excerpts and cross-video comparisons", () => {
  const data = {
    observations: [
      {
        status: "potential_mismatch",
        caption: { ref: 1, quote: "version 2" },
        frame: { ref: 2, quote: "version 3" },
      },
      {
        caption: { ref: 1, quote: "version 2" },
        frame: { ref: 3, quote: "version 2" },
      },
      {
        caption: { ref: 1, quote: "version 9" },
        frame: { ref: 2, quote: "version 3" },
      },
    ],
  };
  const result = validateComparisons(data, all);
  assert.equal(result.observations.length, 1);
  assert.equal(result.rejected, 2);
});
test("preflight strips invented commands while retaining source-backed steps", () => {
  const result = validatePreflight(
    {
      steps: [
        {
          action: "Install",
          support: { ref: 1, quote: "Run npm install." },
          commands: [
            { ref: 1, quote: "npm install" },
            { ref: 1, quote: "npm install --force" },
          ],
        },
      ],
      questions: ["Which Node version?"],
    },
    all,
  );
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].commands.length, 1);
  assert.equal(result.rejected, 1);
});
test("lab never promotes exact quote existence into factual verification", async () => {
  const output = await analyzeLab({}, "preflight", all, async () => ({
    steps: [
      {
        action: "Install",
        support: { ref: 1, quote: "npm install" },
        commands: [],
      },
    ],
  }));
  assert.equal(output.verification.status, "unchecked");
  assert.equal(output.structure.steps.length, 1);
});
