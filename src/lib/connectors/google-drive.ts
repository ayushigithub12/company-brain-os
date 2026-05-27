// src/lib/connectors/google-drive.ts
// Google Drive connector — OAuth2, fetches Docs/Sheets/PDFs

import { google } from "googleapis";
import type { RawDocument } from "@/types";

// ─────────────────────────────────────────────
// OAuth Helpers
// ─────────────────────────────────────────────

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleOAuthUrl(state: string): string {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",          // force refresh_token every time
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) throw new Error("No access token returned");
  if (!tokens.refresh_token) throw new Error("No refresh token — user must re-authorize");

  // Get user email
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
    email: userInfo.email ?? "unknown",
  };
}

// ─────────────────────────────────────────────
// Authenticated Drive client
// ─────────────────────────────────────────────

function getDriveClient(accessToken: string, refreshToken: string) {
  const auth = getGoogleOAuthClient();
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.drive({ version: "v3", auth });
}

function getDocsClient(accessToken: string, refreshToken: string) {
  const auth = getGoogleOAuthClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.docs({ version: "v1", auth });
}

// ─────────────────────────────────────────────
// Google Docs → plain text
// ─────────────────────────────────────────────

function extractDocsText(doc: { body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> } }): string {
  const lines: string[] = [];

  for (const element of doc.body?.content ?? []) {
    if (!element.paragraph) continue;

    const paraText = (element.paragraph.elements ?? [])
      .map((e) => e.textRun?.content ?? "")
      .join("");

    const trimmed = paraText.trim();
    if (trimmed) lines.push(trimmed);
  }

  return lines.join("\n\n");
}

// ─────────────────────────────────────────────
// Fetch all Drive files
// ─────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = [
  "application/vnd.google-apps.document",   // Google Docs
  "application/vnd.google-apps.spreadsheet", // Google Sheets (exported as text)
  "application/pdf",
  "text/plain",
  "text/markdown",
];

export async function fetchAllDriveFiles(
  accessToken: string,
  refreshToken: string,
  options: {
    updatedAfter?: Date;
    maxFiles?: number;
    folderIds?: string[];
  } = {}
): Promise<RawDocument[]> {
  const { maxFiles = 300, updatedAfter } = options;
  const drive = getDriveClient(accessToken, refreshToken);
  const docs = getDocsClient(accessToken, refreshToken);
  const documents: RawDocument[] = [];
  let pageToken: string | undefined;

  // Build query
  const mimeFilter = SUPPORTED_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
  let q = `(${mimeFilter}) and trashed=false`;
  if (updatedAfter) {
    q += ` and modifiedTime>'${updatedAfter.toISOString()}'`;
  }

  console.log("[Drive] Starting file discovery...");

  do {
    const response = await drive.files.list({
      q,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, createdTime, owners, size)",
      pageSize: 100,
      pageToken,
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files ?? [];

    for (const file of files) {
      if (documents.length >= maxFiles) break;
      if (!file.id || !file.name) continue;

      console.log(`[Drive] Fetching: ${file.name} (${file.mimeType})`);

      try {
        let content = "";

        if (file.mimeType === "application/vnd.google-apps.document") {
          // Fetch Google Doc content
          const docResponse = await docs.documents.get({ documentId: file.id });
          content = extractDocsText(docResponse.data as Parameters<typeof extractDocsText>[0]);
        } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
          // Export Sheets as CSV text
          const exportResponse = await drive.files.export(
            { fileId: file.id, mimeType: "text/csv" },
            { responseType: "text" }
          );
          content = String(exportResponse.data).slice(0, 50000); // cap at 50k chars
        } else if (file.mimeType === "application/pdf") {
          // Export PDF as plain text via Drive's export
          try {
            const exportResponse = await drive.files.export(
              { fileId: file.id, mimeType: "text/plain" },
              { responseType: "text" }
            );
            content = String(exportResponse.data).slice(0, 100000);
          } catch {
            // PDF export not always available — skip
            console.log(`[Drive] Skipping PDF (no text export): ${file.name}`);
            continue;
          }
        } else {
          // Plain text / markdown — download directly
          const downloadResponse = await drive.files.get(
            { fileId: file.id, alt: "media" },
            { responseType: "text" }
          );
          content = String(downloadResponse.data).slice(0, 100000);
        }

        if (!content || content.trim().length < 30) {
          console.log(`[Drive] Skipping empty file: ${file.name}`);
          continue;
        }

        documents.push({
          sourceId: file.id,
          sourceType: "GOOGLE_DRIVE",
          sourceUrl: file.webViewLink ?? undefined,
          title: file.name,
          content,
          metadata: {
            updatedAt: file.modifiedTime ?? undefined,
            createdAt: file.createdTime ?? undefined,
            mimeType: file.mimeType ?? undefined,
            author: file.owners?.[0]?.emailAddress ?? undefined,
          },
        });
      } catch (err) {
        console.error(`[Drive] Failed to fetch file ${file.id}:`, err);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (documents.length >= maxFiles) break;
  } while (pageToken);

  console.log(`[Drive] Fetched ${documents.length} files`);
  return documents;
}