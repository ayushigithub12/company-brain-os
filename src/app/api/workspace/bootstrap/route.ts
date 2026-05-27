// @ts-nocheck
// src/app/api/workspace/bootstrap/route.ts
// Determines workspace and role for a user on login

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isAdminEmail } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userName } = await req.json();
    const userEmail = session.user.email ?? "";

    // ── Check if user already has a workspace membership ──
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingMembership) {
      // If user is admin email but stored as OWNER, upgrade to ADMIN
      if (isAdminEmail(userEmail) && existingMembership.role !== "ADMIN") {
        await prisma.workspaceMember.update({
          where: { id: existingMembership.id },
          data: { role: "ADMIN" },
        });
        return NextResponse.json({
          success: true,
          data: {
            workspaceId: existingMembership.workspaceId,
            workspaceName: existingMembership.workspace.name,
            role: "ADMIN",
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          workspaceId: existingMembership.workspaceId,
          workspaceName: existingMembership.workspace.name,
          role: existingMembership.role,
        },
      });
    }

    // ── New user — determine their role ──
    const role = isAdminEmail(userEmail) ? "ADMIN" : "OWNER";

    // Create their own workspace
    const slug = `${(userName ?? "workspace")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}-${Date.now().toString(36)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: userName ? `${userName}'s Company Brain` : "My Company Brain",
        slug,
        members: {
          create: {
            userId: session.user.id,
            role,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        role,
      },
    });
  } catch (err) {
    console.error("[Bootstrap]", err);
    return NextResponse.json(
      { success: false, error: "Failed to bootstrap workspace" },
      { status: 500 }
    );
  }
}
