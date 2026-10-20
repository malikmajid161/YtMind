import test from "node:test";
import assert from "node:assert/strict";
import { sourceTimeline } from "../src/source-timeline.js";
test("full timeline retains every speech moment and frame without a ten-moment cap", () => {
  const session = {
    id: "abcdefghijk",
    transcript: Array.from({ length: 250 }, (_, i) => ({
      text: `Line ${i}`,
      startTime: i * 2,
    })),
  };
  const moments = sourceTimeline(session, [
    { id: "frame", timestamp: 3, ocrText: "Slide" },
  ]);
  assert.equal(moments.length, 251);
  assert.equal(moments.at(-1).text, "Line 249");
  assert.equal(moments[2].kind, "Frame");
  assert.equal(session.transcript.length, 250);
});
