// src/lib/rag/chunker.ts
// Smart text chunker with overlap for optimal RAG retrieval

const DEFAULT_CHUNK_SIZE = 512;   // tokens
const DEFAULT_OVERLAP = 64;       // tokens overlap between chunks
const CHARS_PER_TOKEN = 4;        // rough approximation

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata?: {
    heading?: string;    // section heading if detectable
    pageNumber?: number;
  };
}

/**
 * Split text into overlapping chunks optimized for RAG retrieval.
 * Uses paragraph-aware splitting to avoid cutting sentences mid-thought.
 */
export function chunkText(
  text: string,
  options: {
    chunkSize?: number;   // in tokens (approx)
    overlap?: number;     // overlap in tokens
    preserveHeadings?: boolean;
  } = {}
): TextChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    preserveHeadings = true,
  } = options;

  const chunkSizeChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  // Clean and normalize text
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length === 0) return [];
  if (cleaned.length <= chunkSizeChars) {
    return [
      {
        content: cleaned,
        chunkIndex: 0,
        tokenCount: Math.ceil(cleaned.length / CHARS_PER_TOKEN),
      },
    ];
  }

  // Split into paragraphs first (natural semantic units)
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let currentHeading: string | undefined;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;

    // Detect headings (Markdown # or ALL CAPS short lines)
    const isHeading =
      preserveHeadings &&
      (paragraph.startsWith("#") ||
        (paragraph.length < 80 && paragraph === paragraph.toUpperCase() && paragraph.trim().length > 3));

    if (isHeading) {
      currentHeading = paragraph.replace(/^#+\s*/, "").trim();
    }

    // If adding this paragraph would exceed chunk size, flush current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + paragraph.length + 2 > chunkSizeChars
    ) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: Math.ceil(currentChunk.length / CHARS_PER_TOKEN),
        metadata: currentHeading ? { heading: currentHeading } : undefined,
      });

      // Start new chunk with overlap from end of previous chunk
      const overlapText = currentChunk.slice(-overlapChars);
      // Find a clean sentence boundary in the overlap
      const sentenceBoundary = overlapText.search(/(?<=[.!?])\s+/);
      currentChunk =
        sentenceBoundary > 0
          ? overlapText.slice(sentenceBoundary).trimStart()
          : overlapText.trimStart();
    }

    // Handle very long paragraphs (longer than chunk size itself)
    if (paragraph.length > chunkSizeChars) {
      // Flush whatever we have
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          tokenCount: Math.ceil(currentChunk.length / CHARS_PER_TOKEN),
          metadata: currentHeading ? { heading: currentHeading } : undefined,
        });
        currentChunk = "";
      }
      // Split long paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > chunkSizeChars && sentenceChunk) {
          chunks.push({
            content: sentenceChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: Math.ceil(sentenceChunk.length / CHARS_PER_TOKEN),
            metadata: currentHeading ? { heading: currentHeading } : undefined,
          });
          sentenceChunk = sentence;
        } else {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        }
      }
      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
      continue;
    }

    currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
  }

  // Flush remaining content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex++,
      tokenCount: Math.ceil(currentChunk.length / CHARS_PER_TOKEN),
      metadata: currentHeading ? { heading: currentHeading } : undefined,
    });
  }

  return chunks;
}

/**
 * Estimate token count for a string (rough approximation).
 * For precise counts, use tiktoken.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}