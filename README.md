# RAG Microservice

A modular RAG engine built as composable Node.js services: ingestion,
embedding, retrieval, and generation. Runs as a single Express app locally
(zero infra needed — vector storage is a JSON file), but each route maps
1:1 to what would be its own microservice in production. See the comment
at the top of `src/server.js` for the split-out path.

## Setup

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY (https://console.anthropic.com/settings/keys)
# and VOYAGE_API_KEY (https://dash.voyageai.com/api-keys)
npm install
```

## Run

```bash
npm start
# server on http://localhost:3000
```

## Ingest documents

Option A — CLI, from a folder of .txt/.md files:
```bash
node src/ingestion/cli.js ./docs
```

Option B — HTTP:
```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      { "id": "doc1", "source": "policy.md", "text": "Your document text here..." }
    ]
  }'
```

## Query

Retrieval only (no generation, useful for debugging chunk quality):
```bash
curl "http://localhost:3000/retrieve?query=what+is+the+retry+policy&topK=3"
```

Full RAG (retrieve + generate grounded answer):
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{ "query": "What is the retry policy for failed notifications?" }'
```

## Health / reset

```bash
curl http://localhost:3000/health
curl -X DELETE http://localhost:3000/store   # wipes the vector store
```

## Architecture

```
src/
  ingestion/    chunking + the pipeline that ties chunk -> embed -> store
  embedding/    Voyage AI embeddings client (plain fetch, no SDK)
  retrieval/    query embedding + vector search
  generation/   prompt construction + Claude call
  shared/       vector store (swap this for pgvector/Pinecone later)
```

## Next steps / upgrade paths

- **Chunking**: currently fixed-size with overlap. For the codebase RAG
  assistant (Phase 2), swap in AST-aware chunking (tree-sitter) so chunks
  align with function/class boundaries instead of arbitrary character counts.
- **Vector store**: `shared/vectorStore.js` is brute-force cosine similarity
  over a JSON file — fine up to a few thousand chunks. Swap for pgvector
  (stays close to your Postgres/AWS stack) once you outgrow it.
- **Retrieval quality**: add hybrid search (BM25 + vector) and a re-ranking
  step once you have enough data to notice retrieval misses.
- **Evaluation**: wire up RAGAS or a small hand-labeled eval set so you can
  measure retrieval/answer quality changes objectively, not just vibes.
- **Observability**: `/ask` already returns latency; extend with per-stage
  timing (embed vs retrieve vs generate) — useful talking points for
  system design interviews.
