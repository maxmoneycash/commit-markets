import type { Day } from "@/lib/github";

// fill-* for the SVG cells
const FILL = [
  "fill-muted-foreground/10",
  "fill-success/30",
  "fill-success/55",
  "fill-success/80",
  "fill-success",
];
// bg-* for the legend swatches
const BG = ["bg-muted-foreground/10", "bg-success/30", "bg-success/55", "bg-success/80", "bg-success"];

function level(commits: number): number {
  if (commits <= 0) return 0;
  if (commits <= 2) return 1;
  if (commits <= 5) return 2;
  if (commits <= 9) return 3;
  return 4;
}

export function ActivityHeatmap({ days }: { days: Day[] }) {
  // chunk into weeks of 7 (data is date-ordered, week-grouped by the API)
  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const cell = 11;
  const gap = 3;
  const step = cell + gap;
  const vbW = weeks.length * step - gap;
  const vbH = 7 * step - gap;

  return (
    <div className="flex flex-col gap-2">
      {/* scales to fit any container width — whole year always visible, no scroll */}
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="commit activity">
        {weeks.map((w, ci) =>
          w.map((d, ri) => (
            <rect key={`${ci}-${ri}`} x={ci * step} y={ri * step} width={cell} height={cell} rx={2} className={FILL[level(d.commits)]}>
              <title>{`${d.date}: ${d.commits} commit${d.commits === 1 ? "" : "s"}`}</title>
            </rect>
          )),
        )}
      </svg>
      <div className="flex items-center gap-1.5 self-end font-mono text-[10px] text-muted-foreground">
        <span>less</span>
        {BG.map((c, i) => (
          <span key={i} className={`size-[10px] rounded-[2px] ${c}`} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
