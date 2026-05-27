// src/app/api/connectors/google/callback/route.ts
// Handles the OAuth redirect from Google Drive

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeGoogleCode } from "@/lib/connectors/google-drive";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // workspaceId
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard?error=google_oauth_denied", req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?error=google_missing_params", req.url)
    );
  }

  try {
    const { accessToken, refreshToken, expiresAt, email } =
      await exchangeGoogleCode(code);

    // Upsert Google Drive connector
    const existing = await prisma.connector.findFirst({
      where: { workspaceId: state, type: "GOOGLE_DRIVE" },
      select: { id: true },
    });

    await prisma.connector.upsert({
      where: { id: existing?.id ?? "new-google-connector" },
      create: {
        workspaceId: state,
        type: "GOOGLE_DRIVE",
        name: `Google Drive — ${email}`,
        status: "CONNECTED",
        accessToken,
        refreshToken,
        expiresAt,
        config: { email },
      },
      update: {
        name: `Google Drive — ${email}`,
        status: "CONNECTED",
        accessToken,
        refreshToken,
        expiresAt,
        config: { email },
        lastSyncError: null,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?success=google_connected", req.url)
    );
  } catch (err) {
    console.error("[Google OAuth] Failed:", err);
    return NextResponse.redirect(
      new URL("/dashboard?error=google_token_failed", req.url)
    );
  }
}
