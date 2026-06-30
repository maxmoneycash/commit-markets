import { NextRequest, NextResponse } from "next/server";
import { claimCode, claimConfigured } from "@/lib/claims";

// Returns the per-login verification code to paste into a public gist.
export async function GET(req: NextRequest) {
  if (!claimConfigured()) {
    return NextResponse.json({ error: "Claims are not configured." }, { status: 503 });
  }
  const handle = (req.nextUrl.searchParams.get("handle") ?? "").trim();
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(handle)) {
    return NextResponse.json({ error: "Enter a valid GitHub handle." }, { status: 400 });
  }
  return NextResponse.json({ handle, code: await claimCode(handle) });
}
