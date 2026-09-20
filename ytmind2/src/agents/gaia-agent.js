// ============================================================
//  🤖 MODULE 6 — GAIA (Gamified Assessment & Interaction Agent)
//  Generates quizzes and games from video content.
//  Every question is grounded in a transcript excerpt.
// ============================================================

import { groq } from '../utils/groq-client.js';

export class GAIAgent {

  /**
   * Generate a quiz from retrieved chunks.
   * @param {Array<{text,startTime}>} chunks
   * @param {string} lang - 'auto'|'english'|'urdu'
   * @returns {Promise<{questions:[...]}>}
   */
  async generateQuiz(chunks, lang = 'auto') {
    if (!chunks?.length) throw new Error('No content to generate quiz from.');

    const context = chunks.slice(0, 8).map((c, i) =>
      `[${this._time(c.startTime)}] ${c.text}`
    ).join('\n');

    const langRule = {
      auto: 'Write questions in the same language as the transcript.',
      english: 'Write all questions in English.',
      urdu: 'Write all questions in Urdu (اردو).',
    }[lang] || 'Match the transcript language.';

    const system = `You are GAIA, a quiz generator for educational videos.
Generate 5 multiple-choice questions from the transcript.
${langRule}

Rules:
- Questions must be answerable ONLY from the transcript content
- Every question needs an "evidence" field: the exact transcript excerpt supporting the answer
- Include a "timestamp" for where the answer is found
- 4 options each, exactly one correct
- Mix difficulty: 2 easy, 2 medium, 1 hard
- Distractors must be plausible but clearly wrong per the transcript
- Never create ambiguous questions with two correct answers

Respond ONLY with JSON:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"difficulty":"easy","timestamp":"2:30","evidence":"exact transcript excerpt"}]}`;

    const user = `Transcript:\n${context.slice(0, 6000)}`;

    const result = await groq.chatJSON({
      system, user,
      temperature: 0.4, maxTokens: 1500,
    });

    // Validate each question
    const questions = (result.questions || [])
      .filter(q => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map(q => ({
        question: q.question,
        options: q.options,
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        difficulty: q.difficulty || 'medium',
        timestamp: q.timestamp || '',
        evidence: q.evidence || '',
      }));

    if (!questions.length) throw new Error('Could not generate valid quiz questions.');
    return { questions };
  }

  _time(seconds) {
    const m = Math.floor((seconds || 0) / 60);
    const s = Math.floor((seconds || 0) % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
