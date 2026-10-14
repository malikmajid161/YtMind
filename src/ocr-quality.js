const normalize = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();
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
    if (confidence >= minimum) accepted.push({ text, confidence });
    else uncertain.push({ text, confidence });
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
