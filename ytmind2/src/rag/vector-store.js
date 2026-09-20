// ============================================================
//  Vector Store (IndexedDB)
//  Two stores:
//   - videos: chunks + embeddings, 24hr TTL (session RAG)
//   - concepts: KGMA persistent knowledge graph (no TTL)
//  Cosine similarity search across all indexed videos.
// ============================================================

import { cosineSimilarity } from './embedder.js';

const DB_NAME = 'ytmind2_db';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';
const STORE_CONCEPTS = 'concepts';   // KGMA persistent graph
const SESSION_TTL = 24 * 60 * 60 * 1000;

export class VectorStore {

  constructor() { this._db = null; }

  async _open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
          db.createObjectStore(STORE_VIDEOS, { keyPath: 'videoId' });
        }
        if (!db.objectStoreNames.contains(STORE_CONCEPTS)) {
          db.createObjectStore(STORE_CONCEPTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  }

  // ══════════════════ VIDEO STORE (session RAG) ══════════════════

  async addVideo(videoData) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      tx.objectStore(STORE_VIDEOS).put({
        ...videoData,
        transcriptVersion: 2,
        indexedAt: Date.now(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async hasVideo(videoId) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_VIDEOS).objectStore(STORE_VIDEOS).get(videoId);
      req.onsuccess = () => resolve(!!req.result && this._alive(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  async getVideoMeta(videoId) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_VIDEOS).objectStore(STORE_VIDEOS).get(videoId);
      req.onsuccess = () => {
        const v = req.result;
        resolve(v ? { title: v.title, channel: v.channel, genre: v.genre, chunkCount: v.chunks.length } : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getVideo(videoId) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_VIDEOS).objectStore(STORE_VIDEOS).get(videoId);
      req.onsuccess = () => resolve(req.result && this._alive(req.result) ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllVideos() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_VIDEOS).objectStore(STORE_VIDEOS).getAll();
      req.onsuccess = () => resolve(req.result.filter(v => this._alive(v)));
      req.onerror = () => reject(req.error);
    });
  }

  async getAllVideoIds() {
    return (await this.getAllVideos()).map(v => v.videoId);
  }

  async searchByVideo(queryEmbedding, videoId, topK = 6) {
    const video = await this.getVideo(videoId);
    if (!video) return [];
    return this._rank(queryEmbedding, video.chunks, video, topK);
  }

  async searchAll(queryEmbedding, topK = 8) {
    const videos = await this.getAllVideos();
    const scored = [];
    for (const v of videos) {
      for (const chunk of v.chunks) {
        scored.push({
          ...chunk, videoTitle: v.title, videoId: v.videoId,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  _rank(queryEmbedding, chunks, video, topK) {
    return chunks
      .map(c => ({
        ...c, videoTitle: video.title, videoId: video.videoId,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  _alive(video) {
    return video.transcriptVersion === 2 && (Date.now() - video.indexedAt) < SESSION_TTL;
  }

  async clearExpired() {
    const db = await this._open();
    const all = await new Promise((res, rej) => {
      const req = db.transaction(STORE_VIDEOS).objectStore(STORE_VIDEOS).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const expired = all.filter(v => !this._alive(v));
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      const store = tx.objectStore(STORE_VIDEOS);
      expired.forEach(v => store.delete(v.videoId));
      tx.oncomplete = () => resolve(expired.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      tx.objectStore(STORE_VIDEOS).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // ══════════════════ CONCEPT STORE (KGMA — persistent) ══════════════════

  async addConcept(concept) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONCEPTS, 'readwrite');
      tx.objectStore(STORE_CONCEPTS).put(concept);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllConcepts() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_CONCEPTS).objectStore(STORE_CONCEPTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async clearConcepts() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONCEPTS, 'readwrite');
      tx.objectStore(STORE_CONCEPTS).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}
