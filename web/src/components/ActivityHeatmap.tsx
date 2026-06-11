import type { Day } from "@/lib/github";

// grayscale levels, matching chanhdai.com's contribution graph
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

export function ActivityHeatmap({ days }: { days: Day[] }) {
  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const total = days.reduce((s, d) => s + d.commits, 0);

  const block = 11;
  const margin = 3;
  const step = block + margin;
  const labelH = 15;
  const vbW = weeks.length * step - margin;
  const vbH = labelH + 7 * step - margin;

  // month labels at the week where the month changes
  const monthLabels: { x: number; label: string }[] = [];
  let prev = -1;
  weeks.forEach((w, ci) => {
    const first = w[0];
    if (!first) return;
    const mo = new Date(first.date + "T00:00:00Z").getUTCMonth();
    if (mo !== prev) {
      if (ci < weeks.length - 2) monthLabels.push({ x: ci * step, label: MONTHS[mo] });
      prev = mo;
    }
  });

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" preserveAspectRatio="xMinYMin meet" role="img" aria-label="commit activity">
        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={10} className="fill-muted-foreground font-sans" fontSize={10}>
            {m.label}
          </text>
        ))}
        {weeks.map((w, ci) =>
          w.map((d, ri) => (
            <rect
              key={`${ci}-${ri}`}
              x={ci * step}
              y={labelH + ri * step}
              width={block}
              height={block}
              rx={2}
              className={FILL[level(d.commits)]}
            >
              <title>{`${d.date}: ${d.commits} commit${d.commits === 1 ? "" : "s"}`}</title>
            </rect>
          )),
        )}
      </svg>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {total.toLocaleString()} contributions in the past 365 days.
        </span>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span>Less</span>
          {BG.map((c, i) => (
            <span key={i} className={`size-[10px] rounded-[2px] ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
