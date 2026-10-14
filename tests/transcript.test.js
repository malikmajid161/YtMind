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

test("caption track requests preserve the signed URL", async () => {
  const original = globalThis.fetch;
  const signed =
    "https://www.youtube.com/api/timedtext?v=abcdefghijk&signature=fixture";
  let requested;
  globalThis.fetch = async (url) => {
    requested = url;
    return new Response(
      JSON.stringify({
        events: [{ tStartMs: 1000, segs: [{ utf8: "Source text" }] }],
      }),
    );
  };
  try {
    assert.deepEqual(
      await new TranscriptFetcher()._viaCaptionTrack({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [{ languageCode: "en", baseUrl: signed }],
          },
        },
      }),
      [{ text: "Source text", startTime: 1 }],
    );
    assert.equal(requested, signed);
  } finally {
    globalThis.fetch = original;
  }
});

test("navigation cancellation restores temporarily enabled captions", async () => {
  const originalDocument = globalThis.document;
  const originalPerformance = globalThis.performance;
  let enabled = false;
  const button = {
    style: {},
    isConnected: true,
    getAttribute: () => String(enabled),
    click: () => {
      enabled = !enabled;
    },
  };
  globalThis.document = { querySelector: () => button };
  globalThis.performance = { getEntriesByType: () => [] };
  const parser = new TranscriptFetcher();
  parser._sleep = async () => {
    throw new Error("navigation cancelled");
  };
  try {
    await assert.rejects(
      parser._viaPlayerCaptions("abcdefghijk"),
      /navigation cancelled/,
    );
    assert.equal(enabled, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.performance = originalPerformance;
  }
});
