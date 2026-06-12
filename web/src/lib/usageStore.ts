// Latest self-reported telemetry per handle. Dev: in-memory (single process).
// Deploy: swap for Vercel KV/Redis — the API surface stays identical.

export type AgentProc = { name: string; cpu: number; mem_mb: number };

export type UsagePayload = {
  v: 0;
  handle: string;
  updated: string; // ISO
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
  };
};

type Entry = { payload: UsagePayload; at: number };
export type HistoryPoint = { at: number; tokens_total?: number; cost_usd_total?: number; agents_cpu?: number };

const HISTORY_MAX = 576; // ~48h at 5-min cadence

const g = globalThis as unknown as {
  __cmUsage?: Map<string, Entry>;
  __cmUsageHist?: Map<string, HistoryPoint[]>;
};
const store = (g.__cmUsage ??= new Map<string, Entry>());
const hist = (g.__cmUsageHist ??= new Map<string, HistoryPoint[]>());

export function putUsage(p: UsagePayload): void {
  const key = p.handle.toLowerCase();
  store.set(key, { payload: p, at: Date.now() });
  // ring buffer for the burn lane / fundamentals trends
  const arr = hist.get(key) ?? [];
  arr.push({
    at: Date.now(),
    tokens_total: p.tokens?.total,
    cost_usd_total: p.tokens?.cost_usd_total,
    agents_cpu: p.agents?.reduce((s, a) => s + a.cpu, 0),
  });
  if (arr.length > HISTORY_MAX) arr.splice(0, arr.length - HISTORY_MAX);
  hist.set(key, arr);
}

export function getUsage(handle: string): { payload: UsagePayload; ageSec: number } | null {
  const e = store.get(handle.toLowerCase());
  if (!e) return null;
  return { payload: e.payload, ageSec: Math.floor((Date.now() - e.at) / 1000) };
}

export function getUsageHistory(handle: string): HistoryPoint[] {
  return hist.get(handle.toLowerCase()) ?? [];
}
