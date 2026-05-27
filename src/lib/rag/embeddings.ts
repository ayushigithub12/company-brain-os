// src/lib/rag/embeddings.ts
// Embedding service — supports Voyage AI (recommended) and OpenAI

export interface EmbeddingModel {
    embed(texts: string[]): Promise<number[][]>;
    readonly dimensions: number;
    readonly modelName: string;
  }
  
  // ─────────────────────────────────────────────
  // VOYAGE AI EMBEDDER (recommended — better retrieval)
  // ─────────────────────────────────────────────
  
  export class VoyageEmbedder implements EmbeddingModel {
    readonly dimensions = 1024;
    readonly modelName = "voyage-3";
  
    async embed(texts: string[]): Promise<number[][]> {
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) throw new Error("VOYAGE_API_KEY not set");
  
      const batchSize = 128; // Voyage supports up to 128 texts per request
      const allEmbeddings: number[][] = [];
  
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
  
        const response = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: batch,
            model: this.modelName,
            input_type: "document",
          }),
        });
  
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Voyage API error: ${error}`);
        }
  
        const data = await response.json();
        const embeddings = data.data.map((d: { embedding: number[] }) => d.embedding);
        allEmbeddings.push(...embeddings);
      }
  
      return allEmbeddings;
    }
  
    async embedQuery(query: string): Promise<number[]> {
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) throw new Error("VOYAGE_API_KEY not set");
  
      const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: [query],
          model: this.modelName,
          input_type: "query",  // different type for query vs document
        }),
      });
  
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voyage API error: ${error}`);
      }
  
      const data = await response.json();
      return data.data[0].embedding;
    }
  }
  
  // ─────────────────────────────────────────────
  // OPENAI EMBEDDER (fallback)
  // ─────────────────────────────────────────────
  
  export class OpenAIEmbedder implements EmbeddingModel {
    readonly dimensions = 1536;
    readonly modelName = "text-embedding-3-small";
  
    async embed(texts: string[]): Promise<number[][]> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  
      const batchSize = 100;
      const allEmbeddings: number[][] = [];
  
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
  
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: batch,
            model: this.modelName,
          }),
        });
  
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${error}`);
        }
  
        const data = await response.json();
        const embeddings = data.data.map((d: { embedding: number[] }) => d.embedding);
        allEmbeddings.push(...embeddings);
      }
  
      return allEmbeddings;
    }
  }
  
  // ─────────────────────────────────────────────
  // FACTORY — pick based on env
  // ─────────────────────────────────────────────
  
  let _embedder: VoyageEmbedder | null = null;
  
  export function getEmbedder(): VoyageEmbedder {
    if (!_embedder) {
      _embedder = new VoyageEmbedder();
    }
    return _embedder;
  }