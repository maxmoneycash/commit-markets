// YES-probability area chart on the signature dot-grid background. Pure SVG,
// server-renderable. Points are implied-YES in [0,1], oldest → newest.

export function ProbChart({ points, height = 150 }: { points: number[]; height?: number }) {
  const W = 720;
  const H = height;
  const padX = 8;
  const padY = 14;

  if (points.length < 2) {
    return (
      <div className="cm-dotbg relative grid place-items-center" style={{ height: H }}>
        <span className="font-mono text-[11px] text-muted-foreground">no trades yet — odds sit at 50%</span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-[linear-gradient(to_right,var(--color-line)_4px,transparent_2px)] bg-size-[6px_1px]" />
      </div>
    );
  }

  const n = points.length;
  const x = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const y = (v: number) => padY + (1 - v) * (H - 2 * padY);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const last = points[n - 1];
  const up = last >= points[0];
  const stroke = up ? "var(--color-success)" : "var(--color-destructive)";
  const gid = `cm-area-${up ? "up" : "dn"}`;

  return (
    <div className="cm-dotbg relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="block">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 50% reference */}
        <line x1={padX} y1={y(0.5)} x2={W - padX} y2={y(0.5)} stroke="var(--color-line)" strokeDasharray="3 5" />
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(last)} r={3.5} fill={stroke} />
        <circle cx={x(n - 1)} cy={y(last)} r={6} fill={stroke} opacity={0.18} />
      </svg>
      <span className="absolute right-2 top-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">50% line</span>
    </div>
  );
}
