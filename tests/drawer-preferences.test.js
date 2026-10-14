import test from "node:test";
import assert from "node:assert/strict";
import { readDrawerWidth, saveDrawerWidth } from "../src/drawer-preferences.js";
test("missing or invalidated runtime cannot break the drawer", async () => {
  for (const api of [
    {},
    { runtime: {} },
    {
      runtime: {
        sendMessage() {
          throw new Error("Extension context invalidated");
        },
      },
    },
  ]) {
    assert.equal(await readDrawerWidth(api), 460);
    await saveDrawerWidth(700, api);
  }
});
test("drawer preferences are sent to the background without accessing storage", async () => {
  const calls = [];
  const api = {
    runtime: {
      sendMessage: async (message) => {
        calls.push(message);
        return { ok: true, data: { width: 650 } };
      },
    },
  };
  Object.defineProperty(api, "storage", {
    get() {
      throw new Error("Content must not read storage");
    },
  });
  assert.equal(await readDrawerWidth(api), 650);
  await saveDrawerWidth(700, api);
  assert.deepEqual(calls, [
    { type: "DRAWER_PREFERENCE" },
    { type: "DRAWER_PREFERENCE", width: 700 },
  ]);
});
