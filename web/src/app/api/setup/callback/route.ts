import { NextRequest, NextResponse } from "next/server";
import { verifyToken, setOAuthCreds } from "@/lib/claims";

// GitHub redirects here after the owner clicks "Create" on the manifest page.
// We exchange the one-time code for the app's client_id/client_secret and store
// them — one-click "Sign in with GitHub" is now live, no env vars touched.
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const done = (status: string) => NextResponse.redirect(`${site}/claim?setup=${status}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  // Manifest codes are valid for one hour; our signed state carries the same window.
  if (!code || !state || !(await verifyToken(state, 60 * 60 * 1000))) return done("error");

  try {
    const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", "User-Agent": "commits.sh" },
    });
    if (!res.ok) return done("exchange_failed");
    const app = await res.json();
    if (!app?.client_id || !app?.client_secret) return done("no_creds");
    await setOAuthCreds(app.client_id, app.client_secret);
  } catch {
    return done("exchange_failed");
  }

  return done("ok");
}
