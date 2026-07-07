// Classic Okapi BM25 keyword scoring, computed on-the-fly from the vector
// store's full corpus (small enough here that a persisted separate index
// isn't worth the complexity). Combined with vector search via Reciprocal
// Rank Fusion in hybridRetriever.js.

import { getAllRecords } from "../shared/vectorStore.js";

const K1 = 1.5;
const B = 0.75;

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function buildIndex(records) {
  const docTokens = records.map((r) => tokenize(r.text));
  const docLengths = docTokens.map((tokens) => tokens.length);
  const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / (docLengths.length || 1);

  const docFreq = new Map(); // term -> number of docs containing it at least once
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  return { docTokens, docLengths, avgDocLength, docFreq, N: records.length };
}

function idf(term, { docFreq, N }) {
  const n = docFreq.get(term) || 0;
  return Math.log((N - n + 0.5) / (n + 0.5) + 1);
}

export function bm25Search(query, topK = 5) {
  const records = getAllRecords();
  if (records.length === 0) return [];

  const index = buildIndex(records);
  const queryTerms = tokenize(query);

  const scored = records.map((record, i) => {
    const tokens = index.docTokens[i];
    const docLength = index.docLengths[i];
    const termFreq = new Map();
    for (const term of tokens) termFreq.set(term, (termFreq.get(term) || 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const tf = termFreq.get(term) || 0;
      if (tf === 0) continue;
      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * (docLength / index.avgDocLength));
      score += idf(term, index) * (numerator / denominator);
    }

    return { id: record.id, text: record.text, metadata: record.metadata, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
