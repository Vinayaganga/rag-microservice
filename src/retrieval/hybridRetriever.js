// Hybrid search: fuse vector search (semantic) and BM25 (keyword) via
// Reciprocal Rank Fusion, then re-rank the fused candidates with Voyage's
// rerank API for a final precision pass. Contrast with retriever.js, which
// is pure vector search — kept unchanged so the two can be compared.

import { retrieve } from "./retriever.js";
import { bm25Search } from "./bm25.js";
import { rerank } from "../embedding/embeddingClient.js";

const RRF_K = 60;
const FUSION_CANDIDATE_COUNT = 20;

function reciprocalRankFusion(rankedLists) {
  const fusedScores = new Map();
  const recordsById = new Map();

  for (const list of rankedLists) {
    list.forEach((record, rank) => {
      recordsById.set(record.id, record);
      const prior = fusedScores.get(record.id) || 0;
      fusedScores.set(record.id, prior + 1 / (RRF_K + rank + 1));
    });
  }

  return [...fusedScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, fusedScore]) => ({ ...recordsById.get(id), fusedScore }));
}

export async function hybridRetrieve(query, topK = 5) {
  const [vectorResults, bm25Results] = await Promise.all([
    retrieve(query, FUSION_CANDIDATE_COUNT),
    bm25Search(query, FUSION_CANDIDATE_COUNT),
  ]);

  const fused = reciprocalRankFusion([vectorResults, bm25Results]).slice(0, FUSION_CANDIDATE_COUNT);
  if (fused.length === 0) return [];

  const reranked = await rerank(query, fused.map((r) => r.text), topK);

  return reranked.map(({ index, relevanceScore }) => ({
    id: fused[index].id,
    text: fused[index].text,
    metadata: fused[index].metadata,
    relevanceScore,
  }));
}
