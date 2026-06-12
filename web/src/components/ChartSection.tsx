"use client";

import { useEffect, useRef, useState } from "react";
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
  const cache = useRef<Partial<Record<string, Data>>>({ "1y": initial });
  const inflight = useRef<Partial<Record<string, Promise<Data | null>>>>({});

  function load(r: R): Promise<Data | null> {
    const cached = cache.current[r];
    if (cached) return Promise.resolve(cached);
    const pending = inflight.current[r];
    if (pending) return pending;
    const p = fetch(`/api/chart?handle=${encodeURIComponent(handle)}&range=${r}`)
      .then((res) => (res.ok ? (res.json() as Promise<Data>) : null))
      .then((d) => {
        if (d) cache.current[r] = d;
        return d;
      })
      .catch(() => null)
      .finally(() => {
        delete inflight.current[r];
      });
    inflight.current[r] = p;
    return p;
  }

  // warm the other ranges in the background so switching feels instant
  useEffect(() => {
    if (kind !== "user") return;
    load("1m");
    load("max");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, kind]);

  async function pick(r: R) {
    if (r === range || kind !== "user") return;
    setRange(r);
    const cached = cache.current[r];
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    const d = await load(r); // reuses an in-flight prefetch if there is one
    if (d) setData(d);
    setLoading(false);
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
