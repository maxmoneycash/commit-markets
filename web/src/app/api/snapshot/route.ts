import { Redis } from "@upstash/redis";
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { getUserTicker } from "@/lib/github";
import { TRACKED_HANDLES } from "@/lib/board";

// ── Index snapshotter ────────────────────────────────────────────────────────
// Records each tracked account's canonical velocity index + raw window counts on
// every tick, append-only. This is the resolution oracle for prediction markets:
// commit-velocity-at-a-past-instant CANNOT be recreated retroactively, so the
// value is entirely in starting to record early. Reuses getUserTicker so the
// snapshot metric is identical to the live ticker — no drift, ever.
//
// Trigger: Vercel Cron (GET). In production set CRON_SECRET and a vercel.json
// crons entry. Storage: Upstash sorted set per handle (score = epoch ms) when
// configured; else append-only JSONL under data/snapshots (local dev only —
// serverless fs is ephemeral, so prod REQUIRES Upstash).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Frozen window rule: trailing N calendar days of the daily commit series,
// summed. Published so resolutions are auditable. Do not change silently.
function trailingSum(days: { commits: number }[], n: number): number {
  return days.slice(-n).reduce((s, d) => s + (d.commits || 0), 0);
}

async function persist(handle: string, snap: object, tsMs: number) {
  if (redis) {
    // Sorted set keyed by handle; score = timestamp → ZRANGEBYSCORE resolves
    // "index at/near time T". Dedup-safe: re-running a tick overwrites same score.
    await redis.zadd(`snap:${handle}`, { score: tsMs, member: JSON.stringify(snap) });
    return "upstash";
  }
  const dir = join(process.cwd(), "data", "snapshots");
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, `${handle}.jsonl`), JSON.stringify(snap) + "\n");
  return "jsonl";
}

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is
  // set. Enforce it in prod; allow unauthenticated locally (no secret configured).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tsMs = Date.now();
  const ts = new Date(tsMs).toISOString();
  const results: { handle: string; ok: boolean; sink?: string; error?: string }[] = [];

  // Sequential to stay polite to the GitHub API and within the cron time budget.
  for (const handle of TRACKED_HANDLES) {
    try {
      const t = await getUserTicker(handle);
      if (!t) {
        results.push({ handle, ok: false, error: "ticker not found" });
        continue;
      }
      const snap = {
        handle,
        ts,
        tsMs,
        price: t.stats.price, // canonical velocity index
        changePct30d: t.stats.changePct30d,
        total7d: trailingSum(t.days, 7),
        total30d: trailingSum(t.days, 30),
        totalYear: t.stats.totalLastYear,
        peakWeek: t.stats.peakWeek,
        avgPerWeek: t.stats.avgPerWeek,
        currentStreakDays: t.stats.currentStreakDays,
        activeDays: t.stats.activeDays,
      };
      const sink = await persist(handle, snap, tsMs);
      results.push({ handle, ok: true, sink });
    } catch (e) {
      results.push({ handle, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const recorded = results.filter((r) => r.ok).length;
  return Response.json({ ok: true, ts, recorded, total: TRACKED_HANDLES.length, results });
}
