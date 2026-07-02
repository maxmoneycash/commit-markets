// Latest self-reported telemetry per handle.
// Prod (Vercel): Upstash Redis when UPSTASH_REDIS_REST_* / KV_REST_API_* env
// vars exist — required, because serverless instances don't share memory.
// Dev: in-memory fallback (single process), zero setup.

import { Redis } from "@upstash/redis";

export type AgentProc = { name: string; cpu: number; mem_mb: number };

export type UsagePayload = {
  v: 0;
  handle: string;
  updated: string; // ISO
  plan?: string; // "pro" | "max5" | "max20" | "api" — for the leverage metric
  machine?: {
    platform?: string;
    cpu_cores?: number;
    cpu_load_1m?: number;
    mem_used_gb?: number;
    mem_total_gb?: number;
    uptime_h?: number;
  };
  agents?: AgentProc[]; // coding agents currently running
  tokens?: {
    total?: number;
    by_agent?: { name: string; tokens: number }[];
    cost_usd_total?: number;
    cache_hit_rate?: number;
    models_used?: number;
    avg_usd_month?: number;
    // live ccusage poll (moves tick-to-tick; `total` from the profile
    // pipeline only moves when that repo's collector pushes)
    live_total?: number;
    live_cost_usd?: number;
    // in/out/cache split — the read:write ratio (cache reads dominate
    // agentic coding; output is a tiny but expensive slice)
    input_total?: number;
    output_total?: number;
    cache_read_total?: number;
    cache_write_total?: number;
    // per-model economics breakdown (aggregated from modelBreakdowns)
    by_model?: ModelUsage[];
  };
};

export type ModelUsage = {
  name: string;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

/** Monthly $ a subscription costs — for the leverage metric (value ÷ what you pay). */
export function planMonthly(plan?: string): number {
  switch (plan) {
    case "pro": return 20;
    case "max5": return 100;
    case "max20": return 200;
    default: return 0; // "api" / unknown → no leverage (they pay per token)
  }
}
export function planLabel(plan?: string): string {
  switch (plan) {
    case "pro": return "Pro";
    case "max5": return "Max 5×";
    case "max20": return "Max 20×";
    case "api": return "API";
    default: return "";
  }
}

type Entry = { payload: UsagePayload; at: number };
export type HistoryPoint = { at: number; tokens_total?: number; cost_usd_total?: number; agents_cpu?: number };

const HISTORY_MAX = 576; // ~48h at 5-min cadence
const ENTRY_TTL_SEC = 7 * 24 * 3600; // stale collectors age out of Redis

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const g = globalThis as unknown as {
  __cmUsage?: Map<string, Entry>;
  __cmUsageHist?: Map<string, HistoryPoint[]>;
  __cmUsageHandles?: Set<string>;
};
const store = (g.__cmUsage ??= new Map<string, Entry>());
const hist = (g.__cmUsageHist ??= new Map<string, HistoryPoint[]>());
const localHandles = (g.__cmUsageHandles ??= new Set<string>());

function toHistoryPoint(p: UsagePayload): HistoryPoint {
  // tokens_total is strictly the live ccusage series (the static profile
  // total is a different scope; mixing the two would corrupt deltas).
  // Collectors attach live_total only on fresh polls, so points in between
  // simply skip the burn fields.
  return {
    at: Date.now(),
    tokens_total: p.tokens?.live_total,
    cost_usd_total: p.tokens?.live_cost_usd,
    agents_cpu: p.agents?.reduce((s, a) => s + a.cpu, 0),
  };
}

export async function putUsage(p: UsagePayload): Promise<void> {
  const key = p.handle.toLowerCase();
  const point = toHistoryPoint(p);

  if (redis) {
    await Promise.all([
      redis.set(`usage:${key}`, { payload: p, at: Date.now() } satisfies Entry, { ex: ENTRY_TTL_SEC }),
      redis.sadd("usage:handles", key), // index of connected users, for the grind board
      redis
        .rpush(`usage:hist:${key}`, JSON.stringify(point))
        .then(() => redis.ltrim(`usage:hist:${key}`, -HISTORY_MAX, -1))
        .then(() => redis.expire(`usage:hist:${key}`, ENTRY_TTL_SEC)),
    ]);
    return;
  }

  localHandles.add(key);
  store.set(key, { payload: p, at: Date.now() });
  const arr = hist.get(key) ?? [];
  arr.push(point);
  if (arr.length > HISTORY_MAX) arr.splice(0, arr.length - HISTORY_MAX);
  hist.set(key, arr);
}

export async function getUsage(handle: string): Promise<{ payload: UsagePayload; ageSec: number } | null> {
  const key = handle.toLowerCase();
  if (redis) {
    const e = await redis.get<Entry>(`usage:${key}`);
    if (!e) return null;
    return { payload: e.payload, ageSec: Math.floor((Date.now() - e.at) / 1000) };
  }
  const e = store.get(key);
  if (!e) return null;
  return { payload: e.payload, ageSec: Math.floor((Date.now() - e.at) / 1000) };
}

export type GrindRow = {
  handle: string;
  tokens: number;
  value: number;
  leverage: number;
  plan?: string;
  ageSec: number;
};

/** The "biggest grinders" board — everyone who's connected, ranked by value extracted. */
export async function getGrindBoard(limit = 50): Promise<GrindRow[]> {
  const handles = redis ? await redis.smembers("usage:handles") : [...localHandles];
  const rows = await Promise.all(
    handles.map(async (h): Promise<GrindRow | null> => {
      const u = await getUsage(h);
      const t = u?.payload.tokens;
      if (!u || !t || !t.total) return null;
      const value = t.cost_usd_total ?? 0;
      const monthly = planMonthly(u.payload.plan);
      return {
        handle: u.payload.handle,
        tokens: t.total,
        value,
        leverage: monthly > 0 ? value / monthly : 0,
        plan: u.payload.plan,
        ageSec: u.ageSec,
      };
    }),
  );
  return rows
    .filter((r): r is GrindRow => r !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getUsageHistory(handle: string): Promise<HistoryPoint[]> {
  const key = handle.toLowerCase();
  if (redis) {
    const raw = await redis.lrange(`usage:hist:${key}`, 0, -1);
    return raw
      .map((s) => {
        try {
          return (typeof s === "string" ? JSON.parse(s) : s) as HistoryPoint;
        } catch {
          return null;
        }
      })
      .filter((p): p is HistoryPoint => p !== null);
  }
  return hist.get(key) ?? [];
}
