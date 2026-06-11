"use client";

// Contribution graph — proportions and grayscale adapted from chanhdai.com's
// MIT-licensed contribution-graph (block 12 / margin 4 / radius 2 / font 14).
import { useRef, useState } from "react";
import type { Day } from "@/lib/github";

const FILL = [
  "fill-muted-foreground/5",
  "fill-muted-foreground/20",
  "fill-muted-foreground/40",
  "fill-muted-foreground/60",
  "fill-muted-foreground/80",
];
const BG = [
  "bg-muted-foreground/5",
  "bg-muted-foreground/20",
  "bg-muted-foreground/40",
  "bg-muted-foreground/60",
  "bg-muted-foreground/80",
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(commits: number): number {
  if (commits <= 0) return 0;
  if (commits <= 2) return 1;
  if (commits <= 5) return 2;
  if (commits <= 9) return 3;
  return 4;
}

const BLOCK = 12;
const MARGIN = 4;
const STEP = BLOCK + MARGIN;
const RADIUS = 0; // sharp corners (matches the reference)
const LABEL_H = 22;
const FONT = 13;

export function ActivityHeatmap({ days }: { days: Day[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ date: string; count: number; left: number; top: number } | null>(null);

  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const total = days.reduce((s, d) => s + d.commits, 0);

  const vbW = weeks.length * STEP - MARGIN;
  const vbH = LABEL_H + 7 * STEP - MARGIN;

  const monthLabels: { x: number; label: string }[] = [];
  let prev = -1;
  weeks.forEach((w, ci) => {
    const first = w[0];
    if (!first) return;
    const mo = new Date(first.date + "T00:00:00Z").getUTCMonth();
    if (mo !== prev) {
      if (ci < weeks.length - 2) monthLabels.push({ x: ci * STEP, label: MONTHS[mo] });
      prev = mo;
    }
  });

  function onEnter(e: React.MouseEvent<SVGRectElement>, d: Day) {
    const cont = ref.current?.getBoundingClientRect();
    if (!cont) return;
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ date: d.date, count: d.commits, left: r.left - cont.left + r.width / 2, top: r.top - cont.top });
  }

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" preserveAspectRatio="xMinYMin meet" role="img" aria-label="commit activity">
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={FONT} className="fill-muted-foreground font-sans" fontSize={FONT}>
              {m.label}
            </text>
          ))}
          {weeks.map((w, ci) =>
            w.map((d, ri) => (
              <rect
                key={`${ci}-${ri}`}
                x={ci * STEP}
                y={LABEL_H + ri * STEP}
                width={BLOCK}
                height={BLOCK}
                rx={RADIUS}
                ry={RADIUS}
                className={FILL[level(d.commits)]}
                onMouseEnter={(e) => onEnter(e, d)}
              />
            )),
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md"
            style={{ left: hover.left, top: hover.top - 8 }}
          >
            {hover.count} contribution{hover.count === 1 ? "" : "s"} on {fmtDate(hover.date)}
            <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {total.toLocaleString()} contributions in the past 365 days.
        </span>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span>Less</span>
          {BG.map((c, i) => (
            <span key={i} className={`size-[10px] ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
