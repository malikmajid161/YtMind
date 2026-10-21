import { readingURL } from "./web-history.js";
export function pageEvidence(page) {
  const url = readingURL(page?.url);
  if (!url || !(page.capturedText || page.text)?.trim()) return [];
  const out = [];
  let text = page.capturedText || page.text;
  if (page.activities?.length)
    text +=
      "\n\nRECORDED BROWSING ACTIVITY (user actions, not website claims):\n" +
      page.activities
        .map((a) => `${new Date(a.at).toISOString()} ${a.kind}: ${a.label}`)
        .join("\n");
  while (text.length) {
    let cut = text.length > 1600 ? text.lastIndexOf(" ", 1600) : text.length;
    if (cut < 600) cut = Math.min(text.length, 1600);
    const piece = text.slice(0, cut).trim();
    if (piece)
      out.push({
        id: `${page.id}:text:${out.length}`,
        videoId: page.id,
        title: page.title,
        url,
        kind: "page",
        startTime: 0,
        text: piece,
      });
    text = text.slice(cut).trimStart();
  }
  return out;
}
export function sourceURL(source) {
  if (source.kind === "page" || source.videoId?.startsWith("page:"))
    return readingURL(source.url || source.videoId.slice(5)) || "";
  if (!/^[\w-]{11}$/.test(source.videoId || "")) return "";
  return `https://www.youtube.com/watch?v=${source.videoId}&t=${Math.floor(source.startTime || 0)}s`;
}
export function isYouTubeSite(value) {
  try {
    const host = new URL(value).hostname;
    return host === "youtube.com" || host.endsWith(".youtube.com");
  } catch {
    return false;
  }
}
