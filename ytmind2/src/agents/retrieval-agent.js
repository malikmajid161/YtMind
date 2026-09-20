// ============================================================
//  🤖 Retrieval Agent — searches the vector store by strategy.
// ============================================================

import { embed } from '../rag/embedder.js';

export class RetrievalAgent {
  constructor(vectorStore) { this.store = vectorStore; }

  async run({ query, currentVideoId, strategy = 'current_video' }) {
    // Summary of current video → spread chunks across the video
    if (strategy === 'current_video' && /summari[sz]e|summary|overview|khulasa|خلاصہ/i.test(query)) {
      const video = await this.store.getVideo(currentVideoId);
      if (video) {
        const all = video.chunks || [];
        const count = Math.min(8, all.length);
        const chunks = Array.from({ length: count }, (_, i) =>
          all[count === 1 ? 0 : Math.round(i * (all.length - 1) / (count - 1))]
        ).map(c => ({ ...c, videoId: currentVideoId, videoTitle: video.title }));
        return { strategy, chunks };
      }
    }

    const qEmb = await embed(query);
    switch (strategy) {
      case 'cross_video':
        return { strategy, chunks: await this.store.searchAll(qEmb, 8) };
      case 'comparison': {
        const ids = await this.store.getAllVideoIds();
        const results = await Promise.all(ids.map(id => this.store.searchByVideo(qEmb, id, 4)));
        return { strategy, chunks: results.flat() };
      }
      default:
        return { strategy, chunks: await this.store.searchByVideo(qEmb, currentVideoId, 6) };
    }
  }
}
