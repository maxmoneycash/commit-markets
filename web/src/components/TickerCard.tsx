import Link from "next/link";
import type { UserSummary } from "@/lib/github";

function Spark({ points, up }: { points: number[]; up: boolean }) {
  const w = 96;
  const h = 32;
  if (points.length < 2) return <div style={{ width: w, height: h }} />;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const d = points
    .map((v, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className={up ? "text-success" : "text-destructive"} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function TickerCard({ s, rank, verified }: { s: UserSummary; rank?: number; verified?: boolean }) {
  const up = s.changePct30d >= 0;
  return (
    <Link
      href={`/${s.handle}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
    >
      {rank != null && <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{rank}</span>}
      {s.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.avatarUrl} alt="" className="size-8 shrink-0 rounded-md border border-line" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-sm font-medium text-foreground">{s.symbol}</span>
          {verified && (
            <span className="shrink-0 font-mono text-[11px] text-sky-500" title="Verified owner">
              ✓
            </span>
          )}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{s.handle}</div>
      </div>
      <Spark points={s.spark} up={up} />
      <div className="w-20 shrink-0 text-right">
        <div className="font-mono text-sm tabular-nums text-foreground">{s.price.toFixed(0)}</div>
        <div className={`font-mono text-[11px] tabular-nums ${up ? "text-success" : "text-destructive"}`}>
          {up ? "+" : ""}
          {s.changePct30d}%
        </div>
      </div>
    </Link>
  );
}
