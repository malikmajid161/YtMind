import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { pageEvidence, sourceURL, isYouTubeSite } from "../src/page-source.js";
import { Store } from "../src/db.js";
import { createService } from "../src/service.js";
const fixture = {
  type: "PAGE_CAPTURE",
  url: "https://reading.example.test/guide",
  title: "Setup guide",
  text: "Install Python using the setup wizard. Measure query performance before adding indexes. ".repeat(
    35,
  ),
  visitToken: "first",
};
function setup() {
  return createService({
    store: new Store("page-tools-" + crypto.randomUUID()),
    readSettings: async () => ({ apiKey: "fixture", sage: false, deep: true }),
    writeSettings: async () => {},
  });
}
test("page evidence retains all readable text and links to the page without video timestamps", () => {
  const page = { ...fixture, id: "page:" + fixture.url };
  const evidence = pageEvidence(page);
  assert.ok(evidence.length > 1);
  assert.equal(evidence.map((e) => e.text).join(" "), page.text.trim());
  assert.ok(
    evidence.every((e) => e.kind === "page" && sourceURL(e) === fixture.url),
  );
  assert.equal(
    isYouTubeSite("https://www.youtube.com/shorts/abcdefghijk"),
    true,
  );
  assert.equal(isYouTubeSite("https://youtube.com.fake.test"), false);
  assert.equal(sourceURL({ kind: "page", url: "javascript:alert(1)" }), "");
});
test("page study modes save separately and survive subsequent reading captures", async () => {
  const service = setup();
  await service.dispatch(fixture);
  const pageId = "page:" + fixture.url;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, req) => {
    const request = JSON.parse(req.body);
    assert.match(request.messages[1].content, /EXTRACTED SOURCE TEXT/);
    return Response.json({
      choices: [
        { message: { content: "Install Python using the setup wizard. [E1]" } },
      ],
    });
  };
  try {
    for (const mode of [
      "notes",
      "chat",
      "actions",
      "quiz",
      "flashcards",
      "speaking",
    ]) {
      const result = await service.dispatch({
        type: "PAGE_GENERATE",
        pageId,
        mode,
        query: "What should I install?",
      });
      assert.equal(result.evidence[0].kind, "page");
      assert.match(result.answer, /\[E1\]/);
    }
    await service.dispatch({
      type: "NOTE_SAVE",
      videoId: pageId,
      text: "My page notes",
    });
    await service.dispatch({
      ...fixture,
      text: fixture.text + " Extra paragraph.",
    });
    const state = await service.dispatch({ type: "STATE" });
    assert.equal(state.sessions.length, 0);
    assert.equal(state.pages[0].outputs.length, 6);
    assert.equal(state.pages[0].personalNotes, "My page notes");
  } finally {
    globalThis.fetch = oldFetch;
  }
});
