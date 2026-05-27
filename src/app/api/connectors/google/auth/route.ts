// src/app/api/connectors/google/auth/route.ts
// GET /api/connectors/google/auth?workspaceId=xxx — redirects to Google OAuth

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleOAuthUrl } from "@/lib/connectors/google-drive";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_workspace", req.url));
  }

  try {
    const url = getGoogleOAuthUrl(workspaceId); // state = workspaceId
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[Google Auth]", err);
    return NextResponse.redirect(new URL("/dashboard?error=google_config_missing", req.url));
  }
}
