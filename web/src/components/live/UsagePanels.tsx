"use client";

// Premium telemetry panels for /[handle]/live — renders the self-reported
// usage feed (tokens, cost, agents running, machine) when a collector is
// connected; otherwise a connect CTA. Polls /api/usage every 20s.

import { useEffect, useState } from "react";
import { LiveChrome } from "./LivePanels";
import { SegmentBar } from "./DotMatrix";
import { ModelBreakdown } from "./ModelBreakdown";
import type { UsagePayload, HistoryPoint } from "@/lib/usageStore";

type Feed =
  | (UsagePayload & { connected: true; ageSec: number; history?: HistoryPoint[] })
  | { connected: false };

// Burn lane: token-burn velocity (tokens/min) from consecutive live points.
// The buffer interleaves 60s ticks (no tokens_total) with ~5-min live polls,
// so filter to live points FIRST, then pair. Clamp negatives (collector
// restarts) and ignore gaps longer than 30 min.
function burnSeries(hist: HistoryPoint[]): number[] {
  const live = hist.filter((p) => p.tokens_total != null);
  const out: number[] = [];
  for (let i = 1; i < live.length; i++) {
    const a = live[i - 1];
    const b = live[i];
    const dtMin = (b.at - a.at) / 60_000;
    if (dtMin <= 0 || dtMin > 30) continue;
    out.push(Math.max(0, (b.tokens_total! - a.tokens_total!) / dtMin));
  }
  return out;
}

function fmtTok(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

const AGENT_COLORS: Record<string, string> = {
  claude: "#d97757",
  codex: "#19c37d",
  droid: "#58a6ff",
  kimi: "#a371f7",
  opencode: "#f2cc60",
  cursor: "#e3e9f0",
};

function FreshTag({ ageSec }: { ageSec: number }) {
  const fresh = ageSec < 120;
  return fresh ? (
    <span className="flex items-center gap-1.5 text-success">
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      SELF-REPORTED · LIVE
    </span>
  ) : (
    <span className="text-muted-foreground">SELF-REPORTED · {Math.floor(ageSec / 60)}M AGO</span>
  );
}

export function UsageSection({ handle }: { handle: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/usage?handle=${encodeURIComponent(handle)}&history=1`, { cache: "no-store" });
        const d = (await r.json()) as Feed;
        if (alive) setFeed(d);
      } catch {
        /* keep last */
      }
    };
    poll();
    const t = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [handle]);

  if (!feed) return null;

  if (!feed.connected) {
    return (
      <div className="sm:col-span-2 lg:col-span-4">
        <LiveChrome label="usage telemetry" right={<span>NOT CONNECTED</span>}>
          <div className="flex flex-col gap-2 py-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <span>
              Stream your real local stats — tokens by agent, cost, what your machine is running — onto this page.
            </span>
            <code className="w-fit border border-line bg-muted/30 px-2 py-1 text-foreground/80">
              node tools/cm-agent.mjs {handle} --watch
            </code>
          </div>
        </LiveChrome>
      </div>
    );
  }

  const tok = feed.tokens;
  const byAgent = tok?.by_agent ?? [];
  const maxTok = Math.max(1, ...byAgent.map((a) => a.tokens));
  const agents = feed.agents ?? [];
  const m = feed.machine;
  const burn = burnSeries(feed.history ?? []).slice(-24);
  // p95 scale with bars clamped to full height — one outlier delta (e.g. a
  // collector restart) shouldn't flatten the whole lane
  const burnSorted = [...burn].sort((a, b) => a - b);
  const burnMax = Math.max(1, burnSorted[Math.min(burnSorted.length - 1, Math.floor(burnSorted.length * 0.95))] ?? 1);
  const burnNow = burn.length ? burn.slice(-5).reduce((s, x) => s + x, 0) / Math.min(5, burn.length) : null;

  return (
    <>
      <LiveChrome label="tokens · all-time" right={<FreshTag ageSec={feed.ageSec} />} className="sm:col-span-2">
        <div className="font-mono text-3xl font-bold text-foreground">
          {tok?.total != null ? fmtTok(tok.total) : "—"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">TOKENS</span>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {byAgent.slice(0, 6).map((a) => (
            <div key={a.name} className="flex items-center gap-2 font-mono text-[10px]">
              <span className="w-16 shrink-0 uppercase text-muted-foreground">{a.name}</span>
              <div className="h-2 flex-1 overflow-hidden bg-muted-foreground/10">
                <div
                  className="h-full"
                  style={{ width: `${(a.tokens / maxTok) * 100}%`, background: AGENT_COLORS[a.name] ?? "#8b949e" }}
                />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums text-foreground/80">{fmtTok(a.tokens)}</span>
            </div>
          ))}
        </div>
      </LiveChrome>

      <LiveChrome label="compute deployed">
        <div className="flex-1">
          <div className="font-mono text-3xl font-bold text-foreground">
            ${tok?.cost_usd_total != null ? Math.round(tok.cost_usd_total).toLocaleString() : "—"}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            ALL-TIME · ${tok?.avg_usd_month != null ? Math.round(tok.avg_usd_month).toLocaleString() : "—"}/MO AVG
          </div>
        </div>
        {burn.length > 1 && (
          <>
            <svg width="100%" height="18" viewBox="0 0 192 18" preserveAspectRatio="none" className="mt-3" aria-hidden>
              {burn.map((v, i) => {
                const h = Math.max(1.5, Math.min(16, (v / burnMax) * 16));
                return (
                  <rect
                    key={i}
                    x={(24 - burn.length + i) * 8}
                    y={18 - h}
                    width={5}
                    height={h}
                    className={i === burn.length - 1 ? "fill-amber" : "fill-muted-foreground/30"}
                  />
                );
              })}
            </svg>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              BURN {burnNow != null ? fmtTok(burnNow) : "—"} TOK/MIN
            </div>
          </>
        )}
        {tok?.cache_hit_rate != null && (
          <>
            <SegmentBar pct={tok.cache_hit_rate * 100} segments={14} onClass="fill-amber" className="mt-3" />
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {(tok.cache_hit_rate * 100).toFixed(1)}% CACHE HIT
            </div>
          </>
        )}
      </LiveChrome>

      <LiveChrome label="agents running" right={<FreshTag ageSec={feed.ageSec} />}>
        <div className="flex flex-col gap-1.5 font-mono text-[11px]">
          {agents.length === 0 && <span className="text-muted-foreground">none detected</span>}
          {agents.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: AGENT_COLORS[a.name] ?? "#39d353" }} />
              <span className="uppercase text-foreground/90">{a.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{a.cpu.toFixed(0)}% CPU</span>
              <span className="w-16 text-right tabular-nums text-muted-foreground/70">{Math.round(a.mem_mb)}MB</span>
            </div>
          ))}
        </div>
        {m && (
          <div className="mt-3 border-t border-line pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            LOAD {m.cpu_load_1m?.toFixed(1) ?? "—"} / {m.cpu_cores ?? "—"} CORES · MEM{" "}
            {m.mem_used_gb?.toFixed(0) ?? "—"}/{m.mem_total_gb?.toFixed(0) ?? "—"}GB
          </div>
        )}
      </LiveChrome>

      <TokenFlowPanel tok={tok} ageSec={feed.ageSec} />
      {tok?.by_model && <ModelBreakdown models={tok.by_model} />}
    </>
  );
}

// Where do the tokens actually go? Cache reads dominate agentic coding (~97%),
// output is a tiny but expensive slice. This panel makes the read:write story
// legible at a glance.
function TokenFlowPanel({ tok, ageSec }: { tok: UsagePayload["tokens"]; ageSec: number }) {
  const inTok = tok?.input_total ?? 0;
  const out = tok?.output_total ?? 0;
  const cacheRead = tok?.cache_read_total ?? 0;
  const cacheWrite = tok?.cache_write_total ?? 0;
  const total = inTok + out + cacheRead + cacheWrite;
  if (total <= 0) return null;

  const seg = (n: number) => (n / total) * 100;
  const inOut = out > 0 ? Math.round((inTok + cacheRead + cacheWrite) / out) : null;
  const cachePct = ((cacheRead + cacheWrite) / total) * 100;

  return (
    <LiveChrome label="token flow · where it goes" right={<FreshTag ageSec={ageSec} />} className="sm:col-span-2">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="font-mono text-3xl font-bold text-foreground">
            {inOut != null ? `${inOut}:1` : "—"}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">READ : WRITE</div>
        </div>
        <div>
          <div className="font-mono text-3xl font-bold text-amber">{cachePct.toFixed(1)}%</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">CACHE READS</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-3xl font-bold text-foreground">{seg(out).toFixed(2)}%</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">OUTPUT</div>
        </div>
      </div>
      {/* stacked share bar */}
      <div className="mt-3 flex h-2.5 w-full overflow-hidden bg-muted-foreground/10">
        <div className="h-full bg-muted-foreground/40" style={{ width: `${seg(cacheRead)}%` }} title="cache read" />
        <div className="h-full bg-amber/70" style={{ width: `${seg(cacheWrite)}%` }} title="cache write" />
        <div className="h-full bg-success/70" style={{ width: `${seg(inTok)}%` }} title="input" />
        <div className="h-full bg-destructive/80" style={{ width: `${seg(out)}%` }} title="output" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-1.5 bg-muted-foreground/40" />cache rd {fmtTok(cacheRead)}</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 bg-amber/70" />cache wr {fmtTok(cacheWrite)}</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 bg-success/70" />in {fmtTok(inTok)}</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 bg-destructive/80" />out {fmtTok(out)}</span>
      </div>
    </LiveChrome>
  );
}
