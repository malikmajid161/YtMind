// ============================================================
//  Groq Client — Centralized LLM + Whisper API access
//  All modules use this. Handles model fallback, retries,
//  rate limits, and settings.
// ============================================================

const GROQ_BASE = 'https://api.groq.com/openai/v1';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const VERIFIER_MODEL = 'llama-3.1-8b-instant';   // smaller/faster for SAGE
const WHISPER_MODEL = 'whisper-large-v3-turbo';

export class GroqClient {

  async getSettings() {
    const r = await chrome.storage.local.get([
      'ytmind_api_key', 'ytmind_model', 'ytmind_length', 'ytmind_lang'
    ]);
    return {
      apiKey: r.ytmind_api_key || null,
      model: r.ytmind_model || DEFAULT_MODEL,
      length: r.ytmind_length || 'normal',
      lang: r.ytmind_lang || 'auto',
    };
  }

  // ── Chat completion with automatic retry + model fallback ──
  async chat({ system, user, model, temperature = 0.3, maxTokens = 600, json = false }, attempt = 0, modelChanged = false) {
    const settings = await this.getSettings();
    const apiKey = settings.apiKey;
    if (!apiKey) throw new Error('NO_API_KEY');

    const useModel = model || settings.model;

    const body = {
      model: useModel,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    };
    if (json) body.response_format = { type: 'json_object' };

    const response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || 'Groq API error';

      // Prompt too long → retry with fewer tokens
      if (/context.?length|too long|maximum context|request too large|reduce.*length/i.test(msg) && attempt < 2) {
        return this.chat({ system, user, model, temperature, maxTokens: Math.floor(maxTokens * 0.5), json }, attempt + 1, modelChanged);
      }

      // Model unavailable → pick a fallback model
      if (/does not exist|do not have access|decommissioned|model_not_found/i.test(msg) && !modelChanged) {
        const fallback = await this._pickModel(apiKey);
        if (fallback) {
          await chrome.storage.local.set({ ytmind_model: fallback });
          return this.chat({ system, user, model: fallback, temperature, maxTokens, json }, attempt, true);
        }
      }

      if (response.status === 429 || /rate limit|tokens per minute|TPM/i.test(msg)) {
        throw new Error('RATE_LIMIT');
      }
      if (/invalid api key|unauthorized|401/i.test(msg)) {
        throw new Error('INVALID_KEY');
      }
      throw new Error(msg);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');
    return content;
  }

  // ── Convenience: get parsed JSON from the model ──
  async chatJSON(opts) {
    const raw = await this.chat({ ...opts, json: true });
    try {
      return JSON.parse(raw);
    } catch {
      // Some models wrap JSON in markdown fences
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }

  // ── Whisper transcription (for MALT audio path) ──
  async transcribe(audioBlob, language = 'ur') {
    const settings = await this.getSettings();
    if (!settings.apiKey) throw new Error('NO_API_KEY');

    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('model', WHISPER_MODEL);
    form.append('language', language);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const response = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const status = response.status;
      const messages = {
        401: 'INVALID_KEY',
        413: 'AUDIO_TOO_LARGE',
        429: 'RATE_LIMIT',
      };
      throw new Error(messages[status] || `Transcription failed (HTTP ${status})`);
    }

    return response.json();
  }

  // ── Get a working model from the user's key ──
  async _pickModel(apiKey) {
    try {
      const res = await fetch(`${GROQ_BASE}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) return null;
      const { data = [] } = await res.json();
      const chat = data
        .map(m => m.id)
        .filter(id => !/whisper|tts|guard|embed|vision/i.test(id));
      const preferred = [
        /^llama-3\.3-70b/, /^llama-3\.1-8b/, /gpt-oss-120b/,
        /gpt-oss-20b/, /^llama/, /^qwen/, /^gemma/,
      ];
      for (const rx of preferred) {
        const hit = chat.find(id => rx.test(id));
        if (hit) return hit;
      }
      return chat[0] || null;
    } catch {
      return null;
    }
  }
}

export const groq = new GroqClient();
export { DEFAULT_MODEL, VERIFIER_MODEL, WHISPER_MODEL };
