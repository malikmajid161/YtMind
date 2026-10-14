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

test("loaded-page captions do not trigger another watch request", async () => {
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  globalThis.document = {
    querySelectorAll: () => [
      {
        textContent:
          'ytInitialPlayerResponse = {"videoDetails":{"videoId":"abcdefghijk","title":"Loaded tutorial","author":"Teacher"},"playabilityStatus":{"status":"OK"}};',
      },
    ],
    querySelector: () => null,
    title: "Loaded tutorial - YouTube",
  };
  globalThis.location = { search: "?v=abcdefghijk" };
  globalThis.fetch = () => {
    throw new Error("Unexpected second watch request");
  };
  const parser = new TranscriptFetcher();
  parser._waitForRealVideo = async () => {};
  parser._visibleTranscript = () => [
    { text: "Exact page caption", startTime: 4 },
  ];
  try {
    const result = await parser.fetch("abcdefghijk");
    assert.equal(result.title, "Loaded tutorial");
    assert.equal(result.source, "visible transcript");
    assert.equal(result.transcript.length, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
    globalThis.fetch = previousFetch;
  }
});

test("YouTube player challenge is reported as blocked, not missing captions", async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = {
    querySelectorAll: () => [],
    querySelector: (selector) =>
      selector.includes(".ytp-error-content-wrap")
        ? { textContent: "Sign in to confirm you're not a bot" }
        : null,
    title: "Tutorial - YouTube",
  };
  globalThis.fetch = async () => new Response("");
  const parser = new TranscriptFetcher();
  parser._waitForRealVideo = async () => {};
  try {
    const result = await parser.fetch("abcdefghijk");
    assert.equal(result.status, "blocked");
    assert.equal(result.needsAudio, false);
    assert.match(result.message, /not a bot/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test("caption accessibility labels are stripped only when they match the timestamp", () => {
  const previous = globalThis.document;
  globalThis.document = {
    querySelectorAll: () => [
      { textContent: "1:09 1 minute, 9 secondsاصل متن" },
      { textContent: "0:10 3 seconds later the service starts" },
    ],
  };
  try {
    assert.deepEqual(new TranscriptFetcher()._visibleTranscript(), [
      { text: "اصل متن", startTime: 69 },
      { text: "3 seconds later the service starts", startTime: 10 },
    ]);
  } finally {
    globalThis.document = previous;
  }
});

test("unchanged previous-video transcript DOM is rejected after SPA navigation", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { querySelector: () => ({ click() {} }) };
  const parser = new TranscriptFetcher();
  parser._allowExistingDom = false;
  parser._visibleTranscript = () => [
    { text: "previous video lyrics", startTime: 0 },
  ];
  parser._sleep = async () => {};
  try {
    await assert.rejects(
      parser._viaDomPanel("abcdefghijk"),
      /previous-video source/,
    );
  } finally {
    globalThis.document = previousDocument;
  }
});

test("automatically opened transcript panel closes even when reading is aborted", async () => {
  const previous = globalThis.document;
  let closed = 0;
  globalThis.document = {
    querySelector: (selector) =>
      selector.includes("visibility-button")
        ? {
            click() {
              closed++;
            },
          }
        : selector.includes("target-id")
          ? null
          : { click() {} },
    querySelectorAll: () => [],
  };
  const parser = new TranscriptFetcher();
  parser._visibleTranscript = () => [];
  let waits = 0;
  parser._sleep = async () => {
    if (++waits > 1) throw new Error("aborted");
  };
  try {
    await assert.rejects(parser._viaDomPanel("abcdefghijk"), /aborted/);
    assert.equal(closed, 1);
  } finally {
    globalThis.document = previous;
  }
});

test("an open Short uses live-player caption capture and the active Short title", async () => {
  const previousDocument = globalThis.document,
    previousLocation = globalThis.location,
    previousFetch = globalThis.fetch;
  globalThis.location = {
    href: "https://www.youtube.com/shorts/abcdefghijk",
    search: "",
  };
  globalThis.document = {
    querySelectorAll: () => [],
    querySelector: (selector) =>
      selector.includes("h2") ? { textContent: "Active coding Short" } : null,
    title: "YouTube",
  };
  globalThis.fetch = async () => new Response("");
  const parser = new TranscriptFetcher();
  parser._waitForRealVideo = async () => {};
  parser._viaPlayerCaptions = async (id) => {
    assert.equal(id, "abcdefghijk");
    return [{ text: "Run npm install", startTime: 2 }];
  };
  try {
    const result = await parser.fetch("abcdefghijk");
    assert.equal(result.source, "player captions");
    assert.equal(result.title, "Active coding Short");
    assert.equal(result.transcript[0].text, "Run npm install");
  } finally {
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
    globalThis.fetch = previousFetch;
  }
});
