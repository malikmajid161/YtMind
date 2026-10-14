import test from "node:test";
import assert from "node:assert/strict";
import { helperRequest } from "../src/helper-client.js";
test("helper proxy uses only fixed loopback endpoints and preserves audio bytes", async () => {
  let requested;
  const output = await helperRequest(
    {
      operation: "audio",
      jobId: "11111111-1111-4111-8111-111111111111",
      index: 0,
    },
    async (url) => {
      requested = url;
      return new Response(new Uint8Array([0, 1, 127, 255]));
    },
  );
  assert.equal(
    requested,
    "http://127.0.0.1:4175/api/media/11111111-1111-4111-8111-111111111111/audio/0",
  );
  assert.deepEqual(
    [...Uint8Array.from(atob(output.base64), (c) => c.charCodeAt(0))],
    [0, 1, 127, 255],
  );
  await assert.rejects(
    helperRequest({ operation: "status", jobId: "../../Windows" }),
    /Invalid audio job/,
  );
  await assert.rejects(
    helperRequest({ operation: "create", videoId: "https://attacker.invalid" }),
    /Invalid video/,
  );
});
test("helper failures remain actionable instead of becoming empty evidence", async () => {
  await assert.rejects(
    helperRequest({ operation: "health" }, async () => {
      throw new Error("network");
    }),
    /port 4175/,
  );
  await assert.rejects(
    helperRequest({ operation: "health" }, async () =>
      Response.json({ error: "Pair this extension" }, { status: 403 }),
    ),
    /Pair this extension/,
  );
});
