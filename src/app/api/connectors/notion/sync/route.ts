// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { fetchAllNotionPages } from "@/lib/connectors/notion";
import { ingestBatch } from "@/lib/rag/ingest";
import { extractProcessCards } from "@/lib/cards/extractor";
import { z } from "zod";

const SyncSchema = z.object({
  workspaceId: z.string().cuid(),
  connectorId: z.string().cuid(),
  autoExtract: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { workspaceId, connectorId, autoExtract } = SyncSchema.parse(body);

    // Check user owns this workspace
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: user?.id },
    });
    if (!workspace) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 403 });
    }
    const connector = await prisma.connector.findFirst({
      where: { id: connectorId, workspaceId, type: "NOTION" },
    });
    if (!connector?.accessToken) {
      return NextResponse.json({ success: false, error: "Connector not authenticated" }, { status: 400 });
    }

    await prisma.connector.update({ where: { id: connectorId }, data: { status: "SYNCING" } });

    const rawDocs = await fetchAllNotionPages(connector.accessToken, { maxPages: 500 });

    if (rawDocs.length === 0) {
      await prisma.connector.update({
        where: { id: connectorId },
        data: { status: "CONNECTED", lastSyncAt: new Date(), syncCount: { increment: 1 } },
      });
      return NextResponse.json({ success: true, data: { message: "No pages found in Notion", indexed: 0, failed: 0, skipped: 0, cardsExtracted: 0 } });
    }

    const results = await ingestBatch(rawDocs, workspaceId, connectorId);
    const indexed = results.filter((r) => r.status === "indexed").length;
    const failed  = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    let cardsExtracted = 0;
    const existingCardCount = await prisma.processCard.count({ where: { workspaceId } });
    const shouldExtract = autoExtract && (indexed > 0 || existingCardCount === 0);

    if (shouldExtract) {
      const newDocIds = indexed > 0
        ? results.filter((r) => r.status === "indexed").map((r) => r.documentId)
        : undefined;
      try {
        const extractResult = await extractProcessCards(workspaceId, newDocIds);
        cardsExtracted = extractResult.cardsFound;
      } catch (err) {
        console.error("[Sync] Card extraction failed (non-fatal):", err);
      }
    }

    const message = indexed === 0
      ? "Everything is up to date — no changes found"
      : `${indexed} page${indexed !== 1 ? "s" : ""} updated${cardsExtracted > 0 ? `, ${cardsExtracted} new card${cardsExtracted !== 1 ? "s" : ""} extracted` : ""}`;

    return NextResponse.json({ success: true, data: { total: rawDocs.length, indexed, failed, skipped, cardsExtracted, message } });
  } catch (err) {
    console.error("[Notion Sync]", err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}