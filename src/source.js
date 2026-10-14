const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;
export function youtubeVideoId(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  let id;
  if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  )
    id =
      url.pathname.match(
        /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/,
      )?.[1] || (url.pathname === "/watch" ? url.searchParams.get("v") : null);
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export function seconds(value) {
  const m = String(value).trim().match(clock);
  if (!m || Number(m[3]) >= 60 || (m[1] && Number(m[2]) >= 60))
    throw new Error("Invalid subtitle timestamp.");
  return (
    Number(m[1] || 0) * 3600 +
    Number(m[2]) * 60 +
    Number(m[3]) +
    Number((m[4] || "0").padEnd(3, "0")) / 1000
  );
}
export function validateSegments(input) {
  if (!Array.isArray(input) || !input.length || input.length > 20000)
    throw new Error("The transcript must contain 1–20,000 segments.");
  let characters = 0;
  const result = input.map((segment) => {
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    const startTime = segment.startTime ?? segment.start;
    if (
      !text ||
      text.length > 4000 ||
      !Number.isFinite(startTime) ||
      startTime < 0 ||
      startTime > 604800
    )
      throw new Error("Transcript segments need text and a valid timestamp.");
    characters += text.length;
    return { text, startTime };
  });
  if (characters > 150000)
    throw new Error(
      "Transcript exceeds 150,000 characters. Import a shorter section.",
    );
  return result.sort((a, b) => a.startTime - b.startTime);
}
export function parseTranscript(value) {
  const text = String(value)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!text || text.length > 180000)
    throw new Error("Choose a non-empty transcript under 180,000 characters.");
  if (/^[\[{]/.test(text)) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Transcript JSON is invalid.");
    }
    return validateSegments(
      Array.isArray(data) ? data : data.segments || data.transcript,
    );
  }
  if (text.includes("-->")) {
    const segments = [];
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split("\n");
      const i = lines.findIndex((line) => line.includes("-->"));
      if (i < 0) continue;
      const [start, end] = lines[i]
        .split("-->")
        .map((v) => v.trim().split(/\s/)[0]);
      const startTime = seconds(start);
      if (seconds(end) < startTime)
        throw new Error("Subtitle end precedes its start.");
      const caption = lines
        .slice(i + 1)
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .trim();
      if (caption) segments.push({ text: caption, startTime });
    }
    return validateSegments(segments);
  }
  const segments = text.split(/\n+/).map((line) => {
    const m = line.match(
      /^\[?((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]?\s+(.+)$/,
    );
    return m
      ? { text: m[2], startTime: seconds(m[1]) }
      : { text: line, startTime: 0 };
  });
  return validateSegments(segments);
}
