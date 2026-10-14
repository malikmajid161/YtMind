import { spawn } from "node:child_process";
import { mkdir, readFile, stat, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export const mediaRoot = path.resolve("artifacts/media-jobs");
const jobs = new Map();
let active = 0;
function python(args) {
  return spawn(process.env.YTMIND_PYTHON || "python", args, {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, PYTHONPATH: path.resolve("artifacts/media-tools") },
  });
}
export async function mediaRequest(req, res, url) {
  if (!url.pathname.startsWith("/api/media")) return false;
  res.setHeader("Cache-Control", "no-store");
  const json = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const origin = req.headers.origin;
  if (
    (origin && origin !== `http://${req.headers.host}`) ||
    !["127.0.0.1", "localhost"].includes(
      new URL(`http://${req.headers.host}`).hostname,
    )
  ) {
    json(403, { error: "Use the local YTMind workspace." });
    return true;
  }
  if (url.pathname === "/api/media" && req.method === "POST") {
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      json(415, { error: "Use a JSON media request." });
      return true;
    }
    if (active >= 2) {
      json(429, {
        error: "Two videos are processing. Wait before adding another.",
      });
      return true;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) {
        json(413, { error: "Request is too large." });
        return true;
      }
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      json(400, { error: "Invalid request." });
      return true;
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(data.videoId)) {
      json(400, { error: "Invalid YouTube video identifier." });
      return true;
    }
    await mkdir(mediaRoot, { recursive: true });
    for (const entry of await readdir(mediaRoot, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        !/^[a-f0-9-]{36}$/.test(entry.name) ||
        jobs.get(entry.name)?.status === "processing"
      )
        continue;
      const target = path.resolve(mediaRoot, entry.name);
      if (
        target.startsWith(mediaRoot + path.sep) &&
        Date.now() - (await stat(target)).mtimeMs > 3600000
      ) {
        await rm(target, { recursive: true, force: true });
        jobs.delete(entry.name);
      }
    }
    // Expire finished local files, keeping the resolved target within the project cache.
    for (const [id, job] of jobs)
      if (job.status !== "processing" && Date.now() - job.createdAt > 3600000) {
        const target = path.resolve(mediaRoot, id);
        if (target.startsWith(mediaRoot + path.sep))
          await rm(target, { recursive: true, force: true });
        jobs.delete(id);
      }
    const cached = (await readdir(mediaRoot, { withFileTypes: true })).filter(
      (entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name),
    );
    if (cached.length >= 20 || jobs.size >= 20) {
      json(429, {
        error: "Media cache is full. Wait for older jobs to expire.",
      });
      return true;
    }
    const id = randomUUID(),
      directory = path.join(mediaRoot, id),
      job = {
        id,
        videoId: data.videoId,
        status: "processing",
        createdAt: Date.now(),
      };
    if (active >= 2) {
      json(429, {
        error: "Two videos are processing. Wait before adding another.",
      });
      return true;
    }
    active++;
    try {
      await mkdir(directory, { recursive: true });
    } catch {
      active--;
      json(500, { error: "Local media storage is unavailable." });
      return true;
    }
    jobs.set(id, job);
    const child = python(["scripts/media-job.py", data.videoId, directory]);
    let diagnostic = "",
      done = false;
    const finish = async (code) => {
      if (done) return;
      done = true;
      active--;
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error("helper");
        const metadata = JSON.parse(
          await readFile(path.join(directory, "metadata.json"), "utf8"),
        );
        if (
          !metadata.chunks?.length ||
          metadata.chunks.some(
            (chunk) =>
              !/^chunk-\d{3}\.mp3$/.test(chunk.name) ||
              !chunk.bytes ||
              chunk.bytes > 24 * 1024 * 1024,
          )
        )
          throw new Error("size");
        Object.assign(job, {
          status: "ready",
          metadata,
          chunks: metadata.chunks.map((chunk, index) => ({
            ...chunk,
            audioUrl: `/api/media/${id}/audio/${index}`,
          })),
        });
      } catch {
        job.status = "failed";
        job.error = diagnostic.includes("No module named")
          ? "Install the media helper with npm run setup:media, then retry."
          : diagnostic.includes("two hours")
            ? "This source needs watching capture or manual audio import."
            : "YouTube audio retrieval failed or exceeded the file limit. Use the extension or upload audio. Private, restricted and unavailable videos cannot be fetched.";
      }
    };
    child.stderr.on("data", (chunk) => {
      diagnostic = (diagnostic + chunk).slice(-4000);
    });
    child.on("error", () => finish(1));
    child.on("close", finish);
    const timer = setTimeout(() => {
      child.kill();
      finish(1);
    }, 300000);
    json(202, { id, status: "processing" });
    return true;
  }
  const match = url.pathname.match(
    /^\/api\/media\/([a-f0-9-]{36})(?:\/(audio)\/(\d+))?$/,
  );
  if (!match || req.method !== "GET") {
    json(404, { error: "Unknown media job." });
    return true;
  }
  const job = jobs.get(match[1]);
  if (!job) {
    json(404, { error: "Media job expired. Import the link again." });
    return true;
  }
  if (!match[2]) {
    json(200, job);
    return true;
  }
  if (job.status !== "ready") {
    json(409, { error: "Audio is not ready." });
    return true;
  }
  const chunk = job.chunks[Number(match[3])];
  if (!chunk) {
    json(404, { error: "Unknown audio section." });
    return true;
  }
  res.writeHead(200, { "Content-Type": "audio/mpeg" });
  res.end(await readFile(path.join(mediaRoot, job.id, chunk.name)));
  return true;
}
