export function sourceTimeline(session, frames = []) {
  return [
    ...(session?.transcript || []).map((s, i) => ({
      id: `speech-${i}`,
      time: s.startTime,
      text: s.text,
      kind: "Speech",
      videoId: session.id,
    })),
    ...frames.map((f) => ({
      id: f.id,
      time: f.timestamp,
      text: f.ocrText || "No readable text captured in this frame.",
      kind: "Frame",
      videoId: session.id,
    })),
  ]
    .filter(
      (m) =>
        Number.isFinite(m.time) && m.time >= 0 && typeof m.text === "string",
    )
    .sort((a, b) => a.time - b.time);
}
