import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "../retrieval/retriever.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(query, chunks) {
  const context = chunks
    .map((c, i) => `[${i + 1}] (source: ${c.metadata.source})\n${c.text}`)
    .join("\n\n---\n\n");

  return `You are answering a question using only the context provided below.
If the context doesn't contain the answer, say so clearly instead of guessing.
Cite sources using their [number] when you use them.

CONTEXT:
${context}

QUESTION:
${query}`;
}

export async function generateAnswer(query, { topK } = {}) {
  const chunks = await retrieve(query, topK);

  if (chunks.length === 0) {
    return {
      answer: "No documents have been ingested yet, so there's nothing to search.",
      sources: [],
    };
  }

  const prompt = buildPrompt(query, chunks);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const answer = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    answer,
    sources: chunks.map((c) => ({
      source: c.metadata.source,
      score: c.score,
      preview: c.text.slice(0, 150),
    })),
  };
}
