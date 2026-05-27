// src/lib/rag/ingest.ts
// Ingestion pipeline: RawDocument → chunks → embeddings → Pinecone + DB

import { prisma } from "@/lib/db/prisma";
import { chunkText } from "@/lib/rag/chunker";
import { getEmbedder } from "@/lib/rag/embeddings";
import { upsertVectors, deleteDocumentVectors, type VectorRecord } from "@/lib/rag/vectorstore";
import type { RawDocument } from "@/types";

export interface IngestResult {
  documentId: string;
  title: string;
  chunkCount: number;
  tokenCount: number;
  status: "indexed" | "failed" | "skipped";
  error?: string;
}

export async function ingestDocument(
  doc: RawDocument,
  workspaceId: string,
  connectorId: string | null
): Promise<IngestResult> {
  let dbDocId: string | undefined;

  try {
    console.log(`[Ingest] Processing: "${doc.title}"`);

    // ── 1. Check if document exists and is unchanged ──
    const existingDoc = await prisma.sourceDocument.findUnique({
      where: {
        workspaceId_sourceType_sourceId: {
          workspaceId,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
        },
      },
    });

    // Skip if already indexed and source hasn't been modified
    if (
      existingDoc &&
      existingDoc.status === "INDEXED" &&
      existingDoc.sourceUpdatedAt &&
      doc.metadata.updatedAt &&
      new Date(doc.metadata.updatedAt as string) <= existingDoc.sourceUpdatedAt
    ) {
      console.log(`[Ingest] Skipping unchanged: "${doc.title}"`);
      return {
        documentId: existingDoc.id,
        title: doc.title,
        chunkCount: 0,
        tokenCount: 0,
        status: "skipped",
      };
    }

    // ── 2. Upsert document record (new or changed) ──
    const dbDoc = await prisma.sourceDocument.upsert({
      where: {
        workspaceId_sourceType_sourceId: {
          workspaceId,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
        },
      },
      create: {
        workspaceId,
        connectorId,
        sourceId: doc.sourceId,
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl,
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata as object,
        status: "PENDING",
        sourceUpdatedAt: doc.metadata.updatedAt ? new Date(doc.metadata.updatedAt as string) : null,
      },
      update: {
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata as object,
        status: "PENDING",
        sourceUpdatedAt: doc.metadata.updatedAt ? new Date(doc.metadata.updatedAt as string) : null,
        updatedAt: new Date(),
      },
    });

    dbDocId = dbDoc.id;

    // ── 3. Delete old chunks and vectors (re-index) ──
    const existingChunks = await prisma.documentChunk.findMany({
      where: { documentId: dbDoc.id },
      select: { id: true },
    });

    if (existingChunks.length > 0) {
      await prisma.documentChunk.deleteMany({ where: { documentId: dbDoc.id } });
      await deleteDocumentVectors(dbDoc.id, workspaceId);
    }

    // ── 4. Chunk the content ─────────────────────
    const chunks = chunkText(doc.content, {
      chunkSize: 512,
      overlap: 64,
      preserveHeadings: true,
    });

    if (chunks.length === 0) {
      await prisma.sourceDocument.update({
        where: { id: dbDoc.id },
        data: { status: "FAILED" },
      });
      return { documentId: dbDoc.id, title: doc.title, chunkCount: 0, tokenCount: 0, status: "skipped" };
    }

    // ── 5. Embed chunks ───────────────────────────
    const embedder = getEmbedder();
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embedder.embed(chunkTexts);

    // ── 6. Save chunks to DB ─────────────────────
    const chunkRecords = await prisma.$transaction(
      chunks.map((chunk, i) =>
        prisma.documentChunk.create({
          data: {
            workspaceId,
            documentId: dbDoc.id,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            heading: chunk.metadata?.heading ?? null,
            vectorId: `${dbDoc.id}_chunk_${i}`,
          },
        })
      )
    );

    // ── 7. Upsert vectors into Pinecone ──────────
    const vectorRecords: VectorRecord[] = chunks.map((chunk, i) => ({
      id: `${dbDoc.id}_chunk_${i}`,
      values: embeddings[i],
      metadata: {
        workspaceId,
        documentId: dbDoc.id,
        chunkId: chunkRecords[i].id,
        content: chunk.content,
        title: doc.title,
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl ?? "",
        heading: chunk.metadata?.heading ?? "",
        chunkIndex: chunk.chunkIndex,
      },
    }));

    await upsertVectors(vectorRecords);

    // ── 8. Mark as indexed ───────────────────────
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    await prisma.sourceDocument.update({
      where: { id: dbDoc.id },
      data: { status: "INDEXED", lastIndexedAt: new Date() },
    });

    console.log(`[Ingest] ✓ "${doc.title}" → ${chunks.length} chunks, ~${totalTokens} tokens`);

    return {
      documentId: dbDoc.id,
      title: doc.title,
      chunkCount: chunks.length,
      tokenCount: totalTokens,
      status: "indexed",
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Ingest] ✗ "${doc.title}":`, error);

    if (dbDocId) {
      await prisma.sourceDocument.update({
        where: { id: dbDocId },
        data: { status: "FAILED" },
      }).catch(() => {});
    }

    return {
      documentId: dbDocId ?? "unknown",
      title: doc.title,
      chunkCount: 0,
      tokenCount: 0,
      status: "failed",
      error,
    };
  }
}

export async function ingestBatch(
  docs: RawDocument[],
  workspaceId: string,
  connectorId: string | null,
  onProgress?: (done: number, total: number, result: IngestResult) => void
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  for (let i = 0; i < docs.length; i++) {
    const result = await ingestDocument(docs[i], workspaceId, connectorId);
    results.push(result);
    onProgress?.(i + 1, docs.length, result);
    await new Promise((r) => setTimeout(r, 200));
  }

  if (connectorId) {
    const indexed = results.filter((r) => r.status === "indexed").length;
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: "CONNECTED",
        lastSyncAt: new Date(),
        syncCount: { increment: 1 },
        lastSyncError: results.some((r) => r.status === "failed")
          ? `${results.filter((r) => r.status === "failed").length} documents failed to index`
          : null,
      },
    }).catch(() => {});

    console.log(`[Ingest] Batch complete: ${indexed}/${docs.length} indexed`);
  }

  return results;
}