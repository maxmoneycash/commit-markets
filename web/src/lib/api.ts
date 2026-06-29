// Shared shapes + helpers for the public REST API (/api/v1) and the MCP server.
// One serializer so the API, MCP tools, and CLI all speak the same JSON.
import { getUserTicker, getRepoTicker, analystBlurb, type Ticker } from "@/lib/github";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// commit data changes ~daily; cache hard at the edge, serve stale while revalidating.
export const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://commit-markets.vercel.app";

export function jsonRes(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": status === 200 ? CACHE : "public, max-age=60" },
  });
}

/** Resolve a handle to a ticker — "owner/name" → repo, otherwise a user. */
export async function resolveTicker(handle: string): Promise<Ticker | null> {
  const h = handle.trim().replace(/^@/, "");
  if (h.includes("/")) {
    const [owner, name] = h.split("/");
    return owner && name ? getRepoTicker(owner, name) : null;
  }
  return getUserTicker(h);
}

/** Stable public JSON for a ticker (no heavy arrays unless asked). */
export function tickerSummary(t: Ticker, opts: { series?: boolean } = {}) {
  const s = t.stats;
  return {
    handle: t.handle,
    symbol: t.symbol,
    name: t.name,
    kind: t.kind,
    url: t.url,
    avatar: t.avatarUrl,
    price: s.price,
    changePct30d: s.changePct30d,
    direction: s.changePct30d >= 0 ? "up" : "down",
    marketCap: s.marketCap,
    stats: {
      commits52w: s.totalLastYear,
      peakWeek: s.peakWeek,
      busiestDay: s.busiestDay,
      activeDays: s.activeDays,
      longestStreak: s.longestStreak,
      currentStreak: s.currentStreakDays,
      avgPerWeek: s.avgPerWeek,
      followers: s.followers,
      contributors: s.contributors,
    },
    analyst: analystBlurb(t),
    badge: `${SITE}/api/badge?handle=${encodeURIComponent(t.handle)}&style=pro`,
    page: `${SITE}/${t.handle}`,
    ...(opts.series
      ? { series: { priceDaily: t.priceDaily, candles: t.candles, days: t.days } }
      : {}),
  };
}
