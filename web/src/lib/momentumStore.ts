// The Developer Momentum Graph — the memory layer.
//
// The rest of the app reads GitHub live and throws the result away (1h cache),
// so it can show a trajectory *right now* but can never answer "who slowed down
// last week", "rank by Δmomentum", or "alert me when someone goes quiet". That
// gap is the whole product. This module fixes it by persisting a daily snapshot
// of each tracked entity's momentum, turning trajectory-over-time into a
// first-class, queryable, alertable thing.
//
// Storage mirrors usageStore: Upstash Redis in prod (serverless instances don't
// share memory), in-memory fallback in dev (zero setup). Snapshots are keyed by
// date so a re-run on the same day is idempotent (overwrites, never duplicates).

import { Redis } from "@upstash/redis";
import { getUserSummary } from "@/lib/github";
import { BOARD } from "@/lib/board";

// One day's reading for one entity. Deliberately small — this is the series we
// store forever, so it holds only what trajectory/alerts need, not full charts.
export type Snapshot = {
  date: string; // YYYY-MM-DD (UTC)
  momentum: number; // latest EWMA "price" — the trend line
  totalLastYear: number; // rolling 52w commit total
  changePct30d: number; // momentum delta vs ~30d ago (point-in-time)
};

// A computed read of where an entity is *heading*, derived from stored history.
export type Trajectory = {
  handle: string;
  latest: Snapshot | null;
  weekAgo: Snapshot | null;
  deltaPct: number; // momentum change vs ~7d ago, from stored snapshots
  status: Status;
  history: number; // how many days of snapshots we hold (data confidence)
};

// The four states the alert/feed layer speaks in.
export type Status = "accelerating" | "steady" | "cooling" | "quiet";

const SNAP_MAX = 730; // ~2y of daily snapshots per entity
const ENTITIES_KEY = "mom:entities"; // set of tracked handles (lowercased)
const snapKey = (h: string) => `mom:snap:${h.toLowerCase()}`; // hash: date -> Snapshot

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Dev fallback: a single-process in-memory mirror of the same shape.
const g = globalThis as unknown as {
  __cmEntities?: Set<string>;
  __cmSnaps?: Map<string, Map<string, Snapshot>>;
};
const memEntities = (g.__cmEntities ??= new Set<string>(BOARD.map((h) => h.toLowerCase())));
const memSnaps = (g.__cmSnaps ??= new Map<string, Map<string, Snapshot>>());

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- entity registry -------------------------------------------------------

export async function trackEntity(handle: string): Promise<void> {
  const h = handle.toLowerCase();
  if (redis) await redis.sadd(ENTITIES_KEY, h);
  else memEntities.add(h);
}

// The set of handles the snapshot cron walks. Falls back to the curated BOARD so
// the foundation has something to track before anything is explicitly added.
export async function listEntities(): Promise<string[]> {
  if (redis) {
    const set = await redis.smembers(ENTITIES_KEY);
    if (set.length) return set;
    // First run: seed from the board so day one isn't empty.
    const seed = BOARD.map((h) => h.toLowerCase());
    if (seed.length) await redis.sadd(ENTITIES_KEY, seed[0], ...seed.slice(1));
    return seed;
  }
  return Array.from(memEntities);
}

// --- snapshots -------------------------------------------------------------

// Take today's reading for one handle and persist it. Idempotent per day.
// Returns the snapshot written, or null if GitHub had nothing for the handle.
export async function recordSnapshot(handle: string): Promise<Snapshot | null> {
  const summary = await getUserSummary(handle);
  if (!summary) return null;
  const snap: Snapshot = {
    date: today(),
    momentum: summary.price,
    totalLastYear: summary.totalLastYear,
    changePct30d: summary.changePct30d,
  };
  const h = handle.toLowerCase();
  await trackEntity(h);
  if (redis) {
    await redis.hset(snapKey(h), { [snap.date]: snap });
  } else {
    const m = memSnaps.get(h) ?? new Map<string, Snapshot>();
    m.set(snap.date, snap);
    // prune oldest beyond the cap
    if (m.size > SNAP_MAX) {
      const oldest = Array.from(m.keys()).sort().slice(0, m.size - SNAP_MAX);
      for (const k of oldest) m.delete(k);
    }
    memSnaps.set(h, m);
  }
  return snap;
}

// All stored snapshots for a handle, oldest-first.
export async function getSnapshots(handle: string): Promise<Snapshot[]> {
  const h = handle.toLowerCase();
  let map: Record<string, Snapshot>;
  if (redis) {
    map = (await redis.hgetall<Record<string, Snapshot>>(snapKey(h))) ?? {};
  } else {
    map = Object.fromEntries(memSnaps.get(h) ?? new Map());
  }
  return Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- trajectory / alerts ---------------------------------------------------

// Classify a week-over-week momentum delta into the feed/alert vocabulary.
// Tuned conservatively so "quiet" means a real stall, not normal weekend dip.
function classify(deltaPct: number, latest: Snapshot | null): Status {
  if (!latest || latest.momentum < 1) return "quiet";
  if (deltaPct >= 15) return "accelerating";
  if (deltaPct <= -45) return "quiet";
  if (deltaPct <= -15) return "cooling";
  return "steady";
}

// Pick the snapshot nearest to `days` ago, for week-over-week math.
function snapshotAround(snaps: Snapshot[], days: number): Snapshot | null {
  if (!snaps.length) return null;
  const target = Date.now() - days * 86400_000;
  let best = snaps[0];
  let bestGap = Infinity;
  for (const s of snaps) {
    const gap = Math.abs(new Date(s.date).getTime() - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  return best;
}

function pct(now: number, then: number): number {
  if (!then) return 0;
  return +(((now - then) / then) * 100).toFixed(1);
}

// The headline read: where is this entity heading, from stored memory.
export async function getTrajectory(handle: string): Promise<Trajectory> {
  const snaps = await getSnapshots(handle);
  const latest = snaps.length ? snaps[snaps.length - 1] : null;
  const weekAgo = snaps.length > 1 ? snapshotAround(snaps.slice(0, -1), 7) : null;
  const deltaPct = latest && weekAgo ? pct(latest.momentum, weekAgo.momentum) : 0;
  return {
    handle: handle.toLowerCase(),
    latest,
    weekAgo,
    deltaPct,
    status: classify(deltaPct, latest),
    history: snaps.length,
  };
}

// The movers feed: every tracked entity, ranked by stored weekly Δmomentum.
// This is the thing OSSInsight / the live-recompute board structurally can't do —
// it requires memory of last week.
export async function getMovers(): Promise<Trajectory[]> {
  const handles = await listEntities();
  const traj = await Promise.all(handles.map((h) => getTrajectory(h)));
  return traj.sort((a, b) => b.deltaPct - a.deltaPct);
}
