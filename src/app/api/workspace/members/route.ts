// @ts-nocheck
// src/app/api/workspace/members/route.ts
// Now replaced by invite system — kept for backward compatibility

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
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: { select: { id: true, name: true, email: true, image: true } } },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Get people invited to this workspace
    const invites = await prisma.invite.findMany({
      where: { workspaceId },
      include: { invitee: { select: { id: true, name: true, email: true, image: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        workspace: { id: workspace.id, name: workspace.name },
        owner: workspace.owner,
        members: invites.map(i => ({
          id: i.id,
          user: i.invitee,
          joinedAt: i.createdAt,
        })),
        isOwner: workspace.ownerId === user?.id,
      },
    });
  } catch (err) {
    console.error("[Members]", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}