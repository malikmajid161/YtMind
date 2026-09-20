// ============================================================
//  🤖 MODULE 2 — MALT (Multilingual Audio-Language Transcription)
//  Scores YouTube caption quality; if poor (low-resource langs
//  like Urdu), routes to Groq Whisper via tab-audio capture.
// ============================================================

import { groq } from '../utils/groq-client.js';

export class MALTAgent {

  // Score caption quality 0-1. Below threshold → needs Whisper.
  scoreCaptions(transcript, meta = {}) {
    if (!transcript?.length) return { score: 0, needsWhisper: true, reason: 'no captions' };

    const text = transcript.map(s => s.text).join(' ');
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 20) return { score: 0.2, needsWhisper: true, reason: 'too short' };

    let score = 1.0;
    const reasons = [];

    // Signal 1: script coherence
    const urduChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalScript = urduChars + devanagariChars + latinChars;

    // CRITICAL: Devanagari (Hindi) script on Urdu/Islamic content is a
    // classic YouTube auto-caption failure — the audio is Urdu but the
    // ASR transcribed it as Hindi. This is exactly what MALT fixes.
    if (totalScript > 0 && devanagariChars / totalScript > 0.15) {
      score -= 0.5;
      reasons.push('Devanagari (Hindi) captions on Urdu audio — Whisper needed');
    }

    // Hindi ASR track flagged by metadata
    if (meta.captionLang && /^hi|hindi/i.test(meta.captionLang)) {
      score -= 0.4;
      reasons.push('Hindi ASR track on likely-Urdu content');
    }

    // Signal 2: repetition of noise tokens (music markers)
    const noiseCount = (text.match(/\[music\]|\[موسیقی\]|موسیقی/gi) || []).length;
    if (noiseCount > words.length * 0.05) {
      score -= 0.2;
      reasons.push('high music-noise ratio');
    }

    // Signal 3: very low unique-word ratio → garbage
    const unique = new Set(words.map(w => w.toLowerCase())).size;
    const diversity = unique / words.length;
    if (diversity < 0.25) {
      score -= 0.2;
      reasons.push('low lexical diversity');
    }

    score = Math.max(0, Math.min(1, score));
    return {
      score: Math.round(score * 100) / 100,
      needsWhisper: score < 0.65,
      reason: reasons.join('; ') || 'captions look adequate',
    };
  }

  // Transcribe an audio blob via Groq Whisper
  async transcribeAudio(audioBlob, language = 'ur', offset = 0) {
    const data = await groq.transcribe(audioBlob, language);
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const transcript = segments
      .filter(s => s.text?.trim() && Number.isFinite(s.start))
      .map(s => ({ text: s.text.trim(), startTime: offset + Math.max(0, s.start) }));
    if (!transcript.length && data.text?.trim()) {
      transcript.push({ text: data.text.trim(), startTime: offset });
    }
    return transcript;
  }
}
