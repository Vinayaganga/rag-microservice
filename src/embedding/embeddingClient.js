// Voyage AI embeddings + reranking, called via plain fetch (no SDK dependency).
// Voyage embeddings are asymmetric: ingested chunks are embedded with
// input_type "document", search queries with input_type "query".

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
const EMBEDDING_MODEL = "voyage-3.5";
const RERANK_MODEL = "rerank-2.5";
const MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 21_000; // free-tier accounts are capped at 3 requests/minute

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJSON(url, body, attempt = 0) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const delayMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : DEFAULT_RETRY_DELAY_MS;
    console.warn(`Voyage rate limit hit, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await sleep(delayMs);
    return postJSON(url, body, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voyage request to ${url} failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function embedTexts(texts, inputType = "document") {
  // texts: string[] -> returns number[][]
  const { data } = await postJSON(VOYAGE_EMBEDDINGS_URL, {
    model: EMBEDDING_MODEL,
    input: texts,
    input_type: inputType,
  });
  return data.map((d) => d.embedding);
}

export async function embedOne(text, inputType = "query") {
  const [embedding] = await embedTexts([text], inputType);
  return embedding;
}

export async function rerank(query, documents, topK) {
  // documents: string[] -> returns [{ index, relevanceScore }] sorted by relevance desc
  const { data } = await postJSON(VOYAGE_RERANK_URL, {
    model: RERANK_MODEL,
    query,
    documents,
    top_k: topK,
  });
  return data.map((d) => ({ index: d.index, relevanceScore: d.relevance_score }));
}
