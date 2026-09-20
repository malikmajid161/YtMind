// ============================================================
//  Text Chunker — overlapping chunks for RAG.
//  500 tokens (~2000 chars), 3-segment overlap.
// ============================================================

export function chunkText(segments, { maxTokens = 500, overlap = 3 } = {}) {
  const maxChars = maxTokens * 4;

  // Split oversized segments first
  segments = segments.flatMap(seg => {
    if ((seg.text || '').length <= maxChars) return [seg];
    const words = seg.text.split(' ');
    const pieces = [];
    let buf = '';
    for (const w of words) {
      if ((buf + ' ' + w).length > maxChars) { pieces.push(buf); buf = w; }
      else buf = buf ? buf + ' ' + w : w;
    }
    if (buf) pieces.push(buf);
    const step = (seg.duration || 0) / pieces.length;
    return pieces.map((text, k) => ({ text, startTime: seg.startTime + step * k }));
  });

  const chunks = [];
  let i = 0;
  while (i < segments.length) {
    let text = '';
    const startTime = segments[i].startTime;
    let j = i;
    while (j < segments.length && text.length < maxChars) {
      text += (text ? ' ' : '') + segments[j].text;
      j++;
    }
    if (text.trim().length > 0) chunks.push({ text: text.trim(), startTime });
    i = Math.max(i + 1, j - overlap);
  }
  return chunks;
}
