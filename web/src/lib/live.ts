// "Shipping right now" — the live front-page board. Ranks the tracked pool by
// current velocity (price = EWMA of daily commits) and overlays each dev's most
// recent public GitHub event, so the homepage shows who's shipping at the moment
// with a live-ticking "Xs ago" clock. Underlying GitHub calls are cached
// (getUserTicker 1h, getUserEvents 2m); the live feel comes from client polling
// + per-event relative-time clocks computed against the real wall clock.
import { getUserSummary, getUserEvents, type UserSummary, type GhEvent } from "@/lib/github";
import { devRank } from "@/lib/rank";
import { TRACKED_HANDLES } from "@/lib/board";

export type LiveEntry = {
  handle: string;
  symbol: string;
  avatarUrl: string | null;
  price: number;
  changePct30d: number;
  totalLastYear: number;
  tier: string;
  tierColor: string;
  tone: "success" | "foreground" | "muted";
  topPctLabel: string;
  lastEvent: GhEvent | null;
};

export type LiveData = { leader: LiveEntry | null; entries: LiveEntry[]; ts: number };

export async function buildLiveBoard(limit = 6): Promise<LiveData> {
  const pool = TRACKED_HANDLES.slice(0, 16);
  const summaries = (await Promise.all(pool.map((h) => getUserSummary(h)))).filter(
    (s): s is UserSummary => s !== null,
  );
  summaries.sort((a, b) => b.price - a.price);
  const top = summaries.slice(0, limit);

  const entries = await Promise.all(
    top.map(async (s): Promise<LiveEntry> => {
      const events = await getUserEvents(s.handle);
      const r = devRank(s.totalLastYear);
      return {
        handle: s.handle,
        symbol: s.symbol,
        avatarUrl: s.avatarUrl,
        price: s.price,
        changePct30d: s.changePct30d,
        totalLastYear: s.totalLastYear,
        tier: r.tier,
        tierColor: r.color,
        tone: r.tone,
        topPctLabel: r.topPctLabel,
        lastEvent: events[0] ?? null,
      };
    }),
  );

  return { leader: entries[0] ?? null, entries, ts: Date.now() };
}
