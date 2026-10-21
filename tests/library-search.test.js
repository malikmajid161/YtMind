import test from "node:test";
import assert from "node:assert/strict";
import { searchLibrary } from "../src/library-search.js";
const sessions = [
  {
    id: "a",
    title: "Python setup",
    transcript: [{ text: "Run pip install requests.", startTime: 42 }],
    outputs: [],
  },
  {
    id: "b",
    title: "Databases",
    transcript: [],
    outputs: [{ answer: "Indexes improve selective reads." }],
  },
];
test("Library search finds saved source words and returns the matching timestamp", () => {
  const results = searchLibrary(sessions, "PIP requests");
  assert.equal(results.length, 1);
  assert.equal(results[0].timestamp, 42);
  assert.equal(results[0].kind, "Transcript");
});
test("Library search covers notes, titles, empty queries and no matches", () => {
  assert.equal(searchLibrary(sessions, "selective")[0].videoId, "b");
  assert.equal(searchLibrary(sessions, "python")[0].kind, "Video title");
  assert.equal(searchLibrary(sessions, "").length, 2);
  assert.equal(searchLibrary(sessions, "absent").length, 0);
});
