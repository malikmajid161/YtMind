import test from "node:test";
import assert from "node:assert/strict";
import { audioCommand } from "../src/capture-audio.js";
function fixture(active = false) {
  const states = [];
  const service = {
    dispatch: async (m) => {
      if (m.type === "SOURCE_STATE")
        return { createdAt: 1, hasTranscript: false };
      if (m.type === "SETTINGS") return { apiKey: "fixture" };
      if (m.type === "AUDIO_STATE") states.push(m);
    },
  };
  const chrome = {
    tabs: {
      get: async () => ({ url: "https://www.youtube.com/watch?v=abcdefghijk" }),
    },
    offscreen: { hasDocument: async () => true },
    runtime: { sendMessage: async () => ({ data: { active } }) },
    tabCapture: {
      getMediaStreamId: async () => {
        throw new Error("Capture not invoked");
      },
    },
  };
  return { service, chrome, states };
}
test("audio startup failure persists an actionable status instead of disappearing", async () => {
  const previous = globalThis.chrome;
  const f = fixture();
  globalThis.chrome = f.chrome;
  try {
    await assert.rejects(
      audioCommand(
        { type: "AUDIO_START", tabId: 1, videoId: "abcdefghijk" },
        f.service,
      ),
      /Optional tab-audio capture/,
    );
    assert.equal(f.states[0].status, "error");
    assert.match(f.states[0].message, /Optional tab-audio capture/);
  } finally {
    globalThis.chrome = previous;
  }
});
test("repeated audio start keeps the existing live stream", async () => {
  const previous = globalThis.chrome;
  const f = fixture(true);
  globalThis.chrome = f.chrome;
  f.chrome.tabCapture.getMediaStreamId = () =>
    assert.fail("Existing stream must not restart");
  try {
    const result = await audioCommand(
      { type: "AUDIO_START", tabId: 1, videoId: "abcdefghijk" },
      f.service,
    );
    assert.equal(result.active, true);
    assert.equal(f.states[0].status, "listening");
  } finally {
    globalThis.chrome = previous;
  }
});

test("audio waits for the offscreen handler when document creation races startup", async () => {
  const previous = globalThis.chrome;
  const f = fixture(true);
  globalThis.chrome = f.chrome;
  let readyAttempts = 0;
  f.chrome.runtime.sendMessage = async (m) => {
    if (m.type === "READY" && ++readyAttempts === 1)
      throw new Error(
        "Could not establish connection. Receiving end does not exist.",
      );
    return { data: { active: true } };
  };
  try {
    assert.equal(
      (
        await audioCommand(
          { type: "AUDIO_START", tabId: 1, videoId: "abcdefghijk" },
          f.service,
        )
      ).active,
      true,
    );
    assert.equal(readyAttempts, 2);
  } finally {
    globalThis.chrome = previous;
  }
});
