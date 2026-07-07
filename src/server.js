// Each route below corresponds to what would be a separate microservice
// in production (ingestion-service, retrieval-api, generation-service).
// They're colocated here for local dev simplicity. To split them for real:
//   1. Move each route's handler + its src/<name>/ folder into its own repo
//   2. Replace direct function calls with HTTP calls between services
//   3. Point them all at a shared vector store (pgvector/Pinecone) instead
//      of the local JSON file in shared/vectorStore.js

import "dotenv/config";
import express from "express";
import { ingestDocuments } from "./ingestion/pipeline.js";
import { retrieve } from "./retrieval/retriever.js";
import { hybridRetrieve } from "./retrieval/hybridRetriever.js";
import { generateAnswer } from "./generation/generator.js";
import { storeSize, clearStore } from "./shared/vectorStore.js";

const REQUIRED_ENV_VARS = ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill them in before starting the server.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// --- ingestion-service ---
app.post("/ingest", async (req, res) => {
  try {
    const { documents } = req.body; // [{ id, source, text, metadata? }]
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: "Provide a non-empty 'documents' array." });
    }
    const results = await ingestDocuments(documents);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- retrieval-api ---
app.get("/retrieve", async (req, res) => {
  try {
    const { query, topK } = req.query;
    if (!query) return res.status(400).json({ error: "Missing 'query' param." });
    const results = await retrieve(query, topK ? Number(topK) : undefined);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Hybrid search: BM25 + vector fused via Reciprocal Rank Fusion, then
// re-ranked with Voyage's rerank API. Directly comparable to /retrieve above.
app.get("/retrieve/hybrid", async (req, res) => {
  try {
    const { query, topK } = req.query;
    if (!query) return res.status(400).json({ error: "Missing 'query' param." });
    const results = await hybridRetrieve(query, topK ? Number(topK) : undefined);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- generation-service ---
app.post("/ask", async (req, res) => {
  const start = Date.now();
  try {
    const { query, topK } = req.body;
    if (!query) return res.status(400).json({ error: "Missing 'query' in body." });
    const result = await generateAnswer(query, { topK });
    res.json({ ...result, latencyMs: Date.now() - start });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- utility / observability ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", chunksInStore: storeSize() });
});

app.delete("/store", (req, res) => {
  clearStore();
  res.json({ status: "cleared" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAG microservice listening on http://localhost:${PORT}`);
});
