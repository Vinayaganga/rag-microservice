# RAG Microservice

See [PORTFOLIO.md](PORTFOLIO.md) for how this connects to its sibling
projects, the architecture decisions worth explaining out loud, and what
broke along the way (and how it was found).

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

Hybrid search (BM25 keyword search + vector search, fused via Reciprocal
Rank Fusion, then re-ranked with Voyage's rerank API) — directly comparable
to the vector-only `/retrieve` above:
```bash
curl "http://localhost:3000/retrieve/hybrid?query=what+is+the+retry+policy&topK=3"
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

## Evaluation

A hand-rolled eval harness (not RAGAS — kept in the same Node stack) scores
retrieval and generation quality against a hand-written Q&A set in
`src/eval/dataset.js`:

```bash
npm run eval
```

Computes deterministic retrieval metrics (Hit@k, MRR) plus an LLM-as-judge
score (Claude grading its own answers for faithfulness and relevance, 1-5
each). Prints a per-case summary and writes a full report to
`data/eval-report.json` (gitignored). See `src/eval/judge.js` for the
grading prompt and `src/eval/runEval.js` for how metrics are computed.

## Architecture

```
src/
  ingestion/    chunking + the pipeline that ties chunk -> embed -> store
  embedding/    Voyage AI embeddings + reranking client (plain fetch, no SDK)
  retrieval/    query embedding + vector search (retriever.js), plus BM25
                (bm25.js) and hybrid RRF-fusion + rerank (hybridRetriever.js)
  generation/   prompt construction + Claude call
  shared/       vector store (swap this for pgvector/Pinecone later)
  eval/         retrieval metrics (hit@k/MRR) + LLM-as-judge answer scoring
```

## Rate limits

Voyage AI free-tier accounts (no payment method on file) are capped at 3
requests/minute. `embeddingClient.js` retries on 429s with backoff, so
ingesting multiple docs or running the eval harness will self-pace and
just take longer rather than fail outright.

## Related projects

- [`codebase-rag-assistant`](../codebase-rag-assistant) — a sibling project
  that swaps this project's fixed-size chunking for AST-aware (tree-sitter)
  chunking, so it can RAG over source code by function/class instead of
  documents. Reuses this project's `vectorStore.js` and `embeddingClient.js`.

## Next steps / upgrade paths

- **Chunking**: currently fixed-size with overlap. See `codebase-rag-assistant`
  for an AST-aware (tree-sitter) alternative that chunks by function/class
  boundaries instead of arbitrary character counts.
- **Vector store**: `shared/vectorStore.js` is brute-force cosine similarity
  over a JSON file — fine up to a few thousand chunks. Swap for pgvector
  (stays close to your Postgres/AWS stack) once you outgrow it.
- **Retrieval quality**: `npm run eval` now runs both `retrieve()` (vector)
  and `hybridRetrieve()` side by side and reports Hit@k/MRR for each. Tried
  this against 7 docs (up from 2) with deliberately overlapping vocabulary
  (several docs share "retry"/"rate limit" language with different specific
  numbers) — both paths still scored 100%/1.00 with zero disagreements. That's
  a real finding, not a bug: with only ~9 total chunks and `topK=5`, over half
  the corpus is returned on every query regardless of method, so there isn't
  enough scale yet for the two approaches to diverge. The comparison becomes
  meaningful with a genuinely large/messy corpus (hundreds of chunks) where
  `topK` is a small fraction of the total — that's the next real test, not
  more sample docs like these. Swapping `/ask` to use `hybridRetrieve` instead
  of `retrieve` is a small change in `generation/generator.js` once that's
  confirmed to help.
- **Observability**: `/ask` already returns latency; extend with per-stage
  timing (embed vs retrieve vs generate) — useful talking points for
  system design interviews.
