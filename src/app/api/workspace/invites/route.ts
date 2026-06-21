// @ts-nocheck
// src/app/api/workspace/invites/route.ts
// GET — returns sent and received invites for current user

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure user exists in DB
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json({ success: true, data: { sent: [], received: [] } });
    }

    const [sent, received] = await Promise.all([
      prisma.invite.findMany({
        where: { inviterId: user.id },
        include: {
          invitee: { select: { name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invite.findMany({
        where: { inviteeId: user.id },
        include: {
          inviter: { select: { name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: { sent, received } });
  } catch (err) {
    console.error("[Invites]", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}