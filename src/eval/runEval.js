// Usage: node src/eval/runEval.js
// Runs the hand-written dataset against the live retrieval + generation
// pipeline, computing deterministic retrieval metrics (hit@k, MRR) for
// BOTH the pure-vector path and the hybrid (BM25 + vector + rerank) path
// side by side, plus LLM-judged answer quality (faithfulness, relevance)
// on the vector path's answers.

import "dotenv/config";
import fs from "fs";
import path from "path";
import { retrieve } from "../retrieval/retriever.js";
import { hybridRetrieve } from "../retrieval/hybridRetriever.js";
import { generateAnswer } from "../generation/generator.js";
import { judgeAnswer } from "./judge.js";
import { dataset } from "./dataset.js";

const TOP_K = Number(process.env.TOP_K) || 5;

function checkRetrievalHit(results, expectedSourceFile) {
  if (!expectedSourceFile) return { hit: null, rank: null };
  const index = results.findIndex((r) => r.metadata.source === expectedSourceFile);
  return { hit: index !== -1, rank: index === -1 ? null : index + 1 };
}

async function runCase(testCase) {
  const vectorResults = await retrieve(testCase.question, TOP_K);
  const hybridResults = await hybridRetrieve(testCase.question, TOP_K);

  const vector = checkRetrievalHit(vectorResults, testCase.expectedSourceFile);
  const hybrid = checkRetrievalHit(hybridResults, testCase.expectedSourceFile);

  const { answer } = await generateAnswer(testCase.question, { topK: TOP_K, chunks: vectorResults });
  const context = vectorResults
    .map((r, i) => `[${i + 1}] (source: ${r.metadata.source})\n${r.text}`)
    .join("\n\n---\n\n");
  const judged = await judgeAnswer({ question: testCase.question, context, answer });

  return {
    question: testCase.question,
    expectedSourceFile: testCase.expectedSourceFile,
    vector,
    hybrid,
    answer,
    ...judged,
  };
}

function printCase(r) {
  const label = ({ hit, rank }) => (hit === null ? "n/a" : hit ? `yes (#${rank})` : "no");
  console.log(`- "${r.question}"`);
  console.log(`    vector hit: ${label(r.vector)}   hybrid hit: ${label(r.hybrid)}   faithfulness: ${r.faithfulness}/5  relevance: ${r.relevance}/5`);
}

function summarize(results, key) {
  const scored = results.filter((r) => r[key].hit !== null);
  const hitCount = scored.filter((r) => r[key].hit).length;
  const hitAtK = scored.length > 0 ? hitCount / scored.length : null;
  const mrr =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + (r[key].hit ? 1 / r[key].rank : 0), 0) / scored.length
      : null;
  return { hitAtK, mrr, hitCount, scoredCount: scored.length };
}

async function main() {
  const results = [];
  for (const testCase of dataset) {
    const result = await runCase(testCase);
    printCase(result);
    results.push(result);
  }

  const vectorSummary = summarize(results, "vector");
  const hybridSummary = summarize(results, "hybrid");
  const avgFaithfulness = results.reduce((sum, r) => sum + (r.faithfulness || 0), 0) / results.length;
  const avgRelevance = results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length;

  console.log("\n=== Summary ===");
  console.log(
    `Vector-only  Hit@${TOP_K}: ${(vectorSummary.hitAtK * 100).toFixed(0)}% (${vectorSummary.hitCount}/${vectorSummary.scoredCount})   MRR: ${vectorSummary.mrr.toFixed(2)}`
  );
  console.log(
    `Hybrid       Hit@${TOP_K}: ${(hybridSummary.hitAtK * 100).toFixed(0)}% (${hybridSummary.hitCount}/${hybridSummary.scoredCount})   MRR: ${hybridSummary.mrr.toFixed(2)}`
  );
  console.log(`Avg faithfulness (vector-sourced answers): ${avgFaithfulness.toFixed(2)}/5`);
  console.log(`Avg relevance (vector-sourced answers): ${avgRelevance.toFixed(2)}/5`);

  const disagreements = results.filter((r) => r.vector.hit !== r.hybrid.hit);
  if (disagreements.length > 0) {
    console.log(`\n${disagreements.length} case(s) where vector and hybrid disagreed:`);
    disagreements.forEach((r) => console.log(`  - "${r.question}" (vector: ${r.vector.hit}, hybrid: ${r.hybrid.hit})`));
  }

  const reportPath = path.resolve("data", "eval-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ results, summary: { vector: vectorSummary, hybrid: hybridSummary, avgFaithfulness, avgRelevance } }, null, 2)
  );
  console.log(`\nFull report written to ${reportPath}`);
}

await main();
