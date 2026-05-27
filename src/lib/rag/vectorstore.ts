// src/lib/rag/vectorstore.ts
// Pinecone vector store — stores and retrieves chunk embeddings

import { Pinecone } from "@pinecone-database/pinecone";

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    workspaceId: string;
    documentId: string;
    chunkId: string;
    content: string;      // stored for retrieval without DB hit
    title: string;
    sourceType: string;
    sourceUrl?: string;
    heading?: string;
    chunkIndex: number;
  };
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorRecord["metadata"];
}

let _pinecone: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!_pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY not set");
    _pinecone = new Pinecone({ apiKey });
  }
  return _pinecone;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME ?? "company-brain";
  return getPinecone().index(indexName);
}

/**
 * Upsert vector records into Pinecone.
 * Uses batching to respect Pinecone's 100-vector-per-request limit.
 */
export async function upsertVectors(records: VectorRecord[]): Promise<void> {
  const index = getIndex();
  const batchSize = 100;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await index.upsert(
      batch.map((r) => ({
        id: r.id,
        values: r.values,
        metadata: r.metadata as Record<string, string | number | boolean | string[]>,
      }))
    );
  }
}

/**
 * Semantic search in Pinecone.
 * Filters by workspaceId for multi-tenant isolation.
 */
export async function searchVectors(
  queryEmbedding: number[],
  workspaceId: string,
  options: {
    topK?: number;
    filter?: Record<string, unknown>;
  } = {}
): Promise<VectorSearchResult[]> {
  const { topK = 8, filter = {} } = options;
  const index = getIndex();

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: {
      workspaceId: { $eq: workspaceId },
      ...filter,
    },
  });

  return (results.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata as VectorRecord["metadata"],
  }));
}

/**
 * Delete all vectors for a document (called when re-indexing or deleting).
 */
export async function deleteDocumentVectors(
  documentId: string,
  workspaceId: string
): Promise<void> {
  const index = getIndex();
  
  // Pinecone doesn't support metadata-based delete in all plans
  // Use prefix-based delete: vector IDs are formatted as "doc_{documentId}_chunk_{n}"
  // For production, use the delete by metadata filter (requires serverless)
  await index.deleteMany({
    filter: {
      workspaceId: { $eq: workspaceId },
      documentId: { $eq: documentId },
    },
  });
}

/**
 * Initialize Pinecone index if it doesn't exist.
 * Run once during setup.
 */
export async function initializePineconeIndex(dimensions: number = 1024): Promise<void> {
  const pinecone = getPinecone();
  const indexName = process.env.PINECONE_INDEX_NAME ?? "company-brain";

  const existingIndexes = await pinecone.listIndexes();
  const exists = existingIndexes.indexes?.some((idx) => idx.name === indexName);

  if (!exists) {
    console.log(`Creating Pinecone index: ${indexName}`);
    await pinecone.createIndex({
      name: indexName,
      dimension: dimensions,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: process.env.PINECONE_ENVIRONMENT ?? "us-east-1",
        },
      },
    });
    console.log("Pinecone index created successfully");
  } else {
    console.log(`Pinecone index '${indexName}' already exists`);
  }
}