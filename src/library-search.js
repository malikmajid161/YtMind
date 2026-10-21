const normalize = (s) =>
  String(s || "")
    .normalize("NFKC")
    .toLocaleLowerCase();
export function searchLibrary(sessions, query) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return sessions.flatMap((session) => {
    const entries = [
      { kind: "Video title", text: session.title || "" },
      { kind: "My notebook", text: session.personalNotes || "" },
      ...(session.bookmarks || []).map((b) => ({
        kind: "Saved moment",
        text: b.label,
        timestamp: b.timestamp,
      })),
      ...(session.transcript || []).map((s) => ({
        kind: "Transcript",
        text: s.text,
        timestamp: s.startTime,
      })),
      ...(session.outputs || []).map((o) => ({
        kind: "Saved answer",
        text: o.answer || "",
      })),
    ];
    const combined = normalize(entries.map((e) => e.text).join(" "));
    if (!terms.every((t) => combined.includes(t))) return [];
    const best =
      entries.find(
        (e) =>
          terms.length && terms.every((t) => normalize(e.text).includes(t)),
      ) ||
      entries.find((e) => terms.some((t) => normalize(e.text).includes(t))) ||
      entries[0];
    const position = Math.max(0, normalize(best.text).indexOf(terms[0] || ""));
    const start = Math.max(0, position - 65);
    return [
      {
        videoId: session.id,
        kind: best.kind,
        timestamp: best.timestamp,
        excerpt:
          (start ? "…" : "") +
          best.text.slice(start, start + 230) +
          (best.text.length > start + 230 ? "…" : ""),
      },
    ];
  });
}
