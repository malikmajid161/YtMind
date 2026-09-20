// ============================================================
//  🤖 Ingestion Agent — indexes a video end-to-end.
//  Pipeline: fetch transcript → MALT quality check → chunk →
//  embed → store → ACTA genre → KGMA concept extraction.
// ============================================================

import { TranscriptFetcher } from '../utils/transcript-fetcher.js';
import { chunkText } from '../utils/chunker.js';
import { VectorStore } from '../rag/vector-store.js';
import { embed } from '../rag/embedder.js';
import { SessionManager } from '../utils/session-manager.js';
import { ACTAgent } from './acta-agent.js';
import { MALTAgent } from './malt-agent.js';
import { KGMAgent } from './kgma-agent.js';

export class IngestionAgent {
  constructor() {
    this.store = new VectorStore();
    this.session = new SessionManager();
    this.acta = new ACTAgent();
    this.malt = new MALTAgent();
    this.kgma = new KGMAgent(this.store);
  }

  async run(videoId) {
    await this.session.ensureActive();

    const cached = await this.store.hasVideo(videoId);
    if (cached) {
      const meta = await this.store.getVideoMeta(videoId);
      return { title: meta.title, genre: meta.genre, chunkCount: meta.chunkCount, cached: true };
    }

    const fetcher = new TranscriptFetcher();
    const { title, channel, transcript, needsAudio, captionLang } = await fetcher.fetch(videoId);

    if (needsAudio || !transcript.length) {
      return { title, needsAudio: true };
    }

    // MALT quality check
    const quality = this.malt.scoreCaptions(transcript, { captionLang });

    const result = await this.storeTranscript({
      videoId, title, channel, transcript,
      source: 'captions', captionQuality: quality,
    });

    // Tell the UI captions are low quality so it can suggest Audio→Text
    result.lowQualityCaptions = quality.needsWhisper;
    result.qualityReason = quality.reason;
    return result;
  }

  async storeTranscript({ videoId, title, channel, transcript, source = 'captions', captionQuality = null }) {
    await this.session.ensureActive();

    // Merge audio transcript with any existing
    if (source === 'audio') {
      const prev = await this.store.getVideo(videoId);
      if (prev && prev.source !== 'captions') {
        transcript = [...(prev.transcript || []), ...transcript]
          .sort((a, b) => a.startTime - b.startTime)
          .filter((s, i, all) => i === 0 || s.text !== all[i - 1].text || Math.abs(s.startTime - all[i - 1].startTime) > 1);
      }
    }

    // ACTA — genre classification (title carries strong signals)
    let genre = 'LECTURE';
    try {
      const result = await this.acta.classify(transcript, title);
      genre = result.genre;
    } catch (e) {
      console.warn('[Ingestion] ACTA failed:', e.message);
    }

    // Chunk + embed
    const chunks = chunkText(transcript, { maxTokens: 500, overlap: 3 });
    const embeddings = await Promise.all(chunks.map(c => embed(c.text)));

    await this.store.addVideo({
      videoId, title, channel, genre,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      indexedAt: Date.now(),
      transcript, source, captionQuality,
      chunks: chunks.map((c, i) => ({ text: c.text, startTime: c.startTime, embedding: embeddings[i] })),
    });

    // Update popup video list
    const videos = (await this.store.getAllVideos()).map(v => ({
      videoId: v.videoId, title: v.title, channel: v.channel,
      genre: v.genre, chunks: v.chunks.length, indexedAt: v.indexedAt,
    }));
    await chrome.storage.local.set({ ytmind_video_count: videos.length, ytmind_videos: videos });

    // KGMA — concept extraction (fire and forget, don't block UI)
    this.kgma.ingestVideo({ videoId, title, chunks }).catch(e =>
      console.warn('[KGMA] ingest failed:', e.message)
    );

    console.log(`[Ingestion] Indexed "${title}" [${genre}] — ${chunks.length} chunks`);
    return { title, channel, genre, chunkCount: chunks.length, cached: false };
  }
}
