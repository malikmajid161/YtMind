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
