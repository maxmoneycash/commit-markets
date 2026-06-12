"use client";

// FUNDAMENTALS — the income-statement panel for connected tickers.
// Output = commits (the index), compute = self-reported spend, efficiency =
// commits per $100. Renders nothing when no collector is connected.

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/panel";
import type { UsagePayload } from "@/lib/usageStore";

type Feed = (UsagePayload & { connected: true; ageSec: number }) | { connected: false };

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 bg-background px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-base tabular-nums text-foreground">{value}</span>
      <span className="font-mono text-[10px] text-muted-foreground/70">{sub}</span>
    </div>
  );
}

export function Fundamentals({
  handle,
  avgPerWeek,
}: {
  handle: string;
  avgPerWeek: number;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);

  useEffect(() => {
    fetch(`/api/usage?handle=${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed({ connected: false }));
  }, [handle]);

  if (!feed || !feed.connected || !feed.tokens) return null;

  const t = feed.tokens;
  const weeklyUsd = t.avg_usd_month != null ? t.avg_usd_month / 4.33 : null;
  const effPer100 = weeklyUsd && weeklyUsd > 0 ? avgPerWeek / (weeklyUsd / 100) : null;
  const costPerCommit = weeklyUsd != null && avgPerWeek > 0 ? weeklyUsd / avgPerWeek : null;
  const fmtTok = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n)}`;

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between">
        <PanelTitle>Fundamentals</PanelTitle>
        <span className="rounded border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          self-reported
        </span>
      </PanelHeader>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        <Cell label="Output" value={`${avgPerWeek.toFixed(1)}/wk`} sub="commits · the index" />
        <Cell
          label="Compute deployed"
          value={weeklyUsd != null ? `$${weeklyUsd.toFixed(0)}/wk` : "—"}
          sub={t.total != null ? `${fmtTok(t.total)} tokens all-time` : "tokens n/a"}
        />
        <Cell
          label="Efficiency"
          value={effPer100 != null ? `${effPer100.toFixed(1)}` : "—"}
          sub="commits per $100"
        />
        <Cell
          label="Cost / commit"
          value={costPerCommit != null ? `$${costPerCommit.toFixed(2)}` : "—"}
          sub="weekly spend ÷ output"
        />
      </div>
    </Panel>
  );
}
