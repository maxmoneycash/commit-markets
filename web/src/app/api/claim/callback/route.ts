import { NextRequest, NextResponse } from "next/server";
import { sign, verifyToken, setClaim, getOAuthCreds, SESSION_COOKIE, STATE_COOKIE } from "@/lib/claims";

// GitHub redirects here after the user authorizes. We verify the signed state
// (CSRF), exchange the code, read the authenticated user, and record the claim.
// You can only ever verify the account you logged in as — so clicking "claim" on
// someone else's page just verifies your OWN ticker.
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const fail = (msg: string) => NextResponse.redirect(`${site}/?claim_error=${encodeURIComponent(msg)}`);

  const creds = await getOAuthCreds();
  if (!creds || !process.env.AUTH_SECRET) return fail("not_configured");

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  // state must be present, match the cookie, and verify under our HMAC.
  if (!code || !state || !cookieState || state !== cookieState) return fail("bad_state");
  if (!(await verifyToken(state, 600_000))) return fail("expired");

  // Exchange the code for an access token.
  let accessToken: string | undefined;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: `${site}/api/claim/callback`,
      }),
    });
    accessToken = (await tokenRes.json())?.access_token;
  } catch {
    return fail("token_exchange");
  }
  if (!accessToken) return fail("no_token");

  // Read the authenticated user — this is the account being verified.
  let u: { login: string; id: number; name?: string; avatar_url?: string };
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "commits.sh",
      },
    });
    if (!userRes.ok) return fail("user_fetch");
    u = await userRes.json();
  } catch {
    return fail("user_fetch");
  }
  if (!u?.login) return fail("user_fetch");

  await setClaim({
    login: u.login,
    githubId: u.id,
    name: u.name ?? undefined,
    avatarUrl: u.avatar_url ?? undefined,
    verifiedAt: new Date().toISOString(),
  });

  const session = await sign({ login: u.login });
  const res = NextResponse.redirect(`${site}/${u.login}?claimed=1`);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
