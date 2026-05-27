// @ts-nocheck
// src/app/api/cards/list/route.ts
// GET /api/cards/list?workspaceId=xxx&status=DRAFT

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
  const status = req.nextUrl.searchParams.get("status"); // optional filter
  const search = req.nextUrl.searchParams.get("search"); // optional search

  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "workspaceId required" }, { status: 400 });
  }

  try {
    const where: any = { workspaceId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const cards = await prisma.processCard.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      include: {
        verifiedBy: { select: { name: true, image: true } },
      },
    });

    return NextResponse.json({ success: true, data: cards });
  } catch (err) {
    console.error("[Cards List]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch cards" }, { status: 500 });
  }
}