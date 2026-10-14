import { TTL } from "./core.js";
export class Store {
  constructor(name = "ytmind-v3") {
    this.name = name;
  }
  async open() {
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 3);
      r.onupgradeneeded = () => {
        for (const name of ["sessions", "frames", "nodes", "edges", "meta"])
          if (!r.result.objectStoreNames.contains(name))
            r.result.createObjectStore(name, { keyPath: "id" });
        const frames = r.transaction.objectStore("frames");
        if (!frames.indexNames.contains("videoId"))
          frames.createIndex("videoId", "videoId");
      };
      r.onsuccess = () => {
        this.db = r.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
          this.opening = null;
        };
        resolve(this.db);
      };
      r.onerror = () => reject(r.error);
    });
    try {
      return await this.opening;
    } catch (e) {
      this.opening = null;
      throw e;
    }
  }
  async tx(names, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(names, "readwrite");
      fn(t);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.onabort = () =>
        reject(t.error || new Error("Storage transaction aborted."));
    });
  }
  async read(name, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const s = db.transaction(name).objectStore(name),
        r = id === undefined ? s.getAll() : s.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  put(name, value) {
    return this.tx([name], (t) => t.objectStore(name).put(value));
  }
  async session(meta) {
    let old = await this.read("sessions", meta.id);
    if (
      old &&
      !old.saved &&
      !meta.saved &&
      !old.pinned &&
      old.expiresAt <= Date.now()
    ) {
      await this.cleanup();
      old = null;
    }
    const value = old
      ? {
          ...old,
          title: meta.title || old.title,
          audioPrimary: meta.audioPrimary ?? old.audioPrimary,
          saved: meta.saved ?? old.saved,
          lastSeenAt: Date.now(),
        }
      : {
          ...meta,
          createdAt: Date.now(),
          expiresAt: Date.now() + TTL,
          transcript: [],
          pinned: false,
          outputs: [],
          captionStatus: "pending",
          lastSeenAt: Date.now(),
        };
    await this.put("sessions", value);
    return value;
  }
  async frames(id) {
    const db = await this.open();
    const frames = await new Promise((resolve, reject) => {
      const r = db
        .transaction("frames")
        .objectStore("frames")
        .index("videoId")
        .getAll(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return frames.sort((a, b) => a.timestamp - b.timestamp);
  }
  async addFrame(frame) {
    const list = await this.frames(frame.videoId);
    await this.tx(["frames"], (t) => {
      const s = t.objectStore("frames");
      s.put(frame);
      if (list.length >= 100)
        s.delete(list.sort((a, b) => a.createdAt - b.createdAt)[0].id);
    });
  }
  async preserveHistory() {
    const records = (await this.read("sessions")).filter((s) => !s.saved);
    if (!records.length) return;
    await this.tx(["sessions"], (transaction) => {
      const sessions = transaction.objectStore("sessions");
      for (const record of records) sessions.put({ ...record, saved: true });
    });
  }
  async cleanup(now = Date.now()) {
    const expired = (await this.read("sessions")).filter(
      (s) => !s.saved && !s.pinned && s.expiresAt <= now,
    );
    const ids = new Set(expired.map((s) => s.id)),
      frames = await this.read("frames");
    await this.tx(["sessions", "frames"], (t) => {
      expired.forEach((s) => t.objectStore("sessions").delete(s.id));
      frames
        .filter((f) => ids.has(f.videoId))
        .forEach((f) => t.objectStore("frames").delete(f.id));
    });
    return expired.length;
  }
  async mergeGraph(graph) {
    const nodes = await this.read("nodes"),
      edges = await this.read("edges");
    const merge = (existing, fresh) => {
      const map = new Map(existing.map((n) => [n.id, n]));
      for (const n of fresh) {
        const old = map.get(n.id);
        const sources = new Map(
          [...(old?.sources || []), ...n.sources].map((s) => [s.id, s]),
        );
        map.set(n.id, {
          ...old,
          ...n,
          sources: [...sources.values()],
          updatedAt: Date.now(),
        });
      }
      return [...map.values()];
    };
    await this.tx(["nodes", "edges"], (t) => {
      merge(nodes, graph.nodes).forEach((n) => t.objectStore("nodes").put(n));
      merge(edges, graph.edges).forEach((e) => t.objectStore("edges").put(e));
    });
  }
  async generation() {
    return (await this.read("meta", "generation"))?.value || 0;
  }
  clear() {
    return this.tx(["sessions", "frames", "nodes", "edges", "meta"], (t) => {
      const meta = t.objectStore("meta");
      const r = meta.get("generation");
      r.onsuccess = () => {
        meta.clear();
        meta.put({ id: "generation", value: (r.result?.value || 0) + 1 });
      };
      for (const n of ["sessions", "frames", "nodes", "edges"])
        t.objectStore(n).clear();
    });
  }
}
