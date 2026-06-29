import { searchTopCommitters } from "@/lib/github";
import { jsonRes, CORS, SITE } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/v1/leaderboard?limit=25&min=2000[&includeBots=1]
// Top GitHub accounts by commit velocity (commits in the last 52 weeks) — with
// bots and constant-push/commit-farm accounts removed by default. The real one.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const min = Math.max(0, Number(url.searchParams.get("min") ?? 2000));
  const includeBots = url.searchParams.get("includeBots") === "1";

  const ranked = await searchTopCommitters({ minCommits: min });
  const flaggedCount = ranked.filter((c) => c.flagged).length;
  const kept = includeBots ? ranked : ranked.filter((c) => !c.flagged);

  const rows = kept.slice(0, limit).map((c, i) => ({
    rank: i + 1,
    handle: c.login,
    symbol: `$${c.login.toUpperCase()}`,
    name: c.name,
    price: c.price,
    commits52w: c.totalLastYear,
    followers: c.followers,
    ...(includeBots ? { flagged: c.flagged, flagReason: c.flagReason } : {}),
    badge: `${SITE}/api/badge?handle=${encodeURIComponent(c.login)}&style=pro`,
    page: `${SITE}/${c.login}`,
  }));

  return jsonRes({
    ok: true,
    count: rows.length,
    filtered: flaggedCount, // bots/constant-push accounts removed
    leaderboard: rows,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
