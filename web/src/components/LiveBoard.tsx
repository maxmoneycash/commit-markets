"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LiveData, LiveEntry } from "@/lib/live";

function ago(nowMs: number, at: string | undefined): string {
  if (!at) return "—";
  const s = Math.max(0, Math.floor((nowMs - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function eventLine(e: LiveEntry["lastEvent"]): string {
  if (!e) return "no public activity yet";
  const repo = e.repo ? e.repo.split("/").slice(-1)[0] : "";
  if (e.verb === "PUSH") return `pushed ${e.detail}${repo ? ` to ${repo}` : ""}`;
  if (e.verb === "PR") return `${e.detail} a PR${repo ? ` on ${repo}` : ""}`;
  if (e.verb === "RELEASE") return `shipped a release${repo ? ` on ${repo}` : ""}`;
  return `${e.verb.toLowerCase()}${repo ? ` · ${repo}` : ""}`;
}

export function LiveBoard({ initial }: { initial: LiveData }) {
  const [data, setData] = useState<LiveData>(initial);
  const [now, setNow] = useState<number>(initial.ts);
  const fetchedAt = useRef<number>(initial.ts);

  useEffect(() => {
    // start the wall clock immediately so relative times are accurate post-mount
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch("/api/live", { cache: "no-store" });
        if (r.ok) {
          setData(await r.json());
          fetchedAt.current = Date.now();
        }
      } catch {
        /* keep last good */
      }
    }, 12000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);

  const leader = data.leader;
  if (!leader) return null;
  const rest = data.entries.slice(1);
  const updated = Math.max(0, Math.floor((now - fetchedAt.current) / 1000));

  return (
    <div className="border-x border-line">
      {/* live header */}
      <div className="screen-line-bottom flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-destructive" />
          </span>
          <span className="text-foreground">live</span>
          <span className="text-muted-foreground">· shipping right now</span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
          updated {updated}s ago
        </span>
      </div>

      {/* leader */}
      <Link href={`/${leader.handle}`} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-accent/40">
        {leader.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={leader.avatarUrl} alt="" className="size-12 shrink-0 rounded-md border border-line" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-base font-bold text-foreground">{leader.symbol}</span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{ color: leader.tierColor, border: `1px solid ${leader.tierColor}55`, background: `${leader.tierColor}14` }}
            >
              {leader.tier}
            </span>
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              top shipper
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {eventLine(leader.lastEvent)} ·{" "}
            <span className="text-success">{ago(now, leader.lastEvent?.at)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-bold tabular-nums text-foreground">{leader.price.toFixed(0)}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">velocity</div>
        </div>
      </Link>

      {/* the rest */}
      <div className="divide-y divide-line border-t border-line">
        {rest.map((e, i) => (
          <Link key={e.handle} href={`/${e.handle}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/40">
            <span className="w-4 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{i + 2}</span>
            {e.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.avatarUrl} alt="" className="size-6 shrink-0 rounded border border-line" />
            )}
            <span className="shrink-0 font-mono text-xs font-medium text-foreground">{e.symbol}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {eventLine(e.lastEvent)} · {ago(now, e.lastEvent?.at)}
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{e.price.toFixed(0)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
