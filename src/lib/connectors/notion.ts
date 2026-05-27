// src/lib/connectors/notion.ts
// Notion connector — uses internal integration token directly (no OAuth needed)

import { Client } from "@notionhq/client";
import type { RawDocument } from "@/types";

interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties?: Record<string, unknown>;
  parent?: { type: string; database_id?: string; page_id?: string };
}

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

function extractBlockText(block: NotionBlock): string {
  const lines: string[] = [];
  const rt = (items: Array<{ plain_text: string }>) =>
    items.map((t) => t.plain_text).join("");

  switch (block.type) {
    case "paragraph": {
      const b = block.paragraph as { rich_text: Array<{ plain_text: string }> };
      const text = rt(b.rich_text);
      if (text) lines.push(text);
      break;
    }
    case "heading_1": {
      const b = block.heading_1 as { rich_text: Array<{ plain_text: string }> };
      lines.push(`# ${rt(b.rich_text)}`);
      break;
    }
    case "heading_2": {
      const b = block.heading_2 as { rich_text: Array<{ plain_text: string }> };
      lines.push(`## ${rt(b.rich_text)}`);
      break;
    }
    case "heading_3": {
      const b = block.heading_3 as { rich_text: Array<{ plain_text: string }> };
      lines.push(`### ${rt(b.rich_text)}`);
      break;
    }
    case "bulleted_list_item": {
      const b = block.bulleted_list_item as { rich_text: Array<{ plain_text: string }> };
      lines.push(`• ${rt(b.rich_text)}`);
      break;
    }
    case "numbered_list_item": {
      const b = block.numbered_list_item as { rich_text: Array<{ plain_text: string }> };
      lines.push(`- ${rt(b.rich_text)}`);
      break;
    }
    case "to_do": {
      const b = block.to_do as { rich_text: Array<{ plain_text: string }>; checked: boolean };
      lines.push(`${b.checked ? "[x]" : "[ ]"} ${rt(b.rich_text)}`);
      break;
    }
    case "quote": {
      const b = block.quote as { rich_text: Array<{ plain_text: string }> };
      lines.push(`> ${rt(b.rich_text)}`);
      break;
    }
    case "callout": {
      const b = block.callout as { rich_text: Array<{ plain_text: string }> };
      lines.push(`📌 ${rt(b.rich_text)}`);
      break;
    }
    case "code": {
      const b = block.code as { rich_text: Array<{ plain_text: string }>; language: string };
      lines.push(`\`\`\`${b.language}\n${rt(b.rich_text)}\n\`\`\``);
      break;
    }
    case "divider":
      lines.push("---");
      break;
    default:
      break;
  }

  return lines.join("\n");
}

export function getNotionClient(accessToken: string): Client {
  return new Client({ auth: accessToken });
}

function extractPageTitle(page: NotionPage): string {
  if (!page.properties) return "Untitled";
  const titleProp = Object.values(page.properties).find(
    (prop: unknown) => (prop as { type: string }).type === "title"
  ) as { title: Array<{ plain_text: string }> } | undefined;
  if (titleProp?.title && titleProp.title.length > 0) {
    return titleProp.title.map((t) => t.plain_text).join("");
  }
  return "Untitled";
}

async function fetchPageContent(client: Client, pageId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const text = extractBlockText(block as NotionBlock);
      if (text) lines.push(text);

      if ((block as NotionBlock).has_children) {
        try {
          const childContent = await fetchPageContent(client, block.id);
          if (childContent) lines.push(childContent);
        } catch {}
      }
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return lines.filter(Boolean).join("\n\n");
}

/**
 * Fetch all Notion pages using the internal integration token.
 * No OAuth needed — uses the token directly.
 */
export async function fetchAllNotionPages(
  accessToken: string,
  options: { updatedAfter?: Date; maxPages?: number } = {}
): Promise<RawDocument[]> {
  const client = getNotionClient(accessToken);
  const { maxPages = 500 } = options;
  const documents: RawDocument[] = [];
  let cursor: string | undefined;

  console.log("[Notion] Starting page discovery...");

  do {
    const response = await client.search({
      filter: { value: "page", property: "object" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      start_cursor: cursor,
      page_size: 100,
    });

    for (const result of response.results) {
      if (documents.length >= maxPages) break;
      if (result.object !== "page") continue;

      const page = result as unknown as NotionPage;

      if (
        options.updatedAfter &&
        new Date(page.last_edited_time) <= options.updatedAfter
      ) continue;

      try {
        const title = extractPageTitle(page);
        console.log(`[Notion] Fetching: ${title}`);
        const content = await fetchPageContent(client, page.id);

        if (!content || content.trim().length < 50) {
          console.log(`[Notion] Skipping empty page: ${title}`);
          continue;
        }

        documents.push({
          sourceId: page.id,
          sourceType: "NOTION",
          sourceUrl: page.url,
          title,
          content,
          metadata: {
            updatedAt: page.last_edited_time,
            createdAt: page.created_time,
          },
        });
      } catch (err) {
        console.error(`[Notion] Failed to fetch page ${page.id}:`, err);
      }
    }

    cursor = response.next_cursor ?? undefined;
    if (documents.length >= maxPages) break;
  } while (cursor);

  console.log(`[Notion] Discovered ${documents.length} pages`);
  return documents;
}

/**
 * For internal token — no OAuth exchange needed.
 * The token IS the access token.
 */
export function getNotionOAuthUrl(): string {
  throw new Error("OAuth not used — using internal integration token");
}

export async function exchangeNotionCode(): Promise<never> {
  throw new Error("OAuth not used — using internal integration token");
}