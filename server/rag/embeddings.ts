// High-performance feature-vector embedding generator
// Uses character n-gram hashing and term frequency weighting to create dense normalized vectors.

const VECTOR_DIM = 256;

export function generateEmbedding(text: string): number[] {
  if (!text) return new Array(VECTOR_DIM).fill(0);

  const vector = new Array(VECTOR_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(t => t.length > 1);

  if (tokens.length === 0) return vector;

  // Process word tokens and word 3-grams
  for (const token of tokens) {
    // Hash full word
    const hash = simpleHash(token) % VECTOR_DIM;
    vector[Math.abs(hash)] += 1.5;

    // Sub-word character trigrams for typo-tolerant semantic matching
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.substring(i, i + 3);
        const triHash = simpleHash(trigram) % VECTOR_DIM;
        vector[Math.abs(triHash)] += 0.5;
      }
    }
  }

  // L2 Normalize vector
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  return dotProduct;
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
