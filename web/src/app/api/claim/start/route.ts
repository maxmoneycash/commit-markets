import { NextRequest, NextResponse } from "next/server";
import { sign, oauthConfigured, STATE_COOKIE } from "@/lib/claims";

// Kick off GitHub OAuth so a visitor can prove they own their account and claim
// (verify) their $TICKER. ?handle= is just where we send them back afterward.
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  if (!oauthConfigured()) {
    return NextResponse.redirect(`${site}/?claim_error=not_configured`);
  }
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID!;
  const handle = req.nextUrl.searchParams.get("handle") ?? "";
  const state = await sign({ handle, nonce: crypto.randomUUID() });

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${site}/api/claim/callback`);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "true");

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
