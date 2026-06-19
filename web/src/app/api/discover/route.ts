import { searchTopCommitters } from "@/lib/github";
import { addTrackedHandles, getTrackedHandles } from "@/lib/tracked";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Discover the actual highest-commit GitHub accounts and grow the tracked
// universe. Searches GitHub, ranks candidates by our commit index, and (unless
// add=0) adds the top `top` to the snapshot/resolution set. Cron- or admin-
// triggered; protected by CRON_SECRET when set.
//
//   GET /api/discover                 → add top 25 with >2000 commits/yr
//   GET /api/discover?top=50&min=5000 → add top 50 with >5000 commits/yr
//   GET /api/discover?add=0           → preview ranking, change nothing
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const top = Math.min(100, Math.max(1, Number(url.searchParams.get("top") ?? 25)));
  const minCommits = Math.max(0, Number(url.searchParams.get("min") ?? 2000));
  const add = url.searchParams.get("add") !== "0";

  const ranked = await searchTopCommitters({ minCommits });
  const picks = ranked.slice(0, top);
  const added = add ? await addTrackedHandles(picks.map((c) => c.login)) : [];
  const tracked = await getTrackedHandles();

  return Response.json({
    ok: true,
    scored: ranked.length,
    addedCount: added.length,
    added,
    trackedCount: tracked.length,
    candidates: picks.map((c) => ({
      login: c.login,
      name: c.name,
      totalLastYear: c.totalLastYear,
      followers: c.followers,
      price: c.price,
    })),
  });
}

export const GET = run;
export const POST = run;
