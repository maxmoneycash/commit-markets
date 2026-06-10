import type { Day } from "@/lib/github";

const LEVELS = [
  "bg-muted-foreground/10",
  "bg-success/30",
  "bg-success/50",
  "bg-success/75",
  "bg-success",
];

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

  return (
    <div className="flex flex-col gap-2">
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {w.map((d, di) => (
                <div
                  key={di}
                  title={`${d.date}: ${d.commits} commit${d.commits === 1 ? "" : "s"}`}
                  className={`size-[11px] rounded-[2px] ${LEVELS[level(d.commits)]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 self-end font-mono text-[10px] text-muted-foreground">
        <span>less</span>
        {LEVELS.map((c, i) => (
          <span key={i} className={`size-[10px] rounded-[2px] ${c}`} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
