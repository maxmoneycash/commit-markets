"use client";

import { useRef, useState } from "react";
import PriceChart from "@/components/PriceChart";
import { PanelHeader, PanelTitle } from "@/components/panel";
import type { Day } from "@/lib/github";

const RANGES = [
  { v: "1m", l: "1M" },
  { v: "1y", l: "1Y" },
  { v: "max", l: "MAX" },
] as const;
type R = (typeof RANGES)[number]["v"];
type Data = { days: Day[]; priceDaily: number[] };

export function ChartSection({
  handle,
  kind,
  initial,
}: {
  handle: string;
  kind: "user" | "repo";
  initial: Data;
}) {
  const [range, setRange] = useState<R>("1y");
  const [data, setData] = useState<Data>(initial);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, Data>>({ "1y": initial });

  async function pick(r: R) {
    if (r === range || kind !== "user") return;
    setRange(r);
    const cached = cache.current[r];
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/chart?handle=${encodeURIComponent(handle)}&range=${r}`);
      if (res.ok) {
        const d: Data = await res.json();
        cache.current[r] = d;
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  }

  const label = RANGES.find((x) => x.v === range)?.l ?? "1Y";

  return (
    <>
      <PanelHeader className="flex items-center justify-between">
        <PanelTitle>Velocity · {label}</PanelTitle>
        {kind === "user" ? (
          <div className="flex gap-0.5 rounded-md border border-line p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.v}
                onClick={() => pick(r.v)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  r.v === range ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.l}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">52W</span>
        )}
      </PanelHeader>
      <div className="relative px-2 py-2">
        <PriceChart days={data.days} priceDaily={data.priceDaily} />
        {loading && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-[1px]">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        )}
      </div>
    </>
  );
}
