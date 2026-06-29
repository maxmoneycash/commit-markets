import { searchTopCommitters } from "@/lib/github";
import { jsonRes, CORS, SITE } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/v1/leaderboard?limit=25&min=2000 — top GitHub accounts by commit
// index (commits in the last 52 weeks). The velocity board warpchart wishes it had.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const min = Math.max(0, Number(url.searchParams.get("min") ?? 2000));

  const ranked = await searchTopCommitters({ minCommits: min });
  const rows = ranked.slice(0, limit).map((c, i) => ({
    rank: i + 1,
    handle: c.login,
    symbol: `$${c.login.toUpperCase()}`,
    name: c.name,
    price: c.price,
    commits52w: c.totalLastYear,
    followers: c.followers,
    badge: `${SITE}/api/badge?handle=${encodeURIComponent(c.login)}&style=pro`,
    page: `${SITE}/${c.login}`,
  }));

  return jsonRes({ ok: true, count: rows.length, leaderboard: rows });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
