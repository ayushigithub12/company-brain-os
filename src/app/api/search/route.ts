// @ts-nocheck
// src/app/api/search/route.ts
// GET /api/search?workspaceId=xxx&q=keyword — searches documents + cards

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getEmbedder } from "@/lib/rag/embeddings";
import { searchVectors } from "@/lib/rag/vectorstore";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const q = req.nextUrl.searchParams.get("q");

  if (!workspaceId || !q || q.trim().length < 2) {
    return NextResponse.json({ success: false, error: "workspaceId and q required" }, { status: 400 });
  }

  try {
    // 1. Semantic search in Pinecone for document chunks
    const embedder = getEmbedder();
    const queryEmbedding = await embedder.embedQuery(q);
    const vectorResults = await searchVectors(queryEmbedding, workspaceId, { topK: 5 });

    const docResults = vectorResults
      .filter((r) => r.score > 0.25)
      .map((r) => ({
        type: "document",
        id: r.metadata.documentId,
        title: r.metadata.title,
        excerpt: r.metadata.content.slice(0, 200) + "…",
        score: r.score,
        sourceUrl: r.metadata.sourceUrl || null,
        heading: r.metadata.heading || null,
        sourceType: r.metadata.sourceType,
      }));

    // 2. Text search in process cards
    const cardResults = await prisma.processCard.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { trigger: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
          { owners: { has: q } },
        ],
      },
      take: 5,
      orderBy: { confidence: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        confidence: true,
        tags: true,
        owners: true,
      },
    });

    const cards = cardResults.map((c) => ({
      type: "card",
      id: c.id,
      title: c.name,
      excerpt: c.description ?? "Process card",
      score: c.confidence,
      status: c.status,
      tags: c.tags,
    }));

    // Merge and sort by score
    const results = [...docResults, ...cards].sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      data: {
        results,
        query: q,
        total: results.length,
        docCount: docResults.length,
        cardCount: cards.length,
      },
    });
  } catch (err) {
    console.error("[Search API]", err);
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}