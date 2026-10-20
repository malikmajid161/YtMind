import test from "node:test";
import assert from "node:assert/strict";
import { createShortsFollower } from "../src/shorts-follow.js";
test("captionless Shorts automatically ingest once after settling, with notes preference preserved", async () => {
  let time = 0;
  const calls = [];
  const follow = createShortsFollower({
    now: () => time,
    health: async () => ({ ready: true, paired: true }),
    ingest: async (...args) => calls.push(args),
  });
  const state = {
    videoId: "abcdefghijk",
    isShort: true,
    session: { transcript: [] },
    settings: { hasApiKey: true, autoNotes: true },
  };
  await follow(state);
  assert.equal(calls.length, 0);
  time = 6000;
  await Promise.all([follow(state), follow(state)]);
  assert.deepEqual(calls, [["abcdefghijk", "", "notes"]]);
  await follow({
    ...state,
    videoId: "12345678901",
    settings: { ...state.settings, autoNotes: false },
  });
  time = 12000;
  await follow({
    ...state,
    videoId: "12345678901",
    settings: { ...state.settings, autoNotes: false },
  });
  assert.equal(calls[1][2], null);
});
test("Short follower skips busy jobs, existing captions and ordinary videos", async () => {
  let time = 0;
  let calls = 0;
  const follow = createShortsFollower({
    now: () => time,
    health: async () => ({ ready: true, paired: true }),
    ingest: async () => calls++,
  });
  const state = {
    videoId: "abcdefghijk",
    isShort: true,
    session: { transcript: [] },
    settings: { hasApiKey: true },
  };
  await follow(state);
  time = 6000;
  await follow({ ...state, busy: true });
  await follow({ ...state, isShort: false });
  await follow({ ...state, session: { transcript: [{ text: "source" }] } });
  assert.equal(calls, 0);
  await follow(state);
  assert.equal(calls, 1);
});
