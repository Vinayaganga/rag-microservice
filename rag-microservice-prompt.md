Build a modular RAG (Retrieval-Augmented Generation) engine as a Node.js project called `rag-microservice`. It should run as a single Express app locally (no external DB required), but be structured so each piece maps cleanly to a standalone microservice later (ingestion, embedding, retrieval, generation).

## Requirements

**Stack**
- Node.js (ESM, `"type": "module"` in package.json)
- Express for the HTTP API
- Anthropic SDK (`@anthropic-ai/sdk`) for generation, model `claude-sonnet-4-6`
- Voyage AI for embeddings, called via plain `fetch` (no SDK needed) — model `voyage-3.5`, endpoint `https://api.voyageai.com/v1/embeddings`. Use asymmetric embeddings: `input_type: "document"` when embedding ingested chunks, `input_type: "query"` when embedding a search query.
- `dotenv` for config
- No external vector DB — implement a simple file-backed vector store (JSON file on disk) with brute-force cosine similarity search. Structure it so it could later be swapped for pgvector/Pinecone without changing the calling code (i.e. expose `upsertChunks`, `search`, `clearStore`, `storeSize` as the interface).

**Folder structure**
```
rag-microservice/
  package.json
  .env.example
  README.md
  docs/                       # sample docs for testing ingestion
  data/                       # vector store JSON file lives here (gitignored)
  src/
    server.js                 # Express app wiring up all routes
    shared/
      vectorStore.js          # file-backed cosine similarity store
    ingestion/
      chunker.js              # fixed-size chunking with overlap
      pipeline.js             # chunk -> embed -> store, for a batch of docs
      cli.js                  # CLI: node src/ingestion/cli.js <folder> ingests all .txt/.md files in it
    embedding/
      embeddingClient.js       # Voyage AI embed calls (embedTexts, embedOne)
    retrieval/
      retriever.js             # embed a query, search the store, return top-k
    generation/
      generator.js             # build a grounded prompt from retrieved chunks, call Claude, return answer + sources
```

**Chunking**
- Fixed-size character chunking with overlap, configurable via env vars `CHUNK_SIZE` (default 800) and `CHUNK_OVERLAP` (default 150).
- Each chunk keeps metadata: source filename, chunk index, ingestion timestamp.

**Vector store**
- `upsertChunks(records)` — records: `{ id, text, embedding, metadata }`, dedupes by `id`.
- `search(queryEmbedding, topK)` — returns top-k by cosine similarity, each with a `score`.
- `clearStore()` and `storeSize()` for admin/health use.

**HTTP API (Express, in server.js)**
- `POST /ingest` — body `{ documents: [{ id, source, text, metadata? }] }`, runs the ingestion pipeline, returns per-doc chunk counts.
- `GET /retrieve?query=...&topK=...` — retrieval only, no generation (useful for debugging chunk quality).
- `POST /ask` — body `{ query, topK? }`, does full RAG: retrieve top-k chunks, build a prompt instructing the model to answer only from context and cite sources by number, call Claude, return `{ answer, sources, latencyMs }`.
- `GET /health` — returns `{ status: "ok", chunksInStore }`.
- `DELETE /store` — clears the vector store.

**CLI ingestion tool**
- `node src/ingestion/cli.js <folder>` reads every `.txt`/`.md` file in the given folder, ingests each as a document (id = filename), and logs chunk counts per file.

**Environment variables** (`.env.example`)
```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
PORT=3000
TOP_K=5
CHUNK_SIZE=800
CHUNK_OVERLAP=150
```

**README**
Include setup steps (cp .env.example, npm install, where to get each API key), how to run the server, how to ingest via CLI and via HTTP, example curl commands for `/retrieve` and `/ask`, and a "next steps" section noting upgrade paths: AST-aware chunking for code, swapping the vector store for pgvector/Pinecone, hybrid search + re-ranking, evaluation with RAGAS, per-stage latency instrumentation.

**Sample data**
Include one sample markdown doc in `docs/` (e.g. a short fictional "notification service" spec with a retry policy and rate limiting section) so the ingestion pipeline can be smoke-tested immediately after setup.

## Also do this
- Add clear comments in `server.js` explaining which route corresponds to which future microservice, and the 3-step path to actually splitting them out (move folder to its own repo, replace function calls with HTTP calls, point at a shared vector store).
- Keep every module small and single-purpose — this is meant to be read and understood, not just run.
- After generating the code, run a syntax check on every file and confirm `npm install` resolves cleanly before finishing.
