// src/types/index.ts
// Central type definitions — aligned with prisma/schema.prisma

export type {
    ConnectorType,
    ConnectorStatus,
    DocumentStatus,
    CardStatus,
  } from "@prisma/client";
  
  // ─────────────────────────────────────────────
  // RAG / QUERY
  // ─────────────────────────────────────────────
  
  export interface QueryRequest {
    query: string;
    workspaceId: string;
    topK?: number;
    includeCards?: boolean;
  }
  
  export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    sourceType: string;
    sourceUrl?: string;
    content: string;
    score: number;
    heading?: string;
  }
  
  export interface QueryResponse {
    answer: string;
    confidence: number;
    sources: RetrievedChunk[];
    answered: boolean;
    queryLogId: string;
  }
  
  // ─────────────────────────────────────────────
  // INGESTION PIPELINE
  // ─────────────────────────────────────────────
  
  export interface RawDocument {
    sourceId: string;
    sourceType: "NOTION" | "GOOGLE_DRIVE" | "SLACK" | "GITHUB";
    sourceUrl?: string;
    title: string;
    content: string;
    metadata: {
      author?: string;
      createdAt?: string;
      updatedAt?: string;
      tags?: string[];
      [key: string]: unknown;
    };
  }
  
  // ─────────────────────────────────────────────
  // PROCESS CARDS
  // ─────────────────────────────────────────────
  
  export interface ProcessStep {
    order: number;
    description: string;
    owner?: string;
  }
  
  export interface ProcessException {
    condition: string;
    resolution: string;
  }
  
  export interface ProcessCardSummary {
    id: string;
    name: string;
    description?: string | null;
    confidence: number;
    status: string;
    owners: string[];
    tags: string[];
    updatedAt: string;
  }
  
  export interface ProcessCardFull extends ProcessCardSummary {
    trigger?: string | null;
    steps: ProcessStep[];
    exceptions?: ProcessException[] | null;
    verifiedAt?: string | null;
    verifiedBy?: { name: string | null; image?: string | null } | null;
  }
  
  // ─────────────────────────────────────────────
  // CONNECTOR
  // ─────────────────────────────────────────────
  
  export interface ConnectorSummary {
    id: string;
    type: string;
    name: string;
    status: string;
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    documentCount: number;
    syncCount: number;
  }
  
  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────
  
  export interface WorkspaceStats {
    documentCount: number;
    chunkCount: number;
    processCardCount: number;
    verifiedCardCount: number;
    gapCount: number;
    connectorCount: number;
    activeConnectors: number;
  }
  
  // ─────────────────────────────────────────────
  // API WRAPPERS
  // ─────────────────────────────────────────────
  
  export interface ApiSuccess<T> {
    success: true;
    data: T;
  }
  
  export interface ApiError {
    success: false;
    error: string;
    code?: string;
  }
  
  export type ApiResponse<T> = ApiSuccess<T> | ApiError;