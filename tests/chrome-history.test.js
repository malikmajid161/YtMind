import test from "node:test";
import assert from "node:assert/strict";
import {
  maintainBrowserHistory,
  browserHistoryStatus,
} from "../src/chrome-history.js";
import { TTL } from "../src/core.js";
test("Chrome history requires permission and never touches sign-in data", async () => {
  const calls = [];
  const api = {
    permissions: { contains: async () => false },
    history: { deleteRange: async (x) => calls.push(x) },
  };
  assert.deepEqual(await maintainBrowserHistory(api), { enabled: false });
  assert.equal(calls.length, 0);
  api.permissions.contains = async () => true;
  api.history.search = async (opts) => {
    assert.equal(opts.startTime, 1000000000 - TTL);
    return [
      {
        url: "https://example.com",
        title: "Example",
        lastVisitTime: 999999999,
      },
    ];
  };
  const result = await maintainBrowserHistory(api, 1000000000);
  assert.equal(result.count, 1);
  assert.deepEqual(calls, [{ startTime: 0, endTime: 1000000000 - TTL }]);
  assert.equal(
    (await browserHistoryStatus(api, 1000000000)).entries[0].title,
    "Example",
  );
});

import "fake-indexeddb/auto";
import { Store } from "../src/db.js";
test("24-hour policy removes saved and pinned records but preserves settings metadata", async () => {
  const store = new Store("retention-" + crypto.randomUUID());
  const now = Date.now();
  await store.put("meta", { id: "retention-policy", hours: 24 });
  await store.put("sessions", {
    id: "old",
    createdAt: now - TTL - 1,
    saved: true,
    pinned: true,
  });
  await store.put("sessions", { id: "new", createdAt: now - 100, saved: true });
  await store.put("pages", {
    id: "oldpage",
    firstSeenAt: now - TTL - 1,
    lastSeenAt: now,
  });
  await store.put("frames", { id: "f", videoId: "old" });
  await store.cleanup(now);
  assert.equal(await store.read("sessions", "old"), undefined);
  assert.ok(await store.read("sessions", "new"));
  assert.equal(await store.read("pages", "oldpage"), undefined);
  assert.equal(await store.read("frames", "f"), undefined);
  assert.equal((await store.read("meta", "retention-policy")).hours, 24);
});
