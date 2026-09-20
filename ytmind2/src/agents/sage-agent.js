// ============================================================
//  🤖 MODULE 3 — SAGE (Self-Aware Generation Evaluator)
//  The core research contribution: verifies each generated
//  claim against the RETRIEVED evidence chunks (not just the
//  model's own words). Returns per-claim verdicts:
//    SOURCE-GROUNDED | INSUFFICIENT-EVIDENCE | CONTRADICTED
//  Uses semantic claim chunking + dynamic coreference window.
// ============================================================

import { groq, VERIFIER_MODEL } from '../utils/groq-client.js';

const PRONOUNS = /\b(it|its|they|them|their|this|these|that|those|he|she|his|her)\b|یہ|وہ|اس|ان|اسے|انہیں|اس کا|اس کی|ان کا/i;

export class SAGEAgent {

  /**
   * Verify an answer against retrieved chunks.
   * @param {string} answer - the generated answer text
   * @param {Array<{text,startTime,videoTitle}>} chunks - retrieved evidence
   * @returns {Promise<{overall, score, claims:[{text,verdict,confidence,chunkRefs}]}>}
   */
  async verify(answer, chunks) {
    if (!answer || !chunks?.length) {
      return { overall: 'INSUFFICIENT-EVIDENCE', score: 0, claims: [] };
    }

    // 1. Split answer into semantic claims (~1.5-2 sentences)
    const claims = this._chunkClaims(answer);

    // 2. Build evidence block once
    const evidence = chunks.slice(0, 6).map((c, i) =>
      `[Chunk ${i + 1} | ${this._time(c.startTime)}]: ${c.text}`
    ).join('\n');

    // 3. Verify each claim (with coreference context)
    const verified = [];
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      // Dynamic coreference window: include preceding claims if pronoun present
      const needsContext = PRONOUNS.test(claim);
      const windowSize = needsContext ? 3 : 1;
      const context = claims.slice(Math.max(0, i - windowSize), i).join(' ');

      try {
        const v = await this._verifyClaim(claim, context, evidence);
        verified.push({ text: claim, ...v });
      } catch (e) {
        verified.push({
          text: claim, verdict: 'INSUFFICIENT-EVIDENCE',
          confidence: 0, chunkRefs: [], error: e.message,
        });
      }
    }

    // 4. Aggregate
    const grounded = verified.filter(v => v.verdict === 'SOURCE-GROUNDED').length;
    const contradicted = verified.filter(v => v.verdict === 'CONTRADICTED').length;
    const score = verified.length ? grounded / verified.length : 0;

    let overall = 'SOURCE-GROUNDED';
    if (contradicted > 0) overall = 'CONTRADICTED';
    else if (score < 0.6) overall = 'INSUFFICIENT-EVIDENCE';

    return { overall, score: Math.round(score * 100) / 100, claims: verified };
  }

  // ── Semantic claim chunking (~1.5-2 sentences per unit) ──
  _chunkClaims(text) {
    // Remove the "Sources used" footer if present
    const clean = text.replace(/\n?Sources? used:[^\n]*/gi, '').trim();
    // Split on sentence boundaries (Urdu + Latin)
    const sentences = clean
      .split(/(?<=[۔.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    const claims = [];
    for (let i = 0; i < sentences.length; i += 2) {
      // Group ~2 sentences into one claim unit
      const unit = sentences.slice(i, i + 2).join(' ');
      if (unit.length > 3) claims.push(unit);
    }
    return claims.length ? claims : [clean];
  }

  async _verifyClaim(claim, context, evidence) {
    const system = `You are SAGE, a fact-verification agent for YTMind.
Check whether a CLAIM is supported by the EVIDENCE chunks from a video transcript.
The transcript and claim may be in Urdu, English, or mixed — judge meaning, not exact words.
You verify SOURCE-GROUNDING (is the idea present in the transcript?), NOT absolute truth.

Be reasonable, not overly strict:
- SOURCE-GROUNDED: the evidence supports the claim's meaning, even if worded differently, transliterated, or paraphrased. Combining chunks is fine.
- INSUFFICIENT-EVIDENCE: the transcript genuinely does not mention this topic at all.
- CONTRADICTED: a chunk clearly states the opposite.
- A summary claim that captures the overall theme of the evidence IS source-grounded.
- Use CONTEXT only to resolve pronouns.

Respond ONLY with JSON:
{"verdict":"SOURCE-GROUNDED|INSUFFICIENT-EVIDENCE|CONTRADICTED","confidence":0.0-1.0,"chunkRefs":[1,2]}`;

    const user = `EVIDENCE:\n${evidence}\n\n${context ? `CONTEXT (for pronouns only): ${context}\n\n` : ''}CLAIM TO VERIFY: ${claim}`;

    const result = await groq.chatJSON({
      system, user, model: VERIFIER_MODEL,
      temperature: 0.1, maxTokens: 120,
    });

    return {
      verdict: result.verdict || 'INSUFFICIENT-EVIDENCE',
      confidence: result.confidence ?? 0.5,
      chunkRefs: Array.isArray(result.chunkRefs) ? result.chunkRefs : [],
    };
  }

  _time(seconds) {
    const m = Math.floor((seconds || 0) / 60);
    const s = Math.floor((seconds || 0) % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
