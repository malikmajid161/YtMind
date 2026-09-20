// ============================================================
//  🤖 MODULE 5 — KGMA (Knowledge Graph Memory Agent)
//  Builds a persistent cross-session concept graph in IndexedDB.
//  Extracts concepts per video, merges duplicates by similarity,
//  tracks which videos each concept appeared in.
// ============================================================

import { groq } from '../utils/groq-client.js';
import { embed, cosineSimilarity } from '../rag/embedder.js';

const MERGE_THRESHOLD = 0.85;

export class KGMAgent {
  constructor(vectorStore) {
    this.store = vectorStore;
  }

  // Extract concepts from a video and merge into the graph
  async ingestVideo({ videoId, title, chunks }) {
    const context = chunks.slice(0, 8).map(c => c.text).join('\n').slice(0, 5000);

    let extracted;
    try {
      const system = `Extract the top 8 key concepts from this video transcript.
For each concept: a short name, a one-sentence definition as stated in the video, and 1-3 related concept names.
Only extract concepts actually discussed. Respond ONLY with JSON:
{"concepts":[{"name":"...","definition":"...","related":["..."]}]}`;
      const result = await groq.chatJSON({
        system, user: `Transcript:\n${context}`,
        temperature: 0.2, maxTokens: 1000,
      });
      extracted = result.concepts || [];
    } catch (e) {
      console.warn('[KGMA] extraction failed:', e.message);
      return { added: 0, merged: 0 };
    }

    const existing = await this.store.getAllConcepts();
    let added = 0, merged = 0;

    for (const c of extracted) {
      if (!c.name) continue;
      const emb = await embed(c.name + ' ' + (c.definition || ''));

      // Find a similar existing concept
      let match = null, bestScore = 0;
      for (const e of existing) {
        if (!e.embedding) continue;
        const s = cosineSimilarity(emb, e.embedding);
        if (s > bestScore) { bestScore = s; match = e; }
      }

      if (match && bestScore >= MERGE_THRESHOLD) {
        // Merge: enrich sources + related
        if (!match.sources.some(s => s.videoId === videoId)) {
          match.sources.push({ videoId, title });
        }
        match.related = [...new Set([...(match.related || []), ...(c.related || [])])];
        match.lastSeen = Date.now();
        await this.store.addConcept(match);
        merged++;
      } else {
        // New node
        await this.store.addConcept({
          id: crypto.randomUUID(),
          name: c.name,
          definition: c.definition || '',
          related: c.related || [],
          sources: [{ videoId, title }],
          masteryScore: 0,
          lastSeen: Date.now(),
          embedding: emb,
        });
        existing.push({ name: c.name, embedding: emb, sources: [{ videoId }] });
        added++;
      }
    }

    return { added, merged };
  }

  // Answer "what do I know about X" across all videos
  async queryConcept(query) {
    const concepts = await this.store.getAllConcepts();
    if (!concepts.length) return null;
    const qEmb = await embed(query);
    const scored = concepts
      .map(c => ({ ...c, score: c.embedding ? cosineSimilarity(qEmb, c.embedding) : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return scored.filter(c => c.score > 0.2);
  }

  // Learning gaps: concepts with no edges into the main graph
  async detectGaps() {
    const concepts = await this.store.getAllConcepts();
    const names = new Set(concepts.map(c => c.name.toLowerCase()));
    const isolated = concepts.filter(c =>
      !(c.related || []).some(r => names.has(r.toLowerCase()))
    );
    return isolated.map(c => c.name);
  }
}
