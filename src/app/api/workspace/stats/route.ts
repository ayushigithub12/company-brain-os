// @ts-nocheck
// src/app/api/workspace/stats/route.ts
// Returns stats for own workspace + all invited workspaces combined

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
    // Get all workspace IDs this user has access to (own + invited)
    const invites = await prisma.invite.findMany({
      where: { inviteeId: session.user.id },
      select: { workspaceId: true, inviter: { select: { name: true, email: true } } },
    });

    const allWorkspaceIds = [workspaceId, ...invites.map(i => i.workspaceId)];

    const [documentCount, chunkCount, processCardCount, verifiedCardCount, gapCount, connectors] =
      await Promise.all([
        prisma.sourceDocument.count({ where: { workspaceId: { in: allWorkspaceIds }, status: "INDEXED" } }),
        prisma.documentChunk.count({ where: { workspaceId: { in: allWorkspaceIds } } }),
        prisma.processCard.count({ where: { workspaceId: { in: allWorkspaceIds } } }),
        prisma.processCard.count({ where: { workspaceId: { in: allWorkspaceIds }, status: "VERIFIED" } }),
        prisma.queryLog.count({ where: { workspaceId, answered: false } }),
        prisma.connector.findMany({
          where: { workspaceId: { in: allWorkspaceIds } },
          select: {
            id: true, type: true, name: true, status: true,
            lastSyncAt: true, syncCount: true, workspaceId: true,
          },
        }),
      ]);

    // Tag each connector with whether it's own or from an invite
    const connectorsWithSource = connectors.map(c => ({
      ...c,
      isOwn: c.workspaceId === workspaceId,
      inviterName: invites.find(i => i.workspaceId === c.workspaceId)?.inviter?.name ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        documentCount,
        chunkCount,
        processCardCount,
        verifiedCardCount,
        gapCount,
        connectorCount: connectors.length,
        activeConnectors: connectors.filter(c => c.status === "CONNECTED").length,
        connectors: connectorsWithSource,
        invitedWorkspaces: invites.map(i => ({
          workspaceId: i.workspaceId,
          inviterName: i.inviter.name,
        })),
      },
    });
  } catch (err) {
    console.error("[Stats]", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
