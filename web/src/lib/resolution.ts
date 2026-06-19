// Resolution reader for prediction markets. Reads the append-only index
// snapshots written by /api/snapshot and answers the two questions every market
// mechanism (LMSR, parimutuel, whatever) needs, independent of the trading layer:
//
//   1. getSeries(handle)            — the recorded time series (charts, audits)
//   2. getAtOrBefore(handle, tMs)   — the canonical index AS OF resolution time T
//      (the latest snapshot at or before T — markets resolve against this)
//
// Storage mirrors the writer: Upstash sorted set `snap:<handle>` (score = epoch
// ms) in prod; local JSONL fallback (data/snapshots/<handle>.jsonl) in dev.

import { Redis } from "@upstash/redis";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type SnapshotPoint = {
  handle: string;
  ts: string;
  tsMs: number;
  price: number; // canonical velocity index
  changePct30d: number;
  total7d: number;
  total30d: number;
  totalYear: number;
  peakWeek: number;
  avgPerWeek: number;
  currentStreakDays: number;
  activeDays: number;
};

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

/** Recorded series for a handle, ascending by time, optionally bounded by [fromMs, toMs]. */
export async function getSeries(handle: string, fromMs = 0, toMs = Number.MAX_SAFE_INTEGER): Promise<SnapshotPoint[]> {
  let points: SnapshotPoint[] = [];
  if (redis) {
    const members = await redis.zrange<string[]>(`snap:${handle}`, fromMs, toMs, { byScore: true });
    points = members.map((m) => (typeof m === "string" ? JSON.parse(m) : m) as SnapshotPoint);
  } else {
    try {
      const raw = await readFile(join(process.cwd(), "data", "snapshots", `${handle}.jsonl`), "utf8");
      points = raw
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as SnapshotPoint)
        .filter((p) => p.tsMs >= fromMs && p.tsMs <= toMs);
    } catch {
      points = [];
    }
  }
  return points.sort((a, b) => a.tsMs - b.tsMs);
}

/** The canonical snapshot AS OF time T — the latest at or before tMs. Null if none recorded yet. */
export async function getAtOrBefore(handle: string, tMs: number): Promise<SnapshotPoint | null> {
  const series = await getSeries(handle, 0, tMs);
  return series.length ? series[series.length - 1] : null;
}

// ── Auto-resolution (mechanism-independent) ─────────────────────────────────
// These decide a market's OUTCOME from recorded data. How shares/payouts work
// (LMSR vs parimutuel) is a separate, still-open layer.

export type Resolution = { resolved: boolean; outcome?: "YES" | "NO"; observed?: number; reason?: string };

/** Threshold market: did `metric` reach `n` as of resolution time? */
export async function resolveThreshold(
  handle: string,
  metric: "total7d" | "total30d" | "totalYear" | "price",
  n: number,
  atMs: number,
): Promise<Resolution> {
  const snap = await getAtOrBefore(handle, atMs);
  if (!snap) return { resolved: false, reason: "no snapshot at/before resolution time" };
  const observed = snap[metric];
  return { resolved: true, outcome: observed >= n ? "YES" : "NO", observed };
}

/** Streak market: was the account active (shipped) as of resolution time? */
export async function resolveShipped(handle: string, atMs: number): Promise<Resolution> {
  const snap = await getAtOrBefore(handle, atMs);
  if (!snap) return { resolved: false, reason: "no snapshot at/before resolution time" };
  const observed = snap.total7d;
  return { resolved: true, outcome: observed > 0 ? "YES" : "NO", observed };
}
