# RAG Systems Portfolio

Three connected projects, built in sequence, each demonstrating a different
piece of how production RAG systems actually work:

1. **[rag-microservice](.)** (this repo) — the base RAG engine: ingestion,
   embedding, retrieval, generation, plus an evaluation harness and hybrid
   search + re-ranking.
2. **[codebase-rag-assistant](../codebase-rag-assistant)** — swaps
   fixed-size chunking for AST-aware chunking, so retrieval works over
   function/class boundaries instead of arbitrary character windows.
3. **[agentic-rag-assistant](../agentic-rag-assistant)** — swaps the fixed
   retrieve-then-generate pipeline for a tool-use loop, so the model decides
   for itself whether/how many times to search.

All three share the same small, focused modules for the boring-but-critical
parts (vector store, Voyage embedding client) — copied between repos rather
than shared via a package, since duplication across 3 standalone projects is
cheaper than coupling them together.

## Architecture decisions worth being able to explain

- **Reciprocal Rank Fusion over score normalization** (`rag-microservice`,
  `hybridRetriever.js`): combining BM25 keyword scores with cosine-similarity
  vector scores is awkward because they live on completely different scales.
  RRF sidesteps that by fusing on *rank* (`1/(60 + rank)`) instead of
  normalizing two incompatible score distributions — the standard trick for
  hybrid search.
- **Hand-rolled eval over RAGAS** (`rag-microservice`, `src/eval/`): RAGAS is
  the industry-standard name, but it's Python-only. Building the judge prompt
  by hand (Claude scoring its own answers for faithfulness/relevance, plus
  deterministic Hit@k/MRR for retrieval) stays in one stack and is more
  instructive than calling a library — you understand exactly what's being
  measured and why.
- **WASM tree-sitter over native bindings** (`codebase-rag-assistant`,
  `astChunker.js`): `web-tree-sitter` (WASM) avoids the node-gyp/native
  compilation issues that `tree-sitter` + native language bindings can hit,
  at the cost of needing prebuilt `.wasm` grammars (`tree-sitter-wasms`) —
  worth knowing the tradeoff exists before picking either.
- **Tool-use loop over a fixed pipeline** (`agentic-rag-assistant`,
  `agentLoop.js`): giving the model a `search_documents` tool (and later a
  `list_documents` tool) and looping on `stop_reason === "tool_use"` lets it
  decide query phrasing and how many searches a question needs — a single
  comparison question naturally triggers 2 searches (one per topic), which a
  fixed single-retrieve pipeline can't do at all.

## What broke, and how it was found

These are the more useful stories than "here's what I built" — they're what
actually got debugged along the way:

- **`export_statement` unwrapping bug** (`codebase-rag-assistant`): the
  first version of `astChunker.js` only recognized bare `function_declaration`
  / `class_declaration` nodes. But `export function foo() {}` parses as an
  `export_statement` *wrapping* the real declaration — which is the
  overwhelming majority of real ESM code. Every exported symbol in
  `vectorStore.js` was silently collapsing into one generic "module-level"
  chunk instead of getting its own. Found by actually ingesting real code
  (`rag-microservice`'s own `src/`) and noticing the chunk counts didn't
  match the number of exported functions — a synthetic test alone wouldn't
  have caught this, since it's easy to write a synthetic test that only
  covers the case you already thought of.
- **Voyage's 3 RPM free-tier limit**: hit almost immediately once ingesting
  more than 2-3 files/docs in a row. Fixed with retry-with-backoff on 429s
  in `embeddingClient.js` (reading `Retry-After` when present, falling back
  to 21s otherwise) rather than just failing — this is now load-bearing
  across all 3 projects, not a one-off patch.
- **Comment-vs-function-body ranking artifact**: pure semantic search on
  code sometimes ranks a short file-header comment ("vector store...
  cosine similarity...") above the actual function that does the work,
  because the comment shares more literal vocabulary with a natural-language
  query than the code does. Not a bug — a real, inherent limitation of
  embedding-based search on code, and a good argument for hybrid search
  (BM25 would weight exact identifier/keyword matches more directly) if this
  project's corpus were large enough to prove it.
- **Vector-vs-hybrid comparison came back a tie**: after adding 5 more docs
  with deliberately overlapping vocabulary specifically to create retrieval
  ambiguity, both `retrieve()` and `hybridRetrieve()` still scored 100%
  Hit@5 / MRR 1.00 with zero disagreements. The honest read: the corpus
  (~9 chunks) is still too small relative to `topK=5` for the two methods to
  diverge — over half the corpus comes back on every query either way. This
  is a genuinely useful thing to have learned rather than papered over: small
  evals can validate correctness without being able to detect a real quality
  difference, and it takes real scale (hundreds of chunks, `topK` a small
  fraction of the total) before hybrid search's value becomes measurable.
