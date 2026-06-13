"use client";

// Per-model economics breakdown for /[handle]/live. One row per model: tokens,
// in/out split, cost, % of spend, and the EFFECTIVE $/Mtok derived from real
// cost data (accurate) with the reference list price shown alongside.

import { LiveChrome } from "./LivePanels";
import type { ModelUsage } from "@/lib/usageStore";
import { normalize, referencePrice, effectivePerMtok, PROVIDER_COLORS } from "@/lib/modelPricing";

function fmtTok(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export function ModelBreakdown({ models }: { models: ModelUsage[] }) {
  if (!models || models.length === 0) return null;

  const sorted = [...models].sort((a, b) => b.cost - a.cost);
  const rows = sorted.slice(0, 10);
  const hiddenCount = sorted.length - rows.length;
  const totalCost = models.reduce((s, m) => s + m.cost, 0);
  const hiddenCost = sorted.slice(10).reduce((s, m) => s + m.cost, 0);
  const maxCost = Math.max(1e-9, ...rows.map((m) => m.cost));

  return (
    <LiveChrome
      label="model breakdown · by spend"
      right={<span>EFFECTIVE $/MTOK</span>}
      className="sm:col-span-2"
    >
      <div className="flex flex-col gap-2">
        {rows.map((m) => {
          const meta = normalize(m.name);
          const ref = referencePrice(m.name);
          const tokens = m.in + m.out + m.cacheRead + m.cacheWrite;
          const eff = effectivePerMtok(m.cost, m.in, m.out, m.cacheRead, m.cacheWrite);
          const share = totalCost > 0 ? (m.cost / totalCost) * 100 : 0;
          // read:write — everything fed in (incl. cache) vs output, matching
          // the headline token-flow ratio (raw in:out reads ~0 for cache-heavy models)
          const readWrite = m.out > 0 ? Math.round((m.in + m.cacheRead + m.cacheWrite) / m.out) : null;
          const color = PROVIDER_COLORS[meta.provider];
          return (
            <div key={m.name} className="flex flex-col gap-1 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-foreground/90">{meta.display}</span>
                <span className="ml-auto shrink-0 tabular-nums text-foreground">{fmtUsd(m.cost)}</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{share.toFixed(0)}%</span>
              </div>
              {/* cost-share bar */}
              <div className="h-1.5 w-full overflow-hidden bg-muted-foreground/10">
                <div className="h-full" style={{ width: `${(m.cost / maxCost) * 100}%`, background: color }} />
              </div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                <span className="tabular-nums">{fmtTok(tokens)} tok</span>
                {readWrite != null && <span className="tabular-nums">rd:wr {readWrite}:1</span>}
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {eff != null ? `$${eff.toFixed(2)}` : "—"}
                  {ref && <span className="text-muted-foreground/50"> · ref ${ref.outputPerMtok}/out</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          <span>+{hiddenCount} more models</span>
          <span className="tabular-nums">{fmtUsd(hiddenCost)}</span>
        </div>
      )}
      <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
        effective = real cost ÷ tokens · ref prices editable in modelPricing.ts
      </p>
    </LiveChrome>
  );
}
