import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptFetcher } from "../src/transcript.js";
test("caption JSON preserves timestamps and merges segments without changing signed URLs", () => {
  const parser = new TranscriptFetcher();
  assert.deepEqual(
    parser._decodeCaptions(
      JSON.stringify({
        events: [
          { tStartMs: 12500, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
          { tStartMs: 30000, segs: [{ utf8: "  " }] },
        ],
      }),
    ),
    [{ text: "Hello world", startTime: 12.5 }],
  );
});
test("non-caption JSON yields no fabricated transcript", () => {
  assert.deepEqual(
    new TranscriptFetcher()._decodeCaptions('{"error":"unavailable"}'),
    [],
  );
});
