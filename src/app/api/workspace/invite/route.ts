// @ts-nocheck
// src/app/api/workspace/invite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getInvitableRoles, can } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, email, role } = await req.json();

    if (!workspaceId || !email || !role) {
      return NextResponse.json({ success: false, error: "workspaceId, email, and role required" }, { status: 400 });
    }

    // Get inviter's role in this workspace
    const inviterMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });

    if (!inviterMember || !can.inviteUsers(inviterMember.role)) {
      return NextResponse.json({ success: false, error: "You don't have permission to invite users" }, { status: 403 });
    }

    // Validate role is allowed for this inviter
    const invitableRoles = getInvitableRoles(inviterMember.role);
    if (!invitableRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        error: `As ${inviterMember.role}, you can only invite: ${invitableRoles.join(", ")}`,
      }, { status: 403 });
    }

    // Find invited user
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!invitedUser) {
      return NextResponse.json({
        success: false,
        error: "No account found with that email. They must sign into Company Brain OS first.",
      }, { status: 404 });
    }

    // Add or update workspace membership
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: invitedUser.id } },
    });

    if (existing) {
      await prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { role },
      });
    } else {
      await prisma.workspaceMember.create({
        data: { workspaceId, userId: invitedUser.id, role },
      });
    }

    // Record the invitation relationship
    await prisma.invitationRecord.upsert({
      where: {
        workspaceId_inviterId_inviteeId: {
          workspaceId,
          inviterId: session.user.id,
          inviteeId: invitedUser.id,
        },
      },
      create: {
        workspaceId,
        inviterId: session.user.id,
        inviteeId: invitedUser.id,
        role,
      },
      update: { role },
    });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: invitedUser.id } },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        member: { id: member?.id, role: member?.role, user: member?.user },
        message: `${invitedUser.name ?? email} invited as ${role}`,
      },
    });
  } catch (err) {
    console.error("[Invite]", err);
    return NextResponse.json({ success: false, error: "Failed to invite member" }, { status: 500 });
  }
}
