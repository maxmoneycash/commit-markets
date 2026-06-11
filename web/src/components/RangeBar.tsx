// Low—high range bar with a marker at the current value (stock-app staple).
export function RangeBar({
  low,
  high,
  current,
  label,
}: {
  low: number;
  high: number;
  current: number;
  label: string;
}) {
  const pos = high > low ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100)) : 50;
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label} low</span>
        <span>{label} range</span>
        <span>{label} high</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-destructive/50 via-muted-foreground/30 to-success/50">
        <div
          className="absolute -top-[3px] size-3 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs tabular-nums text-foreground">
        <span>{fmt(low)}</span>
        <span className="text-muted-foreground">now {fmt(current)}</span>
        <span>{fmt(high)}</span>
      </div>
    </div>
  );
}
