// ============================================================
//  Embedder (local, no API)
//  Hashed TF vector of words + bigrams, L2-normalized.
//  Supports Urdu, Arabic, and Latin scripts.
//  Free, instant, private.
// ============================================================

const DIMS = 2048;

const STOPWORDS = new Set((
  'a an the and or but if of to in on at for with by from is are was were be been ' +
  'it this that these those i you he she we they me my your our so do does did not no yes just like ' +
  'um uh yeah okay ok gonna what which who how when where why can will would could should about into ' +
  'ہے ہیں کا کی کے کو میں سے اور یہ وہ ایک کہ تو نے پر بھی جو ہو ہم آپ کر'
).split(' '));

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\u0750-\u077F\s]/g, ' ')  // keep Latin, Arabic, Urdu
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function embed(text) {
  const vec = new Float32Array(DIMS);
  const tokens = tokenize(text);

  const add = (term, weight) => {
    const h = hash(term);
    const sign = (h & 1) ? 1 : -1;
    vec[h % DIMS] += sign * weight;
  };

  tokens.forEach((t, i) => {
    add(t, 1);
    if (i < tokens.length - 1) add(t + '_' + tokens[i + 1], 0.7);
  });

  let norm = 0;
  for (let i = 0; i < DIMS; i++) {
    vec[i] = Math.sign(vec[i]) * Math.log1p(Math.abs(vec[i]));
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  const out = new Array(DIMS);
  for (let i = 0; i < DIMS; i++) out[i] = vec[i] / norm;
  return out;
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}
