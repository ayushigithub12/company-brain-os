// @ts-nocheck
// src/lib/cards/extractor.ts
// Reads document chunks and extracts structured Process Cards using Groq

import { prisma } from "@/lib/db/prisma";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const EXTRACTION_SYSTEM_PROMPT = `You are a business process analyst. Your job is to read company documents and extract structured process cards.

A process card describes HOW something is done in a company — a repeatable workflow, SOP, procedure, or process.

You must respond with ONLY a valid JSON array. No explanation, no markdown, no backticks. Just the raw JSON array.

Each process card in the array must have exactly this structure:
{
  "name": "Short process name (max 60 chars)",
  "description": "One sentence describing what this process achieves",
  "trigger": "What event or condition starts this process",
  "steps": [
    { "order": 1, "description": "First step", "owner": "Role or person (optional)" },
    { "order": 2, "description": "Second step", "owner": "" }
  ],
  "owners": ["Role1", "Role2"],
  "exceptions": [
    { "condition": "Edge case description", "resolution": "How to handle it" }
  ],
  "tags": ["tag1", "tag2"],
  "confidence": 0.85
}

Rules:
- Only extract REAL processes from the text. Do not invent processes.
- confidence is 0.0-1.0 based on how clearly the process is described
- If no clear processes exist in the text, return an empty array: []
- steps must have at least 2 items to be a valid process
- owners should be roles/titles, not personal names
- tags should be 1-3 relevant category words`;

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

function safeParseCards(raw: string): any[] {
  try {
    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) =>
        c.name &&
        c.steps &&
        Array.isArray(c.steps) &&
        c.steps.length >= 2
    );
  } catch {
    return [];
  }
}

/**
 * Extract process cards from a single document's chunks.
 */
async function extractFromDocument(
  documentId: string,
  workspaceId: string
): Promise<number> {
  // Load all chunks for this document
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    include: { document: { select: { title: true, sourceUrl: true } } },
    orderBy: { chunkIndex: "asc" },
  });

  if (chunks.length === 0) return 0;

  const docTitle = chunks[0].document.title;
  const fullText = chunks.map((c) => c.content).join("\n\n");

  // Limit text to avoid token limits (roughly 6000 chars)
  const truncated = fullText.slice(0, 6000);

  const prompt = `Document title: "${docTitle}"

Document content:
${truncated}

Extract all business processes, workflows, SOPs, or procedures from this document. Return a JSON array of process cards.`;

  console.log(`[Extractor] Processing: "${docTitle}"`);
  const raw = await callGroq(prompt);
  const cards = safeParseCards(raw);

  if (cards.length === 0) {
    console.log(`[Extractor] No processes found in: "${docTitle}"`);
    return 0;
  }

  console.log(`[Extractor] Found ${cards.length} process(es) in: "${docTitle}"`);

  // Save each card to DB
  for (const card of cards) {
    // Check if similar card already exists (by name)
    const existing = await prisma.processCard.findFirst({
      where: {
        workspaceId,
        name: { equals: card.name, mode: "insensitive" },
      },
    });

    if (existing) {
      // Update existing card
      await prisma.processCard.update({
        where: { id: existing.id },
        data: {
          description: card.description ?? existing.description,
          trigger: card.trigger ?? existing.trigger,
          steps: card.steps,
          exceptions: card.exceptions ?? [],
          owners: card.owners ?? [],
          tags: card.tags ?? [],
          confidence: card.confidence ?? 0.5,
          status: "DRAFT",
        },
      });
    } else {
      // Create new card
      await prisma.processCard.create({
        data: {
          workspaceId,
          name: card.name,
          description: card.description ?? null,
          trigger: card.trigger ?? null,
          steps: card.steps,
          exceptions: card.exceptions ?? [],
          owners: card.owners ?? [],
          tags: card.tags ?? [],
          confidence: card.confidence ?? 0.5,
          status: "DRAFT",
        },
      });
    }
  }

  return cards.length;
}

/**
 * Run extraction across documents in a workspace.
 * If docIds provided, only processes those specific documents (prevents duplicates on re-sync).
 * If no docIds, processes all indexed documents (manual extract button).
 */
export async function extractProcessCards(
  workspaceId: string,
  docIds?: string[]
): Promise<{
  documentsProcessed: number;
  cardsFound: number;
  cardsTotal: number;
}> {
  const where: any = { workspaceId, status: "INDEXED" };
  if (docIds && docIds.length > 0) {
    where.id = { in: docIds };
  }

  const documents = await prisma.sourceDocument.findMany({
    where,
    select: { id: true, title: true },
  });

  console.log(`[Extractor] Starting extraction across ${documents.length} documents`);

  let cardsFound = 0;

  for (const doc of documents) {
    try {
      const count = await extractFromDocument(doc.id, workspaceId);
      cardsFound += count;
      // Small delay between documents to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Extractor] Failed on "${doc.title}":`, err);
    }
  }

  const cardsTotal = await prisma.processCard.count({ where: { workspaceId } });

  console.log(`[Extractor] Done — ${cardsFound} new cards, ${cardsTotal} total`);

  return {
    documentsProcessed: documents.length,
    cardsFound,
    cardsTotal,
  };
}