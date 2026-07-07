// Voyage AI embeddings, called via plain fetch (no SDK dependency).
// Voyage embeddings are asymmetric: ingested chunks are embedded with
// input_type "document", search queries with input_type "query".

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5";

async function embed(texts, inputType) {
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
  }

  const { data } = await response.json();
  return data.map((d) => d.embedding);
}

export async function embedTexts(texts, inputType = "document") {
  // texts: string[] -> returns number[][]
  return embed(texts, inputType);
}

export async function embedOne(text, inputType = "query") {
  const [embedding] = await embed([text], inputType);
  return embedding;
}
