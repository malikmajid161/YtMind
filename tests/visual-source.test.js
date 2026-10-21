import test from "node:test";
import assert from "node:assert/strict";
import { hasVisualSource } from "../src/visual-source.js";
import { createShortsFollower } from "../src/shorts-follow.js";
test("silent slide instructions and code qualify while garbled fragments do not", () => {
  assert.equal(
    hasVisualSource([{ ocrText: "Install Python using the setup wizard" }]),
    true,
  );
  assert.equal(hasVisualSource([{ ocrText: "const x = 1;" }]), true);
  assert.equal(hasVisualSource([{ ocrText: ") a | \\ /" }]), false);
});
test("readable silent Shorts skip automatic audio fetching", async () => {
  let clock = 0,
    calls = 0;
  const follow = createShortsFollower({
    now: () => clock,
    health: async () => {
      calls++;
      return { ready: true, paired: true };
    },
    ingest: async () => {
      calls++;
    },
  });
  const state = {
    videoId: "abcdefghijk",
    isShort: true,
    session: { transcript: [] },
    frames: [{ ocrText: "Install Python using the setup wizard" }],
    settings: { hasApiKey: true },
  };
  await follow(state);
  clock = 6000;
  await follow(state);
  assert.equal(calls, 0);
});
