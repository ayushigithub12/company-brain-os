// @ts-nocheck
// src/app/api/workspace/members/route.ts
// GET — list members, DELETE — remove member, PATCH — update role

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
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        workspace,
        members: members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.createdAt,
          user: m.user,
          isCurrentUser: m.userId === session.user.id,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, memberId, role } = await req.json();

    // Check requester is owner
    const requester = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });

    if (!requester || requester.role !== "OWNER") {
      return NextResponse.json({ success: false, error: "Only owners can change roles" }, { status: 403 });
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, memberId, userId } = await req.json();

    const requester = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });

    // Can remove yourself (leave) or owner/admin can remove others
    const isSelf = userId === session.user.id;
    const canRemove = isSelf || ["OWNER", "ADMIN"].includes(requester?.role ?? "");

    if (!canRemove) {
      return NextResponse.json({ success: false, error: "Not authorized to remove this member" }, { status: 403 });
    }

    // Prevent owner from leaving if they are the only owner
    if (isSelf && requester?.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json({
          success: false,
          error: "You are the only owner. Transfer ownership before leaving.",
        }, { status: 400 });
      }
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to remove member" }, { status: 500 });
  }
}