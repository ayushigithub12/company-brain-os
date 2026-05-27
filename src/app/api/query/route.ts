// src/app/api/query/route.ts
// POST /api/query — the core RAG endpoint

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryBrain } from "@/lib/rag/query";
import { z } from "zod";

const QuerySchema = z.object({
  query: z.string().min(3).max(2000),
  workspaceId: z.string().cuid(),
  topK: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = QuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await queryBrain(parsed.data, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[API /query]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}