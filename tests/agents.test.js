import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../src/agents.js";
import { complete } from "../src/groq.js";
const evidence = [
  {
    text: "Run npm install",
    title: "Setup",
    startTime: 4,
    kind: "caption",
    videoId: "v",
  },
];
test("independent SAGE answer does not receive the original; comparator receives sources", async () => {
  const calls = [];
  const call = async (s, system, user, opts) => {
    calls.push({ system, user, opts });
    if (calls.length === 1) return "Run npm install [E1]";
    if (calls.length === 2) return "Use npm install [E1]";
    return {
      status: "supported",
      claims: [{ text: "Run npm install", verdict: "supported", refs: [1] }],
    };
  };
  const result = await generate({ sage: true }, "actions", "", evidence, call);
  assert.equal(result.verification.status, "supported");
  assert.equal(calls[1].user, calls[0].user);
  assert.ok(calls[2].user.includes("Run npm install"));
  assert.equal(calls.length, 3);
});
test("failed verification returns original as unchecked rather than falsely supported", async () => {
  let count = 0;
  const result = await generate(
    { sage: true },
    "notes",
    "",
    evidence,
    async () => {
      if (++count === 1) return "notes";
      throw new Error("Rate limit");
    },
  );
  assert.equal(result.answer, "notes");
  assert.equal(result.verification.status, "unchecked");
});
test("missing source never calls the API", async () => {
  let called = false;
  await assert.rejects(
    generate({}, "chat", "hi", [], async () => {
      called = true;
    }),
    /No readable source/,
  );
  assert.equal(called, false);
});
test("Groq handles 401, 429 and malformed JSON without leaking credentials", async () => {
  for (const status of [401, 429])
    await assert.rejects(
      complete({ apiKey: "secret" }, "s", "u", {
        fetcher: async () => new Response("", { status }),
        wait: async () => {},
      }),
      status === 401 ? /rejected your key/ : /rate limit/,
    );
  await assert.rejects(
    complete({ apiKey: "secret" }, "s", "u", {
      json: true,
      fetcher: async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "bad json" } }] }),
        ),
    }),
    /invalid JSON/,
  );
});

test("rate-limited chat requests retry within a bounded policy before returning a result", async () => {
  let count = 0;
  const delays = [];
  const result = await complete({ apiKey: "fixture" }, "s", "u", {
    wait: async (ms) => delays.push(ms),
    fetcher: async () =>
      ++count < 3
        ? new Response("", { status: 429, headers: { "retry-after": "2" } })
        : Response.json({
            choices: [{ message: { content: "Source answer [E1]" } }],
          }),
  });
  assert.equal(result, "Source answer [E1]");
  assert.equal(count, 3);
  assert.deepEqual(delays, [2000, 2000]);
});

test("a supported model verdict is downgraded when the answer cites nonexistent evidence", async () => {
  let index = 0;
  const result = await generate(
    { sage: true },
    "notes",
    "",
    [
      {
        id: "source",
        text: "Source evidence",
        videoId: "abcdefghijk",
        startTime: 0,
      },
    ],
    async () =>
      ++index === 1
        ? "Invented citation [E99]"
        : index === 2
          ? "Independent answer [E1]"
          : {
              status: "supported",
              reason: "Model agreement",
              claims: [{ text: "claim", verdict: "supported", refs: [1] }],
            },
  );
  assert.equal(result.verification.status, "uncertain");
  assert.match(result.verification.reason, /invalid references/);
});

test("frame OCR cannot verify a claim about garbled caption transcripts", async () => {
  let callIndex = 0;
  const result = await generate(
    { sage: true },
    "notes",
    "",
    [
      {
        text: "aad x mt r IN",
        title: "Video",
        kind: "frame",
        confidence: 12,
        startTime: 255,
        videoId: "abcdefghijk",
      },
    ],
    async () =>
      ++callIndex < 3
        ? "Later captions become fragmented. [E1]"
        : {
            status: "supported",
            reason: "Model agreement",
            claims: [
              {
                text: "Later captions become fragmented",
                verdict: "supported",
                refs: [1],
              },
            ],
          },
  );
  assert.equal(result.verification.status, "uncertain");
  assert.equal(result.verification.claims[0].verdict, "uncertain");
  assert.match(result.verification.reason, /Source-type audit/);
});
