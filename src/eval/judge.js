// LLM-as-judge: scores a generated answer for faithfulness (no hallucinated
// claims beyond the provided context) and relevance (actually answers the
// question), using Claude itself as the grader.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildJudgePrompt(question, context, answer) {
  return `You are grading a RAG system's answer for quality. Score it on two dimensions from 1 (worst) to 5 (best):

- faithfulness: does the answer only make claims supported by the provided context, without adding unsupported information? An answer that correctly says the context doesn't cover the question (when it genuinely doesn't) should score 5.
- relevance: does the answer actually address the question asked?

QUESTION:
${question}

CONTEXT PROVIDED TO THE ANSWERING MODEL:
${context}

ANSWER TO GRADE:
${answer}

Respond with ONLY a JSON object, no other text, in this exact shape:
{"faithfulness": <1-5>, "relevance": <1-5>, "reasoning": "<one sentence>"}`;
}

export async function judgeAnswer({ question, context, answer }) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: buildJudgePrompt(question, context, answer) }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    return { faithfulness: null, relevance: null, reasoning: `Failed to parse judge output: ${text}` };
  }
}
