// @ts-nocheck
// src/app/api/workspace/stats/route.ts - sequential queries to avoid connection pool exhaustion

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
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (!user) {
      return NextResponse.json({ success: true, data: { documentCount: 0, chunkCount: 0, processCardCount: 0, verifiedCardCount: 0, gapCount: 0, connectorCount: 0, activeConnectors: 0, connectors: [], invitedWorkspaces: [] } });
    }

    const invites = await prisma.invite.findMany({
      where: { inviteeId: user.id },
      select: { workspaceId: true, inviter: { select: { name: true } } },
    });

    const allWorkspaceIds = [workspaceId, ...invites.map((i: any) => i.workspaceId)];

    // Sequential queries — avoids connection pool exhaustion on free tier
    const documentCount = await prisma.sourceDocument.count({ where: { workspaceId: { in: allWorkspaceIds }, status: "INDEXED" } });
    const chunkCount = await prisma.documentChunk.count({ where: { workspaceId: { in: allWorkspaceIds } } });
    const processCardCount = await prisma.processCard.count({ where: { workspaceId: { in: allWorkspaceIds } } });
    const verifiedCardCount = await prisma.processCard.count({ where: { workspaceId: { in: allWorkspaceIds }, status: "VERIFIED" } });
    const gapCount = await prisma.queryLog.count({ where: { workspaceId, answered: false } });
    const connectors = await prisma.connector.findMany({
      where: { workspaceId: { in: allWorkspaceIds } },
      select: { id: true, type: true, name: true, status: true, lastSyncAt: true, syncCount: true, workspaceId: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        documentCount,
        chunkCount,
        processCardCount,
        verifiedCardCount,
        gapCount,
        connectorCount: connectors.length,
        activeConnectors: connectors.filter((c: any) => c.status === "CONNECTED").length,
        connectors: connectors.map((c: any) => ({
          ...c,
          isOwn: c.workspaceId === workspaceId,
          inviterName: invites.find((i: any) => i.workspaceId === c.workspaceId)?.inviter?.name ?? null,
        })),
        invitedWorkspaces: invites.map((i: any) => ({ workspaceId: i.workspaceId, inviterName: i.inviter.name })),
      },
    });
  } catch (err) {
    console.error("[Stats]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 });
  }
}