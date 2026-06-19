"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type MarketView = {
  id: string;
  title: string;
  handle: string;
  kind: "threshold" | "shipped";
  resolveAtMs: number;
  priceYes: number;
};

const SORTS = [
  { key: "closing", label: "Closing" },
  { key: "confident", label: "Lopsided" },
  { key: "coinflip", label: "Coinflip" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function timeLeft(ms: number): string {
  const d = (ms - Date.now()) / 86400000;
  if (d <= 0) return "resolving";
  if (d < 1) return `${Math.ceil(d * 24)}h`;
  return `${Math.ceil(d)}d`;
}

export function MarketBoard({ initialMarkets }: { initialMarkets: MarketView[] }) {
  const [sort, setSort] = useState<SortKey>("closing");

  const markets = [...initialMarkets].sort((a, b) => {
    if (sort === "closing") return a.resolveAtMs - b.resolveAtMs;
    const la = Math.abs(a.priceYes - 0.5);
    const lb = Math.abs(b.priceYes - 0.5);
    return sort === "confident" ? lb - la : la - lb;
  });

  return (
    <>
      <div className="screen-line-bottom flex items-center justify-between border-x border-line px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {markets.length} markets
        </span>
        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                s.key === sort ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-line border-x border-line">
        {markets.map((m) => {
          const yes = Math.round(m.priceYes * 100);
          const up = yes >= 50;
          return (
            <Link
              key={m.id}
              href={`/markets/${m.id}`}
              className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-accent/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://github.com/${m.handle}.png?size=80`}
                alt=""
                className="size-9 shrink-0 rounded-md border border-line grayscale transition group-hover:grayscale-0"
              />

              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm font-medium text-foreground decoration-muted-foreground/30 underline-offset-[3px] group-hover:underline">
                  {m.title}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  ${m.handle} <span className="text-line">·</span> {m.kind} <span className="text-line">·</span> {timeLeft(m.resolveAtMs)}
                </div>
              </div>

              {/* vertical micro-gauge */}
              <div className="flex h-9 w-1 shrink-0 flex-col-reverse overflow-hidden rounded-full bg-destructive/30">
                <div className="w-full rounded-full bg-success" style={{ height: `${yes}%` }} />
              </div>

              <div className="w-12 shrink-0 text-right">
                <div className={cn("font-mono text-xl font-bold tabular-nums leading-none", up ? "text-success" : "text-destructive")}>
                  {yes}
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">yes</div>
              </div>
            </Link>
          );
        })}
        {markets.length === 0 && (
          <div className="px-4 py-12 text-center font-mono text-sm text-muted-foreground">No open markets yet.</div>
        )}
      </div>
    </>
  );
}
