import test from "node:test";
import assert from "node:assert/strict";
import {
  extensionAvailable,
  contextMessage,
} from "../src/extension-context.js";
test("extension lifecycle detects missing and invalidated APIs without throwing", () => {
  assert.equal(extensionAvailable({}), false);
  assert.equal(
    extensionAvailable({
      runtime: {
        id: "fixture",
        getManifest() {
          throw Error("Extension context invalidated.");
        },
      },
    }),
    false,
  );
  assert.equal(
    extensionAvailable({
      runtime: { id: "fixture", getManifest: () => ({ version: "1" }) },
    }),
    true,
  );
});
test("context invalidation gives actionable recovery without hiding other errors", () => {
  assert.match(
    contextMessage("Extension context invalidated."),
    /Refresh this YouTube page/,
  );
  assert.match(
    contextMessage("Extension context invalidated."),
    /saved history is retained/,
  );
  assert.equal(contextMessage("Groq rate limit"), "Groq rate limit");
});
