// Wait for navigation/captions to settle; attempt each captionless Short once
// per workspace lifetime. Manual retry remains available after failures.
export function createShortsFollower({
  now = Date.now,
  ingest,
  health,
  current = () => true,
}) {
  const seen = new Map();
  const attempted = new Set();
  return async function follow({ videoId, isShort, session, busy, settings }) {
    if (!videoId || !isShort || !session) return;
    if (!seen.has(videoId)) seen.set(videoId, now());
    if (
      busy ||
      !(settings.hasApiKey || settings.apiKey) ||
      session.transcript?.length ||
      attempted.has(videoId) ||
      now() - seen.get(videoId) < 5000
    )
      return;
    attempted.add(videoId);
    const status = await health();
    if (!status?.ready || !status?.paired)
      throw new Error(
        "Automatic Short transcription needs the paired local audio helper on port 4175. Start it, then retry generating notes.",
      );
    if (!current(videoId)) return;
    await ingest(
      videoId,
      settings.audioLanguage || "",
      settings.autoNotes ? "notes" : null,
    );
  };
}
