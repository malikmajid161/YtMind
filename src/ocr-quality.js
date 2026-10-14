const normalize = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();
export function readableOCR(text, context = text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const code =
    /\b(?:const|let|var|function|def|class|import|return|print|console)\b|[\p{L}_][\p{L}\p{N}_]*\s*(?:=|\+=|-=|\(|\.)/u;
  const codeContext = code.test(String(context || ""));
  return value.split(/\r?\n/).some((line) => {
    const clean = line.trim();
    if (code.test(clean) || (codeContext && /^[{}()[\];,]+$/.test(clean)))
      return true;
    const words = clean.match(/[\p{L}\p{M}]+/gu) || [];
    const meaningful = words.filter((word) => [...word].length >= 2);
    const characters = clean.replace(/\s/g, "");
    const letters = characters.match(/[\p{L}\p{M}\p{N}]/gu) || [];
    return (
      meaningful.length > 0 &&
      meaningful.length >= words.length / 2 &&
      letters.length / Math.max(1, characters.length) >= 0.6
    );
  });
}
export function assessOCR(data, minimum = 60) {
  const rawText = String(data.text || "");
  const lines = (data.blocks || []).flatMap((block) =>
    (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []),
  );
  const scores = new Map(
    lines.map((line) => [
      normalize(
        line.text || (line.words || []).map((word) => word.text).join(" "),
      ),
      Number(line.confidence),
    ]),
  );
  const accepted = [],
    uncertain = [];
  for (const text of rawText.split(/\r?\n/)) {
    if (!text.trim()) continue;
    const confidence =
      scores.get(normalize(text)) ?? Number(data.confidence || 0);
    if (confidence >= minimum && readableOCR(text, rawText))
      accepted.push({ text, confidence });
    else
      uncertain.push({
        text,
        confidence,
        reason: confidence < minimum ? "low-confidence" : "fragmented-text",
      });
  }
  return {
    text: accepted.map((line) => line.text).join("\n"),
    rawText,
    confidence: accepted.length
      ? accepted.reduce((sum, line) => sum + line.confidence, 0) /
        accepted.length
      : 0,
    overallConfidence: Number(data.confidence || 0),
    uncertainLines: uncertain,
  };
}

export const cleanOCRText = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .filter((line) => readableOCR(line, text))
    .join("\n");
