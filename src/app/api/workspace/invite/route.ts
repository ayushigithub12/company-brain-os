// @ts-nocheck
// src/app/api/workspace/invite/route.ts
// Invite someone — max 5 invites per user

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, workspaceId } = await req.json();

    if (!email || !workspaceId) {
      return NextResponse.json({ success: false, error: "email and workspaceId required" }, { status: 400 });
    }

    // Verify inviter owns this workspace
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: session.user.id },
    });

    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Check invite limit — max 5
    const inviteCount = await prisma.invite.count({
      where: { inviterId: session.user.id },
    });

    if (inviteCount >= 5) {
      return NextResponse.json({
        success: false,
        error: "You have reached the maximum of 5 invites",
      }, { status: 403 });
    }

    // Find invitee
    const invitee = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!invitee) {
      return NextResponse.json({
        success: false,
        error: "No account found with that email. They must sign into Company Brain OS first.",
      }, { status: 404 });
    }

    if (invitee.id === session.user.id) {
      return NextResponse.json({ success: false, error: "You cannot invite yourself" }, { status: 400 });
    }

    // Check if already invited
    const existing = await prisma.invite.findUnique({
      where: { inviterId_inviteeId: { inviterId: session.user.id, inviteeId: invitee.id } },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "Already invited this person" }, { status: 409 });
    }

    // Create invite
    const invite = await prisma.invite.create({
      data: {
        inviterId: session.user.id,
        inviteeId: invitee.id,
        workspaceId,
        seen: false,
      },
      include: {
        invitee: { select: { name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        invite: {
          id: invite.id,
          invitee: invite.invitee,
          createdAt: invite.createdAt,
        },
        remainingInvites: 5 - (inviteCount + 1),
      },
    });
  } catch (err) {
    console.error("[Invite]", err);
    return NextResponse.json({ success: false, error: "Failed to invite" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { inviteId } = await req.json();

    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.inviterId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Invite not found" }, { status: 404 });
    }

    await prisma.invite.delete({ where: { id: inviteId } });

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (err) {
    console.error("[Remove Invite]", err);
    return NextResponse.json({ success: false, error: "Failed to remove invite" }, { status: 500 });
  }
}
