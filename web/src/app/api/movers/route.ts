import { getMovers } from "@/lib/momentumStore";

export const runtime = "nodejs";

// The movers feed, ranked by stored week-over-week Δmomentum — the read side of
// the memory layer. Unlike the home board (which recomputes a point-in-time 30d
// delta on every request), this reflects real change between persisted
// snapshots, so it can surface "accelerating" / "quiet" trajectories and powers
// both the social feed and the future alert digest.
//
// ?status=accelerating|cooling|quiet|steady  — optional filter
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let movers = await getMovers();
  if (status) movers = movers.filter((m) => m.status === status);

  return Response.json({
    count: movers.length,
    movers: movers.map((m) => ({
      handle: m.handle,
      status: m.status,
      deltaPct: m.deltaPct,
      momentum: m.latest?.momentum ?? 0,
      totalLastYear: m.latest?.totalLastYear ?? 0,
      history: m.history,
    })),
  });
}
