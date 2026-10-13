import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
const saved = {};
const event = { addListener() {} };
globalThis.chrome = {
  runtime: {
    id: "test-extension",
    getURL: (p) => "chrome-extension://test-extension/" + p,
    onMessage: event,
    onInstalled: event,
    onStartup: event,
    sendMessage: async () => {},
  },
  storage: {
    local: {
      get: async (key) => ({ [key]: saved[key] }),
      set: async (data) => Object.assign(saved, data),
      setAccessLevel: async () => {},
    },
  },
  sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
  alarms: { create() {}, onAlarm: event },
};
const { dispatch } = await import("../src/background.js");
const trusted = {
  id: "test-extension",
  url: "chrome-extension://test-extension/panel.html",
  tab: { id: 1 },
};
const youtube = (id) => ({
  id: "test-extension",
  url: `https://www.youtube.com/watch?v=${id}`,
  tab: { id: 2 },
});
const seed = async (id) => {
  await dispatch(
    { type: "SESSION", videoId: id, title: "Tutorial" },
    youtube(id),
  );
  await dispatch(
    {
      type: "TRANSCRIPT",
      videoId: id,
      segments: [{ text: "React uses useState.", startTime: 5 }],
    },
    youtube(id),
  );
};
test("extension pages are trusted even when Sender includes a tab; content scripts cannot read keys", async () => {
  await dispatch(
    {
      type: "SAVE_SETTINGS",
      value: { apiKey: "test-private", sage: false, deep: false },
    },
    trusted,
  );
  assert.equal(
    (await dispatch({ type: "SETTINGS" }, trusted)).apiKey,
    "test-private",
  );
  await assert.rejects(
    dispatch({ type: "SETTINGS" }, youtube("a")),
    /Unsupported content/,
  );
});
test("navigation rejects stale video transcript messages", async () => {
  await assert.rejects(
    dispatch(
      { type: "TRANSCRIPT", videoId: "old", segments: [] },
      youtube("new"),
    ),
    /Video changed/,
  );
});
test("manual sources cannot be overwritten by late caption responses", async () => {
  await seed("manual00001");
  await dispatch(
    { type: "IMPORT", videoId: "manual00001", text: "My supplied source" },
    trusted,
  );
  await dispatch(
    {
      type: "TRANSCRIPT",
      videoId: "manual00001",
      segments: [{ text: "late response", startTime: 0 }],
    },
    youtube("manual00001"),
  );
  const state = await dispatch({ type: "STATE" }, trusted);
  assert.equal(
    state.sessions.find((s) => s.id === "manual00001").transcript[0].text,
    "My supplied source",
  );
});
test("an in-flight provider result cannot resurrect cleared learning data", async () => {
  await seed("clear-race0");
  let started;
  const begun = new Promise((resolve) => {
    started = resolve;
  });
  let release;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    started();
    return new Promise((resolve) => {
      release = () =>
        resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "React [E1]" } }],
            }),
          ),
        );
    });
  };
  try {
    const pending = dispatch(
      {
        type: "GENERATE",
        videoId: "clear-race0",
        mode: "chat",
        query: "React",
      },
      trusted,
    );
    await begun;
    await dispatch({ type: "CLEAR" }, trusted);
    release();
    await assert.rejects(pending, /cleared during generation/);
    assert.equal(
      (await dispatch({ type: "STATE" }, trusted)).sessions.length,
      0,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
