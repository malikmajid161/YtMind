export const TTL = 24 * 60 * 60 * 1000;
export const defaults = {
  apiKey: "",
  model: "openai/gpt-oss-120b",
  verifierModel: "openai/gpt-oss-20b",
  interval: 5,
  profile: "performance",
  ocrLanguage: "eng",
  audioLanguage: "",
  deep: true,
  sage: true,
  autoNotes: true,
  autoCode: true,
};
export const time = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function normalizeCitations(text) {
  return String(text).replace(
    /【\s*E(\d+)(?:†L\d+(?:-L?\d+)?)?\s*】|［\s*E(\d+)\s*］/g,
    (_, a, b) => `[E${a || b}]`,
  );
}
export const normalize = (s) =>
  String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function similarity(a, b) {
  const x = new Set(normalize(a).split(" ").filter(Boolean)),
    y = new Set(normalize(b).split(" ").filter(Boolean));
  if (!x.size || !y.size) return 0;
  return [...x].filter((t) => y.has(t)).length / new Set([...x, ...y]).size;
}
export function chunks(session, frames = []) {
  const out = [];
  let text = "",
    start = 0,
    end = 0;
  for (const segment of session.transcript || []) {
    if (!text) start = segment.startTime;
    text += segment.text + " ";
    end = segment.startTime;
    if (text.length > 900) {
      out.push({
        text: text.trim(),
        startTime: start,
        endTime: end,
        kind: "caption",
      });
      text = "";
    }
  }
  if (text.trim())
    out.push({
      text: text.trim(),
      startTime: start,
      endTime: end,
      kind: "caption",
    });
  for (const f of frames)
    if (f.ocrText?.trim())
      out.push({
        text: f.ocrText,
        startTime: f.timestamp,
        kind: "frame",
        frameId: f.id,
        confidence: f.confidence,
        role: session.audioPrimary ? "artwork" : "screen evidence",
      });
  const bounded = out.flatMap((c) => {
    const pieces = [];
    let remaining = c.text;
    while (remaining.length > 1600) {
      let cut = remaining.lastIndexOf("\n", 1600);
      if (cut < 800) cut = remaining.lastIndexOf(" ", 1600);
      if (cut < 800) cut = 1600;
      pieces.push({
        ...c,
        text: remaining.slice(0, cut),
        partIndex: pieces.length,
      });
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining)
      pieces.push({ ...c, text: remaining, partIndex: pieces.length });
    return pieces;
  });
  return bounded.map((c, i) => ({
    ...c,
    id:
      c.kind === "frame"
        ? `${session.id}:frame:${c.frameId || c.startTime}:${c.partIndex}`
        : `${session.id}:caption:${session.transcriptVersion || session.createdAt || 0}:${i}`,
    videoId: session.id,
    title: session.title,
  }));
}
export function retrieve(all, query, mode = "chat", budget = 18000) {
  const stop = new Set(
    "a an the is are of to and in for from with what how why when where do does can i me this that explain mentioned video".split(
      " ",
    ),
  );
  const words = [
    ...new Set(
      normalize(query)
        .split(" ")
        .filter((w) => w.length > 1 && !stop.has(w)),
    ),
  ];
  let selected;
  if (
    ["notes", "actions", "graph"].includes(mode) ||
    /main idea|summari[sz]e|overview/i.test(query) ||
    (mode === "chat" &&
      /^(?:What prerequisites are mentioned\??|Explain the code shown in the video)$/i.test(
        query.trim(),
      ))
  ) {
    // Sample across the whole video when it exceeds the request budget.
    const n = Math.min(all.length, Math.max(1, Math.floor(budget / 1000)));
    selected = Array.from(
      { length: n },
      (_, i) => all[Math.floor((i * all.length) / n)],
    );
  } else {
    // BM25: rare terms matter more, repetition saturates, long chunks are normalized.
    const documents = all.map((c) => normalize(c.text).split(" "));
    const avg =
      documents.reduce((n, d) => n + d.length, 0) /
      Math.max(1, documents.length);
    const df = new Map(
      words.map((w) => [w, documents.filter((d) => d.includes(w)).length]),
    );
    const ranked = all
      .map((c, i) => ({
        ...c,
        score: words.reduce((s, w) => {
          const tf = documents[i].filter((t) => t === w).length;
          const idf = Math.log(
            1 +
              (all.length - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5),
          );
          return (
            s +
            (idf * (tf * 2.2)) /
              (tf + 1.2 * (0.25 + (0.75 * documents[i].length) / (avg || 1)))
          );
        }, 0),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
    if (mode === "research") {
      const videos = new Set();
      const representatives = ranked.filter((c) => {
        if (videos.has(c.videoId)) return false;
        videos.add(c.videoId);
        return true;
      });
      const used = new Set(representatives.map((c) => c.id));
      selected = [
        ...representatives,
        ...ranked.filter((c) => !used.has(c.id)),
      ].slice(0, 16);
    } else selected = ranked.slice(0, 16);
  }
  let used = 0;
  return selected.filter((c) => {
    used += c.text.length;
    return used <= budget;
  });
}
export function evidenceBlock(evidence) {
  return evidence
    .map(
      (c, i) =>
        `[E${i + 1}] ${c.title} | ${time(c.startTime)} | ${c.kind}${c.role ? " | " + c.role : ""}${c.kind === "frame" ? ` | OCR of visible pixels, not a caption transcript${Number.isFinite(c.confidence) ? ` | OCR engine confidence ${Math.round(c.confidence)} (not factual accuracy)` : ""}` : ""}\n${c.text}`,
    )
    .join("\n\n");
}
export function batchEvidence(all, budget = 14000) {
  const batches = [];
  let group = [],
    size = 0;
  for (const c of all) {
    if (group.length && size + c.text.length > budget) {
      batches.push(group);
      group = [];
      size = 0;
    }
    group.push(c);
    size += c.text.length;
  }
  if (group.length) batches.push(group);
  return batches;
}
export function combineParts(parts) {
  if (parts.length === 1) return parts[0];
  let offset = 0;
  const evidence = [],
    claims = [],
    answers = [],
    alternatives = [];
  for (const p of [...parts].sort((a, b) => a.batchIndex - b.batchIndex)) {
    const shift = (text) =>
      String(text || "").replace(
        /\[E(\d+)\]/g,
        (_, n) => `[E${Number(n) + offset}]`,
      );
    answers.push(
      `## Section ${p.batchIndex + 1} · ${time(p.evidence[0]?.startTime || 0)}\n\n${shift(p.answer)}`,
    );
    alternatives.push(shift(p.alternative));
    claims.push(
      ...(p.verification?.claims || []).map((c) => ({
        ...c,
        refs: c.refs.map((r) => r + offset),
      })),
    );
    evidence.push(...p.evidence);
    offset += p.evidence.length;
  }
  const statuses = parts.map((p) => p.verification?.status || "unchecked");
  const status = statuses.includes("conflicting")
    ? "conflicting"
    : statuses.includes("unchecked")
      ? "unchecked"
      : statuses.includes("uncertain")
        ? "uncertain"
        : "supported";
  const last = parts.at(-1);
  return {
    ...last,
    id: last.jobId,
    answer: answers.join("\n\n---\n\n"),
    alternative: alternatives.join("\n\n---\n\n"),
    evidence,
    verification: {
      status,
      claims,
      reason:
        "Support checks were performed separately for every processed section.",
    },
    coverage: { selected: evidence.length, total: last.coverage.total },
    completedParts: parts.length,
  };
}
export function validateGraph(data, evidence) {
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges))
    throw new Error("Invalid graph response. Retry extraction.");
  const validRefs = (refs) =>
    Array.isArray(refs) &&
    refs.length &&
    refs.every((r) => Number.isInteger(r) && r >= 1 && r <= evidence.length);
  const nodes = data.nodes
    .slice(0, 40)
    .filter(
      (n) => typeof n.label === "string" && n.label.trim() && validRefs(n.refs),
    )
    .map((n) => ({
      id: normalize(n.label),
      label: n.label.trim().slice(0, 100),
      type: String(n.type || "concept").slice(0, 30),
      sources: n.refs.map((r) => evidence[r - 1]),
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = data.edges
    .slice(0, 100)
    .map((e) => ({
      source: normalize(e.source),
      target: normalize(e.target),
      relation: String(e.relation || "related").slice(0, 80),
      refs: e.refs,
    }))
    .filter((e) => ids.has(e.source) && ids.has(e.target) && validRefs(e.refs))
    .map((e) => ({
      ...e,
      id: JSON.stringify([e.source, e.target, normalize(e.relation)]),
      sources: e.refs.map((r) => evidence[r - 1]),
    }));
  return { nodes, edges };
}
export function validateVerdict(data, evidence) {
  const allowed = ["supported", "uncertain", "conflicting"];
  if (
    !allowed.includes(data.status) ||
    !Array.isArray(data.claims) ||
    !data.claims.length
  )
    throw new Error("Invalid SAGE response.");
  const claims = data.claims.map((c) => ({
    text: String(c.text || ""),
    verdict: allowed.includes(c.verdict) ? c.verdict : "uncertain",
    refs: (Array.isArray(c.refs) ? c.refs : []).filter(
      (r) => Number.isInteger(r) && r > 0 && r <= evidence.length,
    ),
  }));
  for (const c of claims)
    if (!c.refs.length && c.verdict === "supported") c.verdict = "uncertain";
  const status = claims.some((c) => c.verdict === "conflicting")
    ? "conflicting"
    : claims.every((c) => c.verdict === "supported")
      ? "supported"
      : "uncertain";
  return { status, claims, reason: String(data.reason || "") };
}
export function frameSignal(pixels, width, height) {
  let edges = 0,
    sum = 0,
    square = 0,
    n = 0;
  const gray = [];
  for (let y = 0; y < height; y += 4)
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4,
        v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      gray.push(v);
      sum += v;
      square += v * v;
      n++;
      if (
        x >= 4 &&
        Math.abs(v - (pixels[i - 16] + pixels[i - 15] + pixels[i - 14]) / 3) >
          35
      )
        edges++;
    }
  return {
    useful: edges / n > 0.035 && square / n - (sum / n) ** 2 > 180,
    fingerprint: gray.filter((_, i) => i % 16 === 0),
  };
}
export function frameDifference(a, b) {
  if (!a || a.length !== b.length) return Infinity;
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
}
