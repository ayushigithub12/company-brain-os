// @ts-nocheck
// src/app/api/cards/extract/route.ts
// POST /api/cards/extract — triggers process card extraction for a workspace

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractProcessCards } from "@/lib/cards/extractor";
import { z } from "zod";

const Schema = z.object({
  workspaceId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { workspaceId } = Schema.parse(body);

    console.log(`[API] Starting card extraction for workspace: ${workspaceId}`);
    const result = await extractProcessCards(workspaceId);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[Cards Extract]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}