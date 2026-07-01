import { NextRequest, NextResponse } from "next/server";
import { sign, getOAuthCreds } from "@/lib/claims";

// One-click owner setup. Opening this URL (gated by ?key=SETUP_SECRET) posts a
// GitHub App *manifest* to github.com — the owner just clicks "Create" on
// GitHub's page and the credentials flow back to /api/setup/callback, which
// stores them. No forms, no copy/paste, no secret handling.
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const secret = process.env.SETUP_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "SETUP_SECRET not set" }, { status: 503 });
  }
  if (req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (await getOAuthCreds()) {
    return NextResponse.redirect(`${site}/claim?setup=already`);
  }

  const manifest = {
    name: "commits.sh",
    url: site,
    redirect_url: `${site}/api/setup/callback`,
    callback_urls: [`${site}/api/claim/callback`],
    public: true,
    default_permissions: {},
    request_oauth_on_install: false,
    hook_attributes: { url: `${site}/api/setup/hook`, active: false },
  };
  const state = await sign({ setup: true, nonce: crypto.randomUUID() });

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Setting up commits.sh…</title></head>
<body style="font-family:monospace;background:#0a0c0b;color:#ededed;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>Redirecting to GitHub to create the app…</p>
<form id="f" action="https://github.com/settings/apps/new" method="post">
<input type="hidden" name="manifest" value='${esc(JSON.stringify(manifest))}'>
<input type="hidden" name="state" value='${esc(state)}'>
</form>
<script>document.getElementById('f').submit()</script>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
