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

const g = globalThis as unknown as { __cmUsage?: Map<string, Entry> };
const store = (g.__cmUsage ??= new Map<string, Entry>());

export function putUsage(p: UsagePayload): void {
  store.set(p.handle.toLowerCase(), { payload: p, at: Date.now() });
}

export function getUsage(handle: string): { payload: UsagePayload; ageSec: number } | null {
  const e = store.get(handle.toLowerCase());
  if (!e) return null;
  return { payload: e.payload, ageSec: Math.floor((Date.now() - e.at) / 1000) };
}
