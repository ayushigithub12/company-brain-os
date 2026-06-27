// @ts-nocheck
// src/app/api/cards/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const card = await prisma.processCard.findUnique({
      where: { id: params.id },
      include: { verifiedBy: { select: { name: true, image: true } } },
    });
    if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: card });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { action, name, description, trigger, steps, exceptions, owners, tags } = body;

    let updateData: any = {};
    if (action === "verify") {
      updateData = { status: "VERIFIED", verifiedById: session.user.id, verifiedAt: new Date() };
    } else if (action === "reject") {
      updateData = { status: "NEEDS_REVIEW" };
    } else if (action === "archive") {
      updateData = { status: "ARCHIVED" };
    } else {
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (trigger !== undefined) updateData.trigger = trigger;
      if (steps !== undefined) updateData.steps = steps;
      if (exceptions !== undefined) updateData.exceptions = exceptions;
      if (owners !== undefined) updateData.owners = owners;
      if (tags !== undefined) updateData.tags = tags;
    }

    const card = await prisma.processCard.update({
      where: { id: params.id },
      data: updateData,
      include: { verifiedBy: { select: { name: true, image: true } } },
    });
    return NextResponse.json({ success: true, data: card });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const card = await prisma.processCard.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });
    if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    const workspace = await prisma.workspace.findFirst({
      where: { id: card.workspaceId, ownerId: user?.id },
    });
    if (!workspace) {
      return NextResponse.json({ success: false, error: "Only workspace owner can delete cards" }, { status: 403 });
    }

    await prisma.processCard.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}