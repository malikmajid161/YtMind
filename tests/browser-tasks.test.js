import test from "node:test";
import assert from "node:assert/strict";
import { validateBrowserTask } from "../scripts/browser-tasks.mjs";
import { browserTaskRequest } from "../src/browser-task-client.js";
test("scraper supports structured HTML collection and rejects private or unsupported targets", () => {
  assert.deepEqual(
    validateBrowserTask({ mode: "html", urls: ["https://example.com/page"] }),
    { mode: "html", urls: ["https://example.com/page"] },
  );
  for (const url of [
    "file:///c:/private",
    "http://localhost/",
    "https://claude.ai/",
    "https://example.com/login",
  ])
    assert.throws(() => validateBrowserTask({ mode: "collect", urls: [url] }));
  assert.throws(() =>
    validateBrowserTask({
      mode: "execute-javascript",
      urls: ["https://example.com/"],
    }),
  );
});
test("scraper client sends only the selected job data to the paired local helper", async () => {
  const response = await browserTaskRequest(
    { operation: "create", mode: "html", urls: ["https://example.com/"] },
    async (url, options) => {
      assert.equal(url, "http://127.0.0.1:4175/api/browser");
      assert.deepEqual(JSON.parse(options.body), {
        mode: "html",
        urls: ["https://example.com/"],
      });
      assert.equal(options.headers["X-YTMind-Extension"], "a".repeat(32));
      return { ok: true, json: async () => ({ id: "test" }) };
    },
    "a".repeat(32),
  );
  assert.equal(response.id, "test");
});
