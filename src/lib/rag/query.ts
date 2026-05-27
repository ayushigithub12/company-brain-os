// @ts-nocheck
// src/lib/rag/query.ts — RAG query engine using Groq (free, no billing needed)

import { prisma } from "@/lib/db/prisma";
import { getEmbedder } from "@/lib/rag/embeddings";
import { searchVectors } from "@/lib/rag/vectorstore";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Company Brain — an AI assistant that answers questions about how this specific company operates.

You are given retrieved excerpts from the company's internal documents. Your job is to:
1. Answer the question using ONLY the provided context
2. Reference document titles when citing information
3. If the context doesn't contain the answer, say clearly: "I don't have documented information about this."
4. Never make up company-specific facts

Be direct, factual, and concise. End with: Sources: [Document Name]`;

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "Unable to generate answer.";
}

export async function queryBrain(request: any, userId?: string): Promise<any> {
  const { query, workspaceId, topK = 8 } = request;

  // 1. Embed the query
  const embedder = getEmbedder();
  const queryEmbedding = await embedder.embedQuery(query);

  // 2. Retrieve chunks from Pinecone
  const vectorResults = await searchVectors(queryEmbedding, workspaceId, { topK });

  // 3. Build source objects
  const sources = vectorResults
    .filter((r) => r.score > 0.3)
    .map((r) => ({
      chunkId: r.metadata.chunkId,
      documentId: r.metadata.documentId,
      documentTitle: r.metadata.title,
      sourceType: r.metadata.sourceType,
      sourceUrl: r.metadata.sourceUrl || undefined,
      content: r.metadata.content,
      score: r.score,
      heading: r.metadata.heading || undefined,
    }));

  const answered = sources.length > 0;

  // 4. Build context
  let contextBlock = answered
    ? sources.map((s, i) => {
        const heading = s.heading ? ` › ${s.heading}` : "";
        return `[Source ${i + 1}: ${s.documentTitle}${heading}]\n${s.content}`;
      }).join("\n\n---\n\n")
    : "No relevant documents found in the company knowledge base.";

  const prompt = `Question: ${query}

Retrieved company knowledge:
${contextBlock}

Answer based only on the context above.`;

  // 5. Call Groq
  const answer = await callGroq(prompt);

  // 6. Confidence score
  const avgScore = sources.length > 0
    ? sources.reduce((sum, s) => sum + s.score, 0) / sources.length
    : 0;
  const confidence = answered ? Math.min(avgScore * 1.2, 0.99) : 0.05;

  // 7. Log query
  const queryLog = await prisma.queryLog.create({
    data: {
      workspaceId,
      userId: userId ?? null,
      query,
      answer,
      confidence,
      answered,
      sources: sources.map((s) => ({
        documentId: s.documentId,
        title: s.documentTitle,
        score: s.score,
      })),
    },
  });

  return { answer, confidence, sources, answered, queryLogId: queryLog.id };
}

export async function getGapSignals(workspaceId: string, limit = 20) {
  const gaps = await prisma.queryLog.groupBy({
    by: ["query"],
    where: { workspaceId, answered: false },
    _count: { query: true },
    orderBy: { _count: { query: "desc" } },
    take: limit,
  });
  return gaps.map((g) => ({ query: g.query, count: g._count.query }));
}