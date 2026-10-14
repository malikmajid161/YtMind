import test from "node:test";
import assert from "node:assert/strict";
import { previewServer } from "../scripts/preview.mjs";
test("local media endpoint rejects foreign origins, arbitrary targets and oversized requests", async () => {
  const server = await previewServer(0),
    url = `http://127.0.0.1:${server.address().port}/api/media`;
  try {
    const external = await fetch(url, {
      method: "POST",
      headers: {
        origin: "https://attacker.invalid",
        "Content-Type": "application/json",
      },
      body: '{"videoId":"abcdefghijk"}',
    });
    assert.equal(external.status, 403);
    const invalid = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"videoId":"../../Windows"}',
    });
    assert.equal(invalid.status, 400);
    const oversized = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(3000),
    });
    assert.equal(oversized.status, 413);
    assert.equal(
      (await fetch(url + "/00000000-0000-0000-0000-000000000000")).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("paired extension alone receives local helper CORS access", async () => {
  const original = process.env.YTMIND_EXTENSION_ID;
  process.env.YTMIND_EXTENSION_ID = "a".repeat(32);
  const server = await previewServer(0);
  const url = `http://127.0.0.1:${server.address().port}/api/media/health`;
  try {
    const accepted = await fetch(url, {
      headers: { origin: `chrome-extension://${"a".repeat(32)}` },
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).paired, true);
    assert.equal(
      accepted.headers.get("access-control-allow-origin"),
      `chrome-extension://${"a".repeat(32)}`,
    );
    const rejected = await fetch(url, {
      headers: { origin: `chrome-extension://${"b".repeat(32)}` },
    });
    assert.equal(rejected.status, 403);
  } finally {
    if (original === undefined) delete process.env.YTMIND_EXTENSION_ID;
    else process.env.YTMIND_EXTENSION_ID = original;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("originless background requests can pair, while foreign web origins still cannot", async () => {
  const previous = process.env.YTMIND_EXTENSION_ID;
  process.env.YTMIND_EXTENSION_ID = "a".repeat(32);
  const server = await previewServer(0);
  const url = `http://127.0.0.1:${server.address().port}/api/media/health`;
  try {
    const paired = await fetch(url, {
      headers: { "X-YTMind-Extension": "a".repeat(32) },
    });
    assert.equal((await paired.json()).paired, true);
    const blocked = await fetch(url, {
      headers: {
        origin: "https://attacker.invalid",
        "X-YTMind-Extension": "a".repeat(32),
      },
    });
    assert.equal(blocked.status, 403);
  } finally {
    if (previous === undefined) delete process.env.YTMIND_EXTENSION_ID;
    else process.env.YTMIND_EXTENSION_ID = previous;
    await new Promise((resolve) => server.close(resolve));
  }
});
