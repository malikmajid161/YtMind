// ============================================================
//  🤖 MODULE 1 — ACTA (Adaptive Content-Type Agent)
//  Classifies the video genre so downstream agents can adapt.
//  Two-stage: fast local heuristic, then LLM confirmation.
//  Genres: LECTURE, KALAM, TUTORIAL, DOCUMENTARY, DEBATE
// ============================================================

import { groq, VERIFIER_MODEL } from '../utils/groq-client.js';

const GENRES = ['LECTURE', 'KALAM', 'TUTORIAL', 'DOCUMENTARY', 'DEBATE'];

// Kalam-specific markers. Deliberately EXCLUDE common greetings
// (salam, bismillah, allah) that also appear in lecture intros.
const KALAM_MARKERS_ROMAN = [
  'nabi', 'rasool', 'mustafa', 'huzoor', 'madina',
  'darood', 'naat', 'sarkar', 'shafaat', 'kalam', 'kalaam',
  'balaghal', 'ula', 'kamaalihi', 'sallu', 'hamd', 'manqabat',
  'ya rasool', 'ya nabi', 'sallallah', 'baghair', 'talab',
];
const KALAM_MARKERS_URDU = [
  'حضور', 'نبی', 'رسول', 'مصطفی', 'مدینہ', 'درود', 'نعت',
  'سرکار', 'شفاعت', 'یا رسول', 'یا نبی', 'صلی اللہ علیہ',
  'مکہ', 'کعبہ', 'روضہ', 'حبیب', 'ماہِ', 'شافع',
];
const LECTURE_MARKERS = [
  'definition', 'example', 'therefore', 'concept', 'theory',
  'equation', 'formula', 'chapter', 'slide', 'lecture',
  'introduction', 'topic', 'subject', 'learn', 'understand', 'study',
  'تعریف', 'مثال', 'لیکچر', 'باب', 'تصور', 'انٹرڈکشن', 'ٹاپک',
  'کانسپٹ', 'سائیکالوجی', 'سٹڈی', 'پڑھنا', 'پڑھیں', 'سمجھ', 'سٹوڈنٹ',
  'نمبر', 'کمپلسری', 'فنکشن',
];
const TUTORIAL_MARKERS = [
  'click', 'install', 'download', 'open', 'type', 'select',
  'run', 'execute', 'copy', 'paste', 'configure', 'recipe',
  'add', 'mix', 'cook', 'cup', 'oil', 'heat', 'pan',
  'ڈالیں', 'ملائیں', 'بنائیں', 'شامل', 'ڈال', 'پکائیں', 'کپ',
  'تیل', 'گرم', 'پین', 'ریسپی', 'چمچ', 'مصالحہ', 'ہیٹ', 'پوٹ',
];
const DOCUMENTARY_MARKERS = [
  'year', 'century', 'history', 'war', 'government', 'country',
  'population', 'percent', 'million', 'according to',
  'تاریخ', 'صدی', 'حکومت', 'ملک', 'جنگ', 'ریاست', 'فیصد',
  'مہاراجہ', 'کشمیر', 'گلگت', 'انڈیا', 'پاکستان', 'علاقے',
  'بغاوت', 'الحاق', 'سرحد', 'پہاڑوں', 'قدرت',
];
const DEBATE_MARKERS = [
  'disagree', 'opponent', 'however', 'counterpoint',
  'اختلاف', 'مخالف', 'جواب میں', 'دلیل',
];

export class ACTAgent {

  /**
   * Classify a transcript into a genre.
   * @param {Array<{text,startTime}>} transcript
   * @returns {Promise<{genre, confidence, method, scores}>}
   */
  async classify(transcript, title = '') {
    // Title carries strong genre signals (e.g. "Naat", "Balaghal Ula",
    // "Lecture", "Recipe"). Weight it by repeating it into the sample.
    const earlyText = (title + ' ' + title + ' ' + this._firstMinute(transcript)).trim();

    // Stage 1: heuristic
    const scores = this._heuristicScore(earlyText);
    const best = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    const confidence = scores[best];

    const result = { genre: best, confidence, method: 'heuristic', scores };

    // Stage 2: LLM confirmation if uncertain
    if (confidence < 0.75) {
      try {
        const llm = await this._llmClassify(earlyText);
        if (llm && GENRES.includes(llm.genre)) {
          return { ...llm, method: 'llm', heuristicScores: scores };
        }
      } catch (e) {
        console.warn('[ACTA] LLM classify failed, using heuristic:', e.message);
      }
    }

    return result;
  }

  _firstMinute(transcript) {
    let text = '';
    for (const seg of transcript) {
      if (seg.startTime > 60 && text.length > 500) break;
      text += ' ' + (seg.text || '');
      if (text.length > 2000) break;
    }
    return text.trim();
  }

  _heuristicScore(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const scores = { LECTURE: 0, KALAM: 0, TUTORIAL: 0, DOCUMENTARY: 0, DEBATE: 0 };
    if (!words.length) return { ...scores, LECTURE: 0.2 };

    // Feature: kalam proper-noun density (needs multiple distinct hits)
    let kalamHits = 0;
    for (const m of KALAM_MARKERS_ROMAN) if (lower.includes(m)) kalamHits++;
    for (const m of KALAM_MARKERS_URDU) kalamHits += (text.split(m).length - 1);
    // Require a real cluster of devotional terms, not just one
    if (kalamHits >= 2) scores.KALAM += Math.min(kalamHits * 0.15, 0.7);

    // Feature: verse repetition (kalam refrains repeat heavily)
    const sentences = text.split(/[۔.!?\n]+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 3) {
      const firstWords = sentences.map(s => s.split(/\s+/)[0]);
      const unique = new Set(firstWords).size;
      const repetition = 1 - unique / sentences.length;
      // Only strong repetition (>0.4) signals kalam; weight lower
      if (repetition > 0.4) scores.KALAM += (repetition - 0.4) * 0.4;
    }

    // Keyword matching
    const count = (markers) => markers.reduce((n, m) => n + (lower.includes(m) ? 1 : 0), 0);
    scores.LECTURE += Math.min(count(LECTURE_MARKERS) * 0.08, 0.7);
    scores.TUTORIAL += Math.min(count(TUTORIAL_MARKERS) * 0.08, 0.7);
    scores.DOCUMENTARY += Math.min(count(DOCUMENTARY_MARKERS) * 0.08, 0.7);
    scores.DEBATE += Math.min(count(DEBATE_MARKERS) * 0.1, 0.5);

    // Feature: dates → documentary
    const dates = (text.match(/\b(19|20)\d{2}\b/g) || []).length;
    if (dates >= 2) scores.DOCUMENTARY += 0.3;

    // Feature: imperative density → tutorial
    if (count(TUTORIAL_MARKERS) > 3) scores.TUTORIAL += 0.25;

    // Baseline: if nothing else fires strongly, lean LECTURE (safe default)
    if (Math.max(...Object.values(scores)) < 0.15) scores.LECTURE += 0.2;

    // Normalize
    const max = Math.max(...Object.values(scores)) || 1;
    for (const g of GENRES) scores[g] = Math.round((scores[g] / max) * 1000) / 1000;

    return scores;
  }

  async _llmClassify(text) {
    const system = `You are a YouTube video genre classifier. Classify the transcript into EXACTLY ONE genre:
- LECTURE: academic/educational teaching with definitions and explanations
- KALAM: Islamic devotional poetry/naat/nasheed with religious proper nouns and refrains
- TUTORIAL: step-by-step instructions (cooking, software, how-to)
- DOCUMENTARY: historical/journalistic narrative with dates, facts, places
- DEBATE: multiple speakers with opposing viewpoints
Respond ONLY with JSON: {"genre":"...","confidence":0.0-1.0,"reasoning":"one sentence"}`;

    const user = `Transcript:\n${text.slice(0, 2000)}`;

    const result = await groq.chatJSON({
      system, user, model: VERIFIER_MODEL,
      temperature: 0.1, maxTokens: 150,
    });

    return {
      genre: result.genre,
      confidence: result.confidence ?? 0.8,
      reasoning: result.reasoning || '',
    };
  }
}
