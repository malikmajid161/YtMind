import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/db.js";
import { TTL } from "../src/core.js";
const fresh = () => new Store("test-" + crypto.randomUUID());
test("per-video TTL removes ephemeral frames but preserves pinned sources and graph", async () => {
  const db = fresh();
  await db.session({ id: "old", title: "Old" });
  await db.session({ id: "pin", title: "Pinned" });
  const pin = await db.read("sessions", "pin");
  await db.put("sessions", { ...pin, pinned: true });
  await db.addFrame({ id: "f1", videoId: "old", timestamp: 0 });
  await db.addFrame({ id: "f2", videoId: "pin", timestamp: 0 });
  await db.mergeGraph({
    nodes: [
      {
        id: "concept",
        label: "Concept",
        sources: [{ id: "e1", text: "proof" }],
      },
    ],
    edges: [],
  });
  assert.equal(await db.cleanup(Date.now() + TTL + 100), 1);
  assert.equal(await db.read("sessions", "old"), undefined);
  assert.equal((await db.frames("pin")).length, 1);
  assert.equal((await db.frames("old")).length, 0);
  assert.equal((await db.read("nodes")).length, 1);
});
test("graph merge deduplicates nodes, edges and evidence across videos", async () => {
  const db = fresh();
  const node = { id: "react", label: "React", sources: [{ id: "v1:0" }] },
    edge = {
      id: "rel",
      source: "react",
      target: "state",
      sources: [{ id: "v1:0" }],
    };
  await db.mergeGraph({ nodes: [node], edges: [edge] });
  await db.mergeGraph({
    nodes: [{ ...node, sources: [{ id: "v1:0" }, { id: "v2:0" }] }],
    edges: [edge],
  });
  assert.equal((await db.read("nodes")).length, 1);
  assert.equal((await db.read("nodes"))[0].sources.length, 2);
  assert.equal((await db.read("edges")).length, 1);
});
test("frame limit evicts oldest without exceeding 100", async () => {
  const db = fresh();
  for (let i = 0; i < 102; i++)
    await db.addFrame({
      id: "f" + i,
      videoId: "v",
      timestamp: i,
      createdAt: i,
    });
  const frames = await db.frames("v");
  assert.equal(frames.length, 100);
  assert.equal(frames[0].id, "f2");
});
test("clear removes every learning store", async () => {
  const db = fresh();
  await db.session({ id: "v" });
  await db.addFrame({ id: "f", videoId: "v" });
  await db.mergeGraph({
    nodes: [{ id: "n", sources: [] }],
    edges: [{ id: "e", sources: [] }],
  });
  await db.clear();
  for (const n of ["sessions", "frames", "nodes", "edges"])
    assert.deepEqual(await db.read(n), []);
});
