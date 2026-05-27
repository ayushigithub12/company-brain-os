// src/app/api/connectors/notion/callback/route.ts
// For internal token auth — creates connector record directly using the token from env

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
    const { workspaceId } = await req.json();

    const token = process.env.NOTION_CLIENT_ID;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "NOTION_CLIENT_ID not set in environment" },
        { status: 500 }
      );
    }

    // Upsert the Notion connector using the internal token
    const existing = await prisma.connector.findFirst({
      where: { workspaceId, type: "NOTION" },
      select: { id: true },
    });

    const connector = await prisma.connector.upsert({
      where: { id: existing?.id ?? "new-notion" },
      create: {
        workspaceId,
        type: "NOTION",
        name: "Notion — Internal Integration",
        status: "CONNECTED",
        accessToken: token,
        config: { method: "internal_token" },
      },
      update: {
        status: "CONNECTED",
        accessToken: token,
        lastSyncError: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { connectorId: connector.id, message: "Notion connected successfully" },
    });
  } catch (err) {
    console.error("[Notion Setup]", err);
    return NextResponse.json(
      { success: false, error: "Failed to setup Notion connector" },
      { status: 500 }
    );
  }
}

// Keep GET for any redirects
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard?success=notion_connected", req.url));
}