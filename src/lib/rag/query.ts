// @ts-nocheck
// src/lib/rag/query.ts — searches own workspace + all invited workspaces

import { prisma } from "@/lib/db/prisma";
import { getEmbedder } from "@/lib/rag/embeddings";
import { searchVectors } from "@/lib/rag/vectorstore";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Company Brain — an AI assistant that answers questions about how this company operates.
Answer using ONLY the provided context. Reference document titles when citing.
If context doesn't contain the answer say: "I don't have documented information about this."
Never make up facts. Be direct and concise. End with: Sources: [Document Name]`;

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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

  if (!response.ok) throw new Error(`Groq API error: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "Unable to generate answer.";
}

export async function queryBrain(request: any, userId?: string): Promise<any> {
  const { query, workspaceId, topK = 8 } = request;

  // Get all workspace IDs this user has access to (own + invited)
  const invites = userId ? await prisma.invite.findMany({
    where: { inviteeId: userId },
    select: { workspaceId: true },
  }) : [];

  const allWorkspaceIds = [workspaceId, ...invites.map((i: any) => i.workspaceId)];

  // Embed query
  const embedder = getEmbedder();
  const queryEmbedding = await embedder.embedQuery(query);

  // Search across ALL accessible workspaces
  const perWorkspace = Math.max(3, Math.ceil(topK / allWorkspaceIds.length));
  const allResults = await Promise.all(
    allWorkspaceIds.map(wsId => searchVectors(queryEmbedding, wsId, { topK: perWorkspace }))
  );

  // Merge and sort by score
  const sources = allResults
    .flat()
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topK)
    .filter((r: any) => r.score > 0.3)
    .map((r: any) => ({
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

  const contextBlock = answered
    ? sources.map((s: any, i: number) =>
        `[Source ${i + 1}: ${s.documentTitle}${s.heading ? ` › ${s.heading}` : ""}]\n${s.content}`
      ).join("\n\n---\n\n")
    : "No relevant documents found.";

  const answer = await callGroq(
    `Question: ${query}\n\nRetrieved knowledge:\n${contextBlock}\n\nAnswer based only on the context above.`
  );

  const avgScore = sources.length > 0
    ? sources.reduce((sum: number, s: any) => sum + s.score, 0) / sources.length
    : 0;
  const confidence = answered ? Math.min(avgScore * 1.2, 0.99) : 0.05;

  const queryLog = await prisma.queryLog.create({
    data: {
      workspaceId,
      userId: userId ?? null,
      query,
      answer,
      confidence,
      answered,
      sources: sources.map((s: any) => ({
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
  return gaps.map((g: any) => ({ query: g.query, count: g._count.query }));
}