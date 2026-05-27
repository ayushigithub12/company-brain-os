// src/app/api/workspace/stats/route.ts
// GET /api/workspace/stats?workspaceId=xxx — returns dashboard counts

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
    const [
      documentCount,
      chunkCount,
      processCardCount,
      verifiedCardCount,
      gapCount,
      connectors,
    ] = await Promise.all([
      prisma.sourceDocument.count({ where: { workspaceId, status: "INDEXED" } }),
      prisma.documentChunk.count({ where: { workspaceId } }),
      prisma.processCard.count({ where: { workspaceId } }),
      prisma.processCard.count({ where: { workspaceId, status: "VERIFIED" } }),
      prisma.queryLog.count({ where: { workspaceId, answered: false } }),
      prisma.connector.findMany({
        where: { workspaceId },
        select: { id: true, type: true, name: true, status: true, lastSyncAt: true, syncCount: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        documentCount,
        chunkCount,
        processCardCount,
        verifiedCardCount,
        gapCount,
        connectorCount: connectors.length,
        activeConnectors: connectors.filter((c) => c.status === "CONNECTED").length,
        connectors,
      },
    });
  } catch (err) {
    console.error("[Stats]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 });
  }
}
