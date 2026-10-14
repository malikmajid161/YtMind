import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/db.js";
import { createService } from "../src/service.js";
import { defaults } from "../src/core.js";
function services() {
  const name = "multi-" + crypto.randomUUID();
  const factory = () =>
    createService({
      store: new Store(name),
      readSettings: async () => ({
        ...defaults,
        apiKey: "fixture",
        sage: false,
        deep: false,
      }),
      writeSettings: async () => {},
    });
  return [factory(), factory()];
}
test("clearing in a second workspace invalidates the first workspace's in-flight answer", async () => {
  const [a, b] = services();
  await a.dispatch({
    type: "SESSION",
    videoId: "abcdefghijk",
    title: "Tutorial",
  });
  await a.dispatch({
    type: "IMPORT",
    videoId: "abcdefghijk",
    text: "Run npm install.",
  });
  let started, finish;
  const begun = new Promise((r) => (started = r)),
    pending = new Promise((r) => (finish = r));
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    started();
    await pending;
    return Response.json({
      choices: [{ message: { content: "Run npm install. [E1]" } }],
    });
  };
  try {
    const work = a.dispatch({
      type: "GENERATE",
      videoId: "abcdefghijk",
      mode: "notes",
    });
    await begun;
    await b.dispatch({ type: "CLEAR" });
    await b.dispatch({
      type: "SESSION",
      videoId: "abcdefghijk",
      title: "New source",
    });
    finish();
    await assert.rejects(work, /cleared during generation/);
    assert.deepEqual(
      (await b.dispatch({ type: "STATE" })).sessions[0].outputs,
      [],
    );
  } finally {
    globalThis.fetch = oldFetch;
    finish?.();
  }
});
test("reviewed imports reject a changed source instead of overwriting it", async () => {
  const [a, b] = services();
  await a.dispatch({
    type: "SESSION",
    videoId: "abcdefghijk",
    title: "Tutorial",
  });
  const initial = (await a.dispatch({ type: "STATE" })).sessions[0];
  await b.dispatch({
    type: "IMPORT",
    videoId: "abcdefghijk",
    text: "Newer source",
  });
  await assert.rejects(
    a.dispatch({
      type: "IMPORT_SEGMENTS",
      videoId: "abcdefghijk",
      expectedCreatedAt: initial.createdAt,
      expectedVersion: initial.transcriptVersion,
      segments: [{ text: "Stale speech", startTime: 3 }],
      source: "audio",
    }),
    /source changed/,
  );
  assert.equal(
    (await a.dispatch({ type: "STATE" })).sessions[0].transcript[0].text,
    "Newer source",
  );
});

test("five lecture notes persist and resume across service instances with one API call per source", async () => {
  const [a, b] = services();
  for (let index = 1; index <= 5; index++) {
    const videoId = `lecture000${index}`;
    await a.dispatch({ type: "SESSION", videoId, title: `Lecture ${index}` });
    await a.dispatch({
      type: "IMPORT",
      videoId,
      text: `Lecture ${index} explains source concept ${index}.`,
    });
    await a.dispatch({ type: "PIN", videoId, pinned: true });
  }
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({
      choices: [{ message: { content: "Source-linked notes. [E1]" } }],
    });
  };
  try {
    await a.dispatch({ type: "BATCH_START" });
    let job;
    for (let i = 0; i < 5; i++)
      job = await (i % 2 ? a : b).dispatch({ type: "BATCH_STEP" });
    assert.equal(job.status, "complete");
    assert.equal(requests, 5);
    const state = await a.dispatch({ type: "STATE" });
    assert.equal(
      state.sessions.filter((s) => s.outputs.length === 1).length,
      5,
    );
    await a.dispatch({ type: "CLEAR" });
    assert.equal((await b.dispatch({ type: "STATE" })).batch, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test("failed caption retry preserves previously saved caption evidence", async () => {
  const [service] = services();
  await service.dispatch({
    type: "SESSION",
    videoId: "abcdefghijk",
    title: "Tutorial",
  });
  await service.dispatch({
    type: "TRANSCRIPT",
    videoId: "abcdefghijk",
    segments: [{ text: "Install Python", startTime: 10 }],
    source: "player captions",
  });
  await service.dispatch({
    type: "TRANSCRIPT",
    videoId: "abcdefghijk",
    segments: [],
    status: "blocked",
    message: "Sign in",
  });
  const saved = (await service.dispatch({ type: "STATE" })).sessions[0];
  assert.equal(saved.captionStatus, "ready");
  assert.deepEqual(saved.transcript, [
    { text: "Install Python", startTime: 10 },
  ]);
});

test("Ask uses captured foreign-language context even when English keywords do not match", async () => {
  const [service] = services();
  await service.dispatch({
    type: "SESSION",
    videoId: "abcdefghijk",
    title: "Urdu lecture",
  });
  await service.dispatch({
    type: "IMPORT",
    videoId: "abcdefghijk",
    text: "یہ ایک کتاب ہے",
  });
  const oldFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_, options) => {
    request = JSON.parse(options.body);
    return Response.json({
      choices: [{ message: { content: "The source describes a book. [E1]" } }],
    });
  };
  try {
    const output = await service.dispatch({
      type: "GENERATE",
      videoId: "abcdefghijk",
      mode: "chat",
      query: "What object is discussed?",
    });
    assert.equal(output.coverage.selected, output.coverage.total);
    assert.ok(output.evidence.length > 0);
    assert.ok(JSON.stringify(request).includes("یہ ایک کتاب ہے"));
    assert.ok(JSON.stringify(request).includes("clear English"));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("Roman Urdu questions retain source context and speaking notes process the captured source", async () => {
  const [service] = services();
  await service.dispatch({
    type: "SESSION",
    videoId: "abcdefghijk",
    title: "Setup lesson",
  });
  await service.dispatch({
    type: "IMPORT",
    videoId: "abcdefghijk",
    text: "Install Node.js. Run npm install.",
  });
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({
      choices: [
        { message: { content: "Install Node.js and run npm install. [E1]" } },
      ],
    });
  };
  try {
    const answer = await service.dispatch({
      type: "GENERATE",
      mode: "chat",
      videoId: "abcdefghijk",
      query: "is ko shuru kesay karna hai?",
    });
    assert.ok(answer.evidence.length);
    assert.match(requests[0].messages[0].content, /Roman Urdu/);
    assert.match(requests[0].messages[1].content, /is ko shuru kesay/);
    const notes = await service.dispatch({
      type: "GENERATE",
      mode: "speaking",
      videoId: "abcdefghijk",
    });
    assert.equal(notes.mode, "speaking");
    assert.equal(notes.coverage.selected, notes.coverage.total);
    assert.match(requests.at(-1).messages[1].content, /natural script/);
    const state = await service.dispatch({ type: "STATE" });
    assert.equal(
      state.sessions[0].outputs.filter((output) => output.mode === "speaking")
        .length,
      1,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("automatic history retains unpinned sources and outputs after expiry and reopening", async () => {
  const name = "history-" + crypto.randomUUID();
  const store = new Store(name);
  const old = await store.session({ id: "abcdefghijk", title: "Old lecture" });
  await store.put("sessions", {
    ...old,
    expiresAt: 0,
    outputs: [
      {
        id: "saved-answer",
        mode: "notes",
        answer: "Stored explanation",
        evidence: [],
      },
    ],
  });
  await store.addFrame({
    id: "old-frame",
    videoId: old.id,
    timestamp: 5,
    createdAt: 1,
    image: "stored-image",
  });
  const factory = () =>
    createService({
      store: new Store(name),
      readSettings: async () => defaults,
      writeSettings: async () => {},
    });
  const service = factory();
  const state = await service.dispatch({ type: "STATE" });
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].saved, true);
  assert.equal(state.sessions[0].pinned, false);
  await service.cleanup();
  const reopened = factory();
  assert.equal(
    (await reopened.dispatch({ type: "STATE" })).sessions[0].outputs[0].answer,
    "Stored explanation",
  );
  assert.equal(
    (await reopened.dispatch({ type: "FRAMES", videoId: old.id })).length,
    1,
  );
  await reopened.dispatch({
    type: "SESSION",
    videoId: "lmnopqrstuv",
    title: "New video",
  });
  assert.equal(
    (await reopened.dispatch({ type: "STATE" })).sessions.find(
      (s) => s.id === "lmnopqrstuv",
    ).saved,
    true,
  );
});
