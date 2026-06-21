// @ts-nocheck
// src/app/api/workspace/bootstrap/route.ts
// Every user gets their own workspace as admin

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
    const { userName } = await req.json();

    // Upsert user in DB (needed since we use JWT not DB sessions)
    await prisma.user.upsert({
      where: { email: session.user.email! },
      create: {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name,
        image: session.user.image,
      },
      update: {
        name: session.user.name,
        image: session.user.image,
      },
    });

    // Find existing workspace owned by this user
    const existing = await prisma.workspace.findFirst({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      // Check for unseen invites
      const unseenInvites = await prisma.invite.findMany({
        where: { inviteeId: session.user.id, seen: false },
        include: { inviter: { select: { name: true, email: true } } },
      });

      return NextResponse.json({
        success: true,
        data: {
          workspaceId: existing.id,
          workspaceName: existing.name,
          unseenInvites: unseenInvites.map(i => ({
            id: i.id,
            inviterName: i.inviter.name,
            inviterEmail: i.inviter.email,
          })),
        },
      });
    }

    // Create new workspace for this user
    const slug = `${(session.user.name ?? "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}-${Date.now().toString(36)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: `${session.user.name ?? "My"}'s Brain`,
        slug,
        ownerId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        unseenInvites: [],
      },
    });
  } catch (err) {
    console.error("[Bootstrap]", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
