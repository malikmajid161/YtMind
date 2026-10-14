import { marked } from "marked";
import DOMPurify from "dompurify";
import { time } from "./core.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const id = new URLSearchParams(location.search).get("id");
try {
  if (!/^[a-f0-9-]{36}$/.test(id || "")) throw new Error("Invalid PDF export.");
  const data = JSON.parse(localStorage.getItem("ytmind-print:" + id));
  if (!data?.outputs?.length || Date.now() - data.createdAt > 86400000)
    throw new Error(
      "This export has expired. Open YTMind and export the notes again.",
    );
  document.title = String(data.title || "YTMind notes")
    .replace(/[<>:"/\\|?*]/g, " ")
    .slice(0, 140);
  document.querySelector("#document").innerHTML =
    `<h1>${esc(data.title)}</h1><p class="muted">YTMind · Notes and stored source evidence</p>` +
    data.outputs
      .map((o, index) => {
        const markdown = DOMPurify.sanitize(marked.parse(o.answer || ""), {
          FORBID_TAGS: ["img", "style", "iframe", "form", "input", "button"],
        });
        return `<section class="report">${o.query ? `<h2>${esc(o.query)}</h2>` : ""}<div>${markdown}</div><p class="muted">SAGE: ${esc(o.verification?.status || "unchecked")}. Source support is not a guarantee of factual truth.</p><h2>Source references</h2>${(o.evidence || []).map((e, i) => `<div class="source" id="source-${index}-${i + 1}"><h3>E${i + 1} · ${esc(e.title)} · ${time(e.startTime)}</h3><p class="muted">${esc(e.kind)} evidence</p><a href="https://www.youtube.com/watch?v=${encodeURIComponent(e.videoId)}&amp;t=${Math.floor(e.startTime || 0)}s">Open this video moment</a><p class="source-text" dir="auto">${esc(e.text)}</p></div>`).join("")}</section>`;
      })
      .join("");
  document.querySelector("#print").onclick = () => window.print();
  await document.fonts.ready;
  setTimeout(() => window.print(), 300);
} catch (error) {
  document.querySelector("#document").textContent = error.message;
  document.querySelector("#print").disabled = true;
}
