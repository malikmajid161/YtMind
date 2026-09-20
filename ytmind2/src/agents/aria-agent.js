// ============================================================
//  🤖 MODULE 7 — ARIA (Argument & Reasoning Intelligence Agent)
//  Extracts claims, evidence, counterarguments, rebuttals from
//  debate/documentary content. Distinguishes quoted vs endorsed
//  claims for correct speaker attribution.
// ============================================================

import { groq } from '../utils/groq-client.js';

export class ARIAgent {

  /**
   * Extract argument structure from transcript.
   * @param {Array<{text,startTime}>} transcript
   * @returns {Promise<{arguments:[...]}>}
   */
  async extractArguments(transcript) {
    if (!transcript?.length) throw new Error('No transcript to analyze.');

    const text = transcript.map(s =>
      `[${this._time(s.startTime)}] ${s.text}`
    ).join('\n').slice(0, 8000);

    const system = `You are ARIA, an argument-mapping agent.
Analyze the transcript and extract its argument structure.

IMPORTANT — speaker attribution:
- Distinguish claims a speaker ENDORSES vs claims they QUOTE from an opponent.
- "My opponent says X, but X is wrong" → X is NOT the speaker's endorsed claim.

For each main claim, provide:
- claim: the assertion
- speaker: who said it (or "unknown")
- isEndorsed: true if the speaker supports it, false if quoted to reject
- evidence: [{text, timestamp}] supporting facts
- counterarguments: [{text, timestamp}] opposing points raised
- rebuttals: [{text, timestamp}] responses to counterarguments

Only extract content actually present in the transcript. Include timestamps.

Respond ONLY with JSON:
{"arguments":[{"claim":"...","speaker":"...","isEndorsed":true,"evidence":[{"text":"...","timestamp":"3:20"}],"counterarguments":[],"rebuttals":[]}]}`;

    const user = `Transcript:\n${text}`;

    const result = await groq.chatJSON({
      system, user,
      temperature: 0.3, maxTokens: 2000,
    });

    return { arguments: result.arguments || [] };
  }

  _time(seconds) {
    const m = Math.floor((seconds || 0) / 60);
    const s = Math.floor((seconds || 0) % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
