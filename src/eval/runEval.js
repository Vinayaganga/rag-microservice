// Usage: node src/eval/runEval.js
// Runs the hand-written dataset against the live retrieval + generation
// pipeline, computing deterministic retrieval metrics (hit@k, MRR) and
// LLM-judged answer quality (faithfulness, relevance).

import "dotenv/config";
import fs from "fs";
import path from "path";
import { retrieve } from "../retrieval/retriever.js";
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
  const results = await retrieve(testCase.question, TOP_K);
  const { hit, rank } = checkRetrievalHit(results, testCase.expectedSourceFile);

  const { answer } = await generateAnswer(testCase.question, { topK: TOP_K, chunks: results });
  const context = results
    .map((r, i) => `[${i + 1}] (source: ${r.metadata.source})\n${r.text}`)
    .join("\n\n---\n\n");
  const judged = await judgeAnswer({ question: testCase.question, context, answer });

  return { question: testCase.question, expectedSourceFile: testCase.expectedSourceFile, hit, rank, answer, ...judged };
}

function printCase(r) {
  const hitLabel = r.hit === null ? "n/a (out-of-scope)" : r.hit ? `yes (#${r.rank})` : "no";
  console.log(`- "${r.question}"`);
  console.log(`    hit: ${hitLabel}  faithfulness: ${r.faithfulness}/5  relevance: ${r.relevance}/5`);
}

async function main() {
  const results = [];
  for (const testCase of dataset) {
    const result = await runCase(testCase);
    printCase(result);
    results.push(result);
  }

  const retrievalScored = results.filter((r) => r.hit !== null);
  const hitCount = retrievalScored.filter((r) => r.hit).length;
  const hitAtK = retrievalScored.length > 0 ? hitCount / retrievalScored.length : null;
  const mrr =
    retrievalScored.length > 0
      ? retrievalScored.reduce((sum, r) => sum + (r.hit ? 1 / r.rank : 0), 0) / retrievalScored.length
      : null;
  const avgFaithfulness = results.reduce((sum, r) => sum + (r.faithfulness || 0), 0) / results.length;
  const avgRelevance = results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length;

  console.log("\n=== Summary ===");
  console.log(`Hit@${TOP_K}: ${(hitAtK * 100).toFixed(0)}% (${hitCount}/${retrievalScored.length} retrieval-scored cases)`);
  console.log(`MRR: ${mrr.toFixed(2)}`);
  console.log(`Avg faithfulness: ${avgFaithfulness.toFixed(2)}/5`);
  console.log(`Avg relevance: ${avgRelevance.toFixed(2)}/5`);

  const reportPath = path.resolve("data", "eval-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ results, summary: { hitAtK, mrr, avgFaithfulness, avgRelevance } }, null, 2)
  );
  console.log(`\nFull report written to ${reportPath}`);
}

await main();
