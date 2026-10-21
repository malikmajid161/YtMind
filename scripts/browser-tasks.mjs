import { spawn } from "node:child_process";
import { mkdir, writeFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readingURL } from "../src/web-history.js";
const jobs = new Map();
export async function cleanupBrowserJobs(now = Date.now()) {
  const root = path.resolve("artifacts/browser-jobs");
  for (const entry of await readdir(root, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue;
    const target = path.resolve(root, entry.name);
    if (path.dirname(target) !== root) continue;
    const info = await stat(target);
    if (info.mtimeMs < now - 24 * 60 * 60 * 1000) {
      await rm(target, { recursive: true, force: true });
      jobs.delete(entry.name);
    }
  }
}

function stopOwnedBrowser(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => child.kill());
  } else child.kill("SIGTERM");
}
export function validateBrowserTask(value) {
  if (!["collect", "links", "tables", "html"].includes(value?.mode))
    throw new Error("Choose a browser task.");
  if (
    !Array.isArray(value.urls) ||
    !value.urls.length ||
    value.urls.length > 10
  )
    throw new Error("Choose 1–10 public website links.");
  const urls = value.urls.map((url) => readingURL(url));
  if (urls.some((url) => !url))
    throw new Error(
      "Use public website links; private, local and unsupported pages are excluded.",
    );
  return { mode: value.mode, urls: [...new Set(urls)] };
}
export async function browserTaskRequest(req, res, url) {
  if (!url.pathname.startsWith("/api/browser")) return false;
  await cleanupBrowserJobs();
  const json = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const paired = process.env.YTMIND_EXTENSION_ID;
  const origin = req.headers.origin;
  const fromExtension =
    /^[a-p]{32}$/.test(paired || "") &&
    (origin === `chrome-extension://${paired}` ||
      (!origin && req.headers["x-ytmind-extension"] === paired));
  if (
    !["127.0.0.1", "localhost"].includes(
      new URL(`http://${req.headers.host}`).hostname,
    ) ||
    (origin && origin !== `http://${req.headers.host}` && !fromExtension)
  ) {
    json(403, { error: "Use your YTMind workspace." });
    return true;
  }
  if (fromExtension) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      `chrome-extension://${paired}`,
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,X-YTMind-Extension",
    );
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  if (url.pathname === "/api/browser" && req.method === "POST") {
    if ([...jobs.values()].some((j) => j.status === "running")) {
      json(409, { error: "A browser task is already running." });
      return true;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 15000) {
        json(413, { error: "The task request is too large." });
        return true;
      }
    }
    let input;
    try {
      input = validateBrowserTask(JSON.parse(body));
    } catch (e) {
      json(400, { error: e.message });
      return true;
    }
    const id = randomUUID(),
      directory = path.resolve("artifacts/browser-jobs", id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "request.json"),
      JSON.stringify(input),
    );
    const job = {
      id,
      status: "running",
      mode: input.mode,
      total: input.urls.length,
      results: [],
      createdAt: Date.now(),
    };
    jobs.set(id, job);
    const child = spawn(
      process.env.YTMIND_PYTHON || "python",
      ["scripts/browser-job.py", path.join(directory, "request.json")],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    job.child = child;
    let pending = "";
    child.stdout.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (item.type === "page") job.results.push(item.result);
          else if (item.type === "error") job.error = item.message;
        } catch {}
      }
    });
    child.stderr.on("data", () => {});
    const timeout = setTimeout(() => {
      job.error = "The browser task exceeded its time limit.";
      stopOwnedBrowser(child);
    }, 180000);
    child.on("error", () => {
      job.status = "failed";
      job.error =
        "Python browser tools are unavailable. Run the browser setup.";
      clearTimeout(timeout);
    });
    child.on("exit", async (code) => {
      clearTimeout(timeout);
      if (job.status !== "cancelled")
        job.status = code === 0 ? "complete" : "failed";
      if (job.status === "failed" && !job.error)
        job.error =
          "The browser task could not complete. Check the browser setup.";
      delete job.child;
      await writeFile(
        path.join(directory, "result.json"),
        JSON.stringify(job, null, 2),
      ).catch(() => {});
    });
    json(202, { id });
    return true;
  }
  const match = url.pathname.match(
    /^\/api\/browser\/([a-f0-9-]{36})(\/cancel)?$/,
  );
  if (match) {
    const job = jobs.get(match[1]);
    if (!job) {
      json(404, {
        error:
          "Browser task not found. Saved results remain in the project folder.",
      });
      return true;
    }
    if (match[2] && req.method === "POST") {
      job.status = "cancelled";
      stopOwnedBrowser(job.child);
    }
    const { child, ...visible } = job;
    json(200, visible);
    return true;
  }
  json(404, { error: "Unknown browser operation." });
  return true;
}
