// ============================================================
//  🤖 Orchestrator — the master agent.
//  Routes a user query: Intent → Retrieval → Generation → SAGE.
//  Also handles quiz (GAIA) and argument-map (ARIA) intents.
// ============================================================

import { IntentAgent } from './intent-agent.js';
import { RetrievalAgent } from './retrieval-agent.js';
import { GenerationAgent } from './generation-agent.js';
import { SAGEAgent } from './sage-agent.js';
import { GAIAgent } from './gaia-agent.js';
import { ARIAgent } from './aria-agent.js';
import { KGMAgent } from './kgma-agent.js';
import { VectorStore } from '../rag/vector-store.js';

export class Orchestrator {
  constructor() {
    this.store = new VectorStore();
    this.intent = new IntentAgent();
    this.retrieval = new RetrievalAgent(this.store);
    this.generation = new GenerationAgent();
    this.sage = new SAGEAgent();
    this.gaia = new GAIAgent();
    this.aria = new ARIAgent();
    this.kgma = new KGMAgent(this.store);
  }

  /**
   * Handle a user query end to end.
   * @param {string} query
   * @param {string} currentVideoId
   * @param {function} onProgress - optional status callback
   * @returns {Promise<{type, answer?, verification?, quiz?, argmap?}>}
   */
  async handle(query, currentVideoId, onProgress = () => {}) {
    const intent = this.intent.run(query);

    // ── Quiz (GAIA) ──
    if (intent.type === 'quiz') {
      onProgress('Generating quiz...');
      const video = await this.store.getVideo(currentVideoId);
      if (!video) return { type: 'error', message: 'Open and index a video first.' };
      const settings = await import('../utils/groq-client.js').then(m => m.groq.getSettings());
      const quiz = await this.gaia.generateQuiz(video.chunks, settings.lang);
      return { type: 'quiz', quiz };
    }

    // ── Argument map (ARIA) ──
    if (intent.type === 'argmap') {
      onProgress('Extracting argument structure...');
      const video = await this.store.getVideo(currentVideoId);
      if (!video) return { type: 'error', message: 'Open and index a video first.' };
      const argmap = await this.aria.extractArguments(video.transcript);
      return { type: 'argmap', argmap };
    }

    // ── Cross-video "what do I know about X" (KGMA) ──
    if (/what do i know|what have i learned|concept/i.test(query)) {
      const concepts = await this.kgma.queryConcept(query);
      if (concepts?.length) {
        return { type: 'kgma', concepts };
      }
      // else fall through to normal retrieval
    }

    // ── Question / Summary / Comparison ──
    onProgress('Searching transcript...');
    const { chunks } = await this.retrieval.run({
      query, currentVideoId, strategy: intent.retrieval,
    });

    if (!chunks?.length) {
      return { type: 'answer', answer: 'No transcript content found for this. Try reopening the video or using Audio → Text.', verification: null };
    }

    const video = await this.store.getVideo(currentVideoId);
    const genre = video?.genre || 'LECTURE';

    onProgress('Generating answer...');
    const answer = await this.generation.run({
      query, intent, chunks,
      currentVideoTitle: video?.title,
      genre,
    });

    // ── SAGE verification (parallel-safe, runs after generation) ──
    onProgress('Verifying against sources...');
    let verification = null;
    try {
      verification = await this.sage.verify(answer, chunks);
    } catch (e) {
      console.warn('[Orchestrator] SAGE failed:', e.message);
    }

    return { type: 'answer', answer, verification, genre };
  }
}
