import { NextRequest, NextResponse } from "next/server";
import { claimCode, claimConfigured, setClaim, sign, SESSION_COOKIE } from "@/lib/claims";

const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

function gh(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "commits.sh",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Verify ownership by finding the per-login code in one of the login's PUBLIC
// gists. GitHub guarantees the gist owner via the /users/{login}/gists path, so
// a gist containing the code proves control of that account.
export async function POST(req: NextRequest) {
  if (!claimConfigured()) {
    return NextResponse.json({ ok: false, error: "Claims are not configured." }, { status: 503 });
  }

  let handle = "";
  try {
    handle = String((await req.json())?.handle ?? "").trim();
  } catch {
    /* fall through to validation */
  }
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ ok: false, error: "Enter a valid GitHub handle." }, { status: 400 });
  }

  const headers = gh();

  // Resolve the canonical login (casing) and confirm the user exists.
  let login = handle;
  let avatarUrl: string | undefined;
  let name: string | undefined;
  let githubId = 0;
  try {
    const ur = await fetch(`https://api.github.com/users/${handle}`, { headers });
    if (ur.status === 404) {
      return NextResponse.json({ ok: false, error: "No such GitHub user." }, { status: 404 });
    }
    if (ur.ok) {
      const u = await ur.json();
      login = u.login ?? handle;
      avatarUrl = u.avatar_url ?? undefined;
      name = u.name ?? undefined;
      githubId = u.id ?? 0;
    }
  } catch {
    /* network blip — fall through and try gists anyway */
  }

  const code = await claimCode(login);

  // Scan recent public gists: cheap checks (description, filename) first, then
  // fetch raw content for a handful of files as a fallback.
  let found = false;
  try {
    const gr = await fetch(`https://api.github.com/users/${login}/gists?per_page=30`, { headers });
    if (gr.ok) {
      const gists = (await gr.json()) as Array<{
        description?: string | null;
        files?: Record<string, { filename?: string; raw_url?: string; size?: number }>;
      }>;
      let rawBudget = 6; // cap content fetches
      outer: for (const g of gists) {
        if (g.description && g.description.includes(code)) {
          found = true;
          break;
        }
        for (const f of Object.values(g.files ?? {})) {
          if (f.filename && f.filename.includes(code)) {
            found = true;
            break outer;
          }
          if (rawBudget > 0 && f.raw_url && (f.size ?? 0) < 50_000) {
            rawBudget--;
            try {
              const raw = await fetch(f.raw_url, { headers: { "User-Agent": "commits.sh" } });
              if (raw.ok && (await raw.text()).includes(code)) {
                found = true;
                break outer;
              }
            } catch {
              /* skip this file */
            }
          }
        }
      }
    }
  } catch {
    /* fall through to not-found */
  }

  if (!found) {
    return NextResponse.json(
      {
        ok: false,
        error: "Code not found in any public gist yet. Create the gist, give it a few seconds, then retry.",
      },
      { status: 422 },
    );
  }

  await setClaim({ login, githubId, name, avatarUrl, verifiedAt: new Date().toISOString() });

  const res = NextResponse.json({ ok: true, verified: true, login, profile: `/${login}` });
  res.cookies.set(SESSION_COOKIE, await sign({ login }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
