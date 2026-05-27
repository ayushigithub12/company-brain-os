// @ts-nocheck
// src/app/api/gaps/route.ts
// GET /api/gaps?workspaceId=xxx — returns knowledge gaps (unanswered queries)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "workspaceId required" }, { status: 400 });
  }

  try {
    // Get all unanswered queries
    const unanswered = await prisma.queryLog.findMany({
      where: { workspaceId, answered: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, query: true, createdAt: true },
    });

    // Get low confidence answered queries (< 40%)
    const lowConfidence = await prisma.queryLog.findMany({
      where: {
        workspaceId,
        answered: true,
        confidence: { lt: 0.4 },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, query: true, confidence: true, createdAt: true },
      take: 20,
    });

    // Group unanswered by similar queries
    const grouped = unanswered.reduce((acc, log) => {
      const existing = acc.find(
        (g) => g.query.toLowerCase().trim() === log.query.toLowerCase().trim()
      );
      if (existing) {
        existing.count += 1;
        existing.lastAsked = log.createdAt;
      } else {
        acc.push({
          query: log.query,
          count: 1,
          firstAsked: log.createdAt,
          lastAsked: log.createdAt,
          ids: [log.id],
        });
      }
      return acc;
    }, []);

    // Sort by frequency
    grouped.sort((a, b) => b.count - a.count);

    // Stale cards — not updated in 30+ days, still VERIFIED
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const staleCards = await prisma.processCard.findMany({
      where: {
        workspaceId,
        status: "VERIFIED",
        updatedAt: { lt: thirtyDaysAgo },
      },
      orderBy: { updatedAt: "asc" },
      select: { id: true, name: true, updatedAt: true, owners: true, confidence: true },
    });

    // Summary stats
    const totalQueries = await prisma.queryLog.count({ where: { workspaceId } });
    const answeredCount = await prisma.queryLog.count({ where: { workspaceId, answered: true } });

    return NextResponse.json({
      success: true,
      data: {
        gaps: grouped.slice(0, 30),
        lowConfidenceQueries: lowConfidence,
        staleCards,
        stats: {
          totalQueries,
          answeredCount,
          unansweredCount: unanswered.length,
          answerRate: totalQueries > 0 ? Math.round((answeredCount / totalQueries) * 100) : 0,
          staleCardCount: staleCards.length,
        },
      },
    });
  } catch (err) {
    console.error("[Gaps API]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch gaps" }, { status: 500 });
  }
}