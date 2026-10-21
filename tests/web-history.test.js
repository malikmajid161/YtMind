import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { readingURL } from "../src/web-history.js";
import { Store } from "../src/db.js";
import { createService } from "../src/service.js";
function services() {
  const name = "reading-" + crypto.randomUUID();
  const store = new Store(name);
  return [
    createService({
      store,
      readSettings: async () => ({}),
      writeSettings: async () => {},
    }),
    () =>
      createService({
        store: new Store(name),
        readSettings: async () => ({}),
        writeSettings: async () => {},
      }),
  ];
}
const page = {
  type: "PAGE_CAPTURE",
  url: "https://reading.example.test/article?token=private#section",
  title: "An article",
  text: "Readable article about learning from multiple sources. ".repeat(5),
  visitToken: "first",
  progress: 40,
};
test("reading URLs strip query credentials and exclude internal, account and sensitive sites", () => {
  assert.equal(readingURL(page.url), "https://reading.example.test/article");
  for (const url of [
    "chrome://settings",
    "https://a:b@example.com",
    "https://mail.google.com/mail/u/0",
    "https://example.com/account/profile",
    "https://bank.example.com/balance",
    "https://example.com/checkout",
    "https://chatgpt.com/c/private",
    "http://127.0.0.1:4175",
  ])
    assert.equal(readingURL(url), null, url);
});
test("reading history persists, counts visits once and stops saving immediately after pause", async () => {
  const [a, reopen] = services();
  await a.dispatch(page);
  await a.dispatch({ ...page, progress: 80 });
  let state = await reopen().dispatch({ type: "STATE" });
  assert.equal(state.pages.length, 1);
  assert.equal(state.pages[0].visits, 1);
  assert.equal(state.pages[0].progress, 80);
  assert.equal(state.pages[0].url, "https://reading.example.test/article");
  await a.dispatch({ ...page, visitToken: "second" });
  assert.equal((await a.dispatch({ type: "STATE" })).pages[0].visits, 2);
  await a.dispatch({ type: "READING_TOGGLE", enabled: false });
  await a.dispatch({ ...page, url: "https://reading.example.test/new" });
  assert.equal((await a.dispatch({ type: "STATE" })).pages.length, 1);
  await a.dispatch({ type: "CLEAR" });
  state = await reopen().dispatch({ type: "STATE" });
  assert.equal(state.pages.length, 0);
  assert.equal(state.readingEnabled, false);
  await a.dispatch({ type: "READING_TOGGLE", enabled: true });
  await a.dispatch(page);
  state = await a.dispatch({ type: "STATE" });
  await a.dispatch({ type: "PAGE_DELETE", id: state.pages[0].id });
  assert.equal((await a.dispatch({ type: "STATE" })).pages.length, 0);
});
test("personal notes and saved moments persist separately from evidence and generated outputs", async () => {
  const [a, reopen] = services();
  const videoId = "abcdefghijk";
  await a.dispatch({ type: "SESSION", videoId, title: "Lesson" });
  await Promise.all([
    a.dispatch({ type: "NOTE_SAVE", videoId, text: "My own interpretation" }),
    a.dispatch({
      type: "BOOKMARK_ADD",
      videoId,
      timestamp: 42,
      label: "Useful explanation",
    }),
  ]);
  let s = (await reopen().dispatch({ type: "STATE" })).sessions[0];
  assert.equal(s.personalNotes, "My own interpretation");
  assert.equal(s.bookmarks[0].timestamp, 42);
  assert.equal(s.transcript.length, 0);
  assert.equal(s.outputs.length, 0);
  await a.dispatch({ type: "BOOKMARK_DELETE", videoId, id: s.bookmarks[0].id });
  s = (await a.dispatch({ type: "STATE" })).sessions[0];
  assert.equal(s.bookmarks.length, 0);
  await assert.rejects(
    a.dispatch({ type: "BOOKMARK_ADD", videoId, timestamp: -1 }),
    /valid video moment/,
  );
});

test("upgrading the old database preserves video history while adding saved pages", async () => {
  const name = "upgrade-" + crypto.randomUUID();
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 3);
    request.onupgradeneeded = () => {
      for (const store of ["sessions", "frames", "nodes", "edges", "meta"])
        request.result.createObjectStore(store, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    transaction
      .objectStore("sessions")
      .put({
        id: "abcdefghijk",
        title: "Existing lesson",
        outputs: [{ answer: "Keep this note" }],
      });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  const upgraded = new Store(name);
  assert.equal(
    (await upgraded.read("sessions", "abcdefghijk")).outputs[0].answer,
    "Keep this note",
  );
  assert.deepEqual(await upgraded.read("pages"), []);
});
