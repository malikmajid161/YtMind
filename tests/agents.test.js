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
    /No matching/,
  );
  assert.equal(called, false);
});
test("Groq handles 401, 429 and malformed JSON without leaking credentials", async () => {
  for (const status of [401, 429])
    await assert.rejects(
      complete({ apiKey: "secret" }, "s", "u", {
        fetcher: async () => new Response("", { status }),
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
