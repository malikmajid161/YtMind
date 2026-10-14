import test from "node:test";
import assert from "node:assert/strict";
import { connectVideoTab } from "../src/connection.js";

test("missing YouTube receiver is reattached once for concurrent panel requests", async () => {
  const previous = globalThis.chrome;
  let injected = 0,
    attached = false;
  globalThis.chrome = {
    tabs: {
      get: async () => ({ url: "https://www.youtube.com/watch?v=abcdefghijk" }),
      sendMessage: async () => {
        if (!attached)
          throw new Error(
            "Could not establish connection. Receiving end does not exist.",
          );
        return { videoId: "abcdefghijk" };
      },
    },
    scripting: {
      executeScript: async (options) => {
        assert.deepEqual(options, {
          target: { tabId: 7 },
          files: ["content.js"],
        });
        injected++;
        await new Promise((r) => setTimeout(r, 5));
        attached = true;
      },
    },
  };
  try {
    const results = await Promise.all([connectVideoTab(7), connectVideoTab(7)]);
    assert.equal(injected, 1);
    assert.ok(results.every((r) => r.videoId === "abcdefghijk"));
    await connectVideoTab(7);
    assert.equal(injected, 1);
  } finally {
    globalThis.chrome = previous;
  }
});

test("reconnection never injects into unrelated sites or masks other failures", async () => {
  const previous = globalThis.chrome;
  let url = "https://example.com/watch?v=abcdefghijk";
  globalThis.chrome = {
    tabs: {
      get: async () => ({ url }),
      sendMessage: async () => {
        throw new Error("Tab closed");
      },
    },
    scripting: {
      executeScript: async () => {
        assert.fail("Unauthorized injection");
      },
    },
  };
  try {
    assert.equal(await connectVideoTab(8), null);
    url = "https://www.youtube.com/watch?v=abcdefghijk";
    await assert.rejects(connectVideoTab(8), /Tab closed/);
  } finally {
    globalThis.chrome = previous;
  }
});
