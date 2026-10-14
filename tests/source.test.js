import test from "node:test";
import assert from "node:assert/strict";
import { parseTranscript } from "../src/source.js";
import { transcribeAudio } from "../src/audio.js";
test("subtitle imports preserve precise timestamps and omit metadata", () => {
  assert.deepEqual(
    parseTranscript(
      "WEBVTT\n\n00:01.250 --> 00:03.000\nUse <b>npm install</b>.\n\n00:04.500 --> 00:06.000\nStart the app.",
    ),
    [
      { text: "Use npm install.", startTime: 1.25 },
      { text: "Start the app.", startTime: 4.5 },
    ],
  );
  assert.deepEqual(
    parseTranscript("1\n00:01:02,500 --> 00:01:04,000\nCheck state."),
    [{ text: "Check state.", startTime: 62.5 }],
  );
});
test("manual timestamps and JSON imports retain source positions", () => {
  assert.deepEqual(parseTranscript("0:10 Setup\n[1:20] Run tests"), [
    { text: "Setup", startTime: 10 },
    { text: "Run tests", startTime: 80 },
  ]);
  assert.deepEqual(parseTranscript('[{"text":"command","startTime":2.125}]'), [
    { text: "command", startTime: 2.125 },
  ]);
  assert.throws(
    () => parseTranscript('[{"text":"wrong","startTime":-1}]'),
    /valid timestamp/,
  );
  assert.throws(
    () => parseTranscript("00:05 --> 00:01\nwrong"),
    /end precedes/,
  );
});
test("audio upload uses multipart timestamped transcription and filters likely silence", async () => {
  const file = new File(["fixture"], "sample.wav", { type: "audio/wav" });
  const result = await transcribeAudio(file, "fixture-key", {
    offset: 30,
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.groq.com/openai/v1/audio/transcriptions");
      assert.equal(options.body.get("response_format"), "verbose_json");
      assert.equal(options.body.get("file").name, "sample.wav");
      assert.equal(options.headers["Content-Type"], undefined);
      return Response.json({
        segments: [
          { text: "Run npm install.", start: 2, no_speech_prob: 0.01 },
          { text: "silence hallucination", start: 5, no_speech_prob: 0.99 },
        ],
      });
    },
  });
  assert.deepEqual(result, [{ text: "Run npm install.", startTime: 32 }]);
});
test("failed audio upload does not return fabricated source and hides provider errors", async () => {
  const file = new File(["fixture"], "sample.wav");
  await assert.rejects(
    transcribeAudio(file, "fixture-key", {
      fetcher: async () =>
        new Response("private provider diagnostic", { status: 429 }),
    }),
    /quota/,
  );
  await assert.rejects(
    transcribeAudio(file, "fixture-key", {
      fetcher: async () => Response.json({ text: "untimed text" }),
    }),
    /No timestamped speech/,
  );
  await assert.rejects(
    transcribeAudio(file, "fixture-key", {
      fetcher: async () =>
        Response.json({ segments: [{ text: "invalid", start: -1 }] }),
    }),
    /valid timestamp/,
  );
});

test("YouTube watch, short, live and shared URLs resolve while hostile hosts are rejected", async () => {
  const { youtubeVideoId } = await import("../src/source.js");
  for (const url of [
    "https://youtu.be/Uinx1py7Jsg?t=10",
    "https://www.youtube.com/watch?v=Uinx1py7Jsg",
    "https://www.youtube.com/shorts/Uinx1py7Jsg",
    "https://www.youtube.com/live/Uinx1py7Jsg",
  ])
    assert.equal(youtubeVideoId(url), "Uinx1py7Jsg");
  assert.equal(
    youtubeVideoId("https://youtube.com.attacker.invalid/watch?v=Uinx1py7Jsg"),
    null,
  );
  assert.equal(youtubeVideoId("file:///watch?v=Uinx1py7Jsg"), null);
});
