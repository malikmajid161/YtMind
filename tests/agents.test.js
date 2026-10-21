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
    "chat",
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

test("related practical answers are labelled outside knowledge and never source-verified", async () => {
  let calls = 0;
  const result = await generate(
    { sage: false },
    "chat",
    "How can we see the Kaaba?",
    evidence,
    async () => {
      calls++;
      return calls === 1
        ? "I could not find this in the captured video evidence."
        : {
            related: true,
            answer:
              "You can see it in person during a visit to Mecca or through a live broadcast. [E1]",
          };
    },
  );
  assert.equal(result.generalKnowledge, true);
  assert.match(result.answer, /Related answer — general knowledge/);
  assert.match(result.answer, /not been checked by SAGE/);
  assert.ok(!result.answer.includes("[E1]"));
  assert.equal(result.verification.status, "unchecked");
});

test("an unrelated missing answer does not acquire a general-knowledge supplement", async () => {
  let calls = 0;
  const result = await generate(
    { sage: false },
    "chat",
    "Explain astronomy",
    evidence,
    async () =>
      ++calls === 1
        ? "I could not find this in the captured video evidence."
        : { related: false, answer: "ignored" },
  );
  assert.equal(result.generalKnowledge, false);
  assert.ok(!result.answer.includes("ignored"));
});

test("first answer is published before delayed independent verification completes", async () => {
  let releaseComparison, publishDraft;
  const waiting = new Promise((resolve) => {
    releaseComparison = resolve;
  });
  const published = new Promise((resolve) => {
    publishDraft = resolve;
  });
  let count = 0;
  const request = generate(
    { sage: true },
    "chat",
    "Explain setup",
    evidence,
    async () => {
      count++;
      if (count === 1) return "Run npm install. [E1]";
      if (count === 2) {
        await waiting;
        return "Use npm install. [E1]";
      }
      return {
        status: "supported",
        reason: "Source matches",
        claims: [{ text: "Run npm install", verdict: "supported", refs: [1] }],
      };
    },
    async (draft) => publishDraft(draft),
  );
  const draft = await published;
  assert.equal(count, 2);
  assert.equal(draft.processing, true);
  assert.equal(draft.verification.status, "unchecked");
  assert.match(draft.answer, /npm install/);
  releaseComparison();
  const final = await request;
  assert.equal(final.id, draft.id);
  assert.equal(final.processing, false);
  assert.equal(final.verification.status, "supported");
});

test("a title cannot become invented frame lyrics when OCR contains only a fragment", async () => {
  const source = [
    {
      text: "Friday = i Ged",
      title: "Tere Ik Chashm e Rehmat Se Tera Bimar Behtar Hai",
      startTime: 100,
      kind: "frame",
      confidence: 60,
    },
  ];
  const output = await generate(
    { sage: true },
    "notes",
    "",
    source,
    async () => {
      throw new Error("Insufficient source must not trigger a content summary");
    },
  );
  assert.match(output.answer, /Not enough readable source/);
  assert.ok(!output.answer.includes("glance of mercy"));
  assert.equal(output.verification.status, "unchecked");
});

test("analysis requests use strict schemas on GPT OSS and bounded JSON-validation recovery", async () => {
  const requests = [];
  const output = await complete(
    { apiKey: "fixture", model: "openai/gpt-oss-120b" },
    "Return JSON",
    "source",
    {
      json: true,
      jsonSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      maxTokens: 6000,
      fetcher: async (_url, request) => {
        requests.push(JSON.parse(request.body));
        return requests.length === 1
          ? Response.json(
              {
                error: {
                  code: "json_validate_failed",
                  message: "private source secret",
                },
              },
              { status: 400 },
            )
          : Response.json({ choices: [{ message: { content: "{}" } }] });
      },
    },
  );
  assert.deepEqual(output, {});
  assert.equal(requests.length, 2);
  assert.equal(requests[0].response_format.json_schema.strict, true);
  assert.equal(requests[0].max_tokens, 6000);
  assert.equal(requests[0].reasoning_effort, "low");
});
test("400 errors distinguish JSON failures and model availability without exposing response bodies", async () => {
  for (const [code, message, pattern] of [
    ["json_validate_failed", "secret source", /required analysis JSON/],
    ["model_decommissioned", "secret source", /model is unavailable/],
  ]) {
    let count = 0;
    await assert.rejects(
      complete({ apiKey: "secret" }, "JSON", "source", {
        json: true,
        fetcher: async () => {
          count++;
          return Response.json({ error: { code, message } }, { status: 400 });
        },
      }),
      (e) => pattern.test(e.message) && !e.message.includes("secret"),
    );
    assert.equal(count, code === "json_validate_failed" ? 2 : 1);
  }
});

test("revision quizzes and flashcards cite the captured evidence and preserve reveal blocks", async () => {
  for (const mode of ["quiz", "flashcards"]) {
    let task = "";
    const result = await generate(
      { sage: false },
      mode,
      "",
      evidence,
      async (_settings, _system, user) => {
        task = user;
        return "### Question 1\nWhat command installs dependencies?\n\n<details><summary>Reveal answer</summary>\n\nRun npm install. [E1]\n\n</details>";
      },
    );
    assert.match(task, mode === "quiz" ? /self-test/ : /revision deck/);
    assert.match(result.answer, /<details>/);
    assert.match(result.answer, /\[E1\]/);
    assert.equal(result.mode, mode);
  }
});
