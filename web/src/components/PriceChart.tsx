"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Candle, VolumeBar } from "@/lib/github";

// Primary price chart. Defaults to a clean area/line (the momentum series is
// smooth, so candles just add noise — see the lab comparison). Candles available
// as a toggle.
export default function PriceChart({
  candles,
  volume,
}: {
  candles: Candle[];
  volume: VolumeBar[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [mode, setMode] = useState<"area" | "candles">("area");
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 440;
  const padR = 56;
  const padT = 12;
  const padB = 24;
  const volH = 60;
  const gap = 12;
  const priceH = H - padT - padB - volH - gap;
  const innerW = Math.max(0, w - padR);
  const n = candles.length;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const hi = Math.max(1, ...highs);
  const lo = Math.min(0, ...lows);
  const padv = (hi - lo) * 0.06 || 1;
  const dMax = hi + padv;
  const dMin = Math.max(0, lo - padv);
  const yP = (v: number) => padT + priceH * (1 - (v - dMin) / (dMax - dMin || 1));

  const slot = n ? innerW / n : 0;
  const bodyW = Math.max(1.5, slot - 2);
  const xC = (i: number) => i * slot + slot / 2;
  // area uses edge-to-edge x so the line fills the width
  const xL = (i: number) => (n > 1 ? (i / (n - 1)) * innerW : 0);

  const volMax = Math.max(1, ...volume.map((v) => v.value));
  const volTop = padT + priceH + gap;
  const yV = (v: number) => volTop + volH * (1 - v / volMax);

  const ticks = Array.from({ length: 5 }, (_, i) => dMin + ((dMax - dMin) * i) / 4);
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = "";
  candles.forEach((c, i) => {
    const m = c.time.slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      const d = new Date(c.time + "T00:00:00Z");
      monthLabels.push({ x: mode === "candles" ? xC(i) : xL(i), label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }) });
    }
  });

  const last = candles[n - 1];
  const first = candles[0];
  const periodUp = last && first ? last.close >= first.open : true;
  const accent = periodUp ? "success" : "destructive";

  const linePath = candles.map((c, i) => `${i ? "L" : "M"}${xL(i).toFixed(1)} ${yP(c.close).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xL(n - 1).toFixed(1)} ${yP(dMin).toFixed(1)} L0 ${yP(dMin).toFixed(1)} Z`;

  return (
    <div className="relative">
      <div className="absolute left-2 top-2 z-10 flex gap-0.5 rounded-md border border-line bg-background/70 p-0.5 backdrop-blur-sm">
        {(["area", "candles"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div ref={ref} className="cm-dotbg relative w-full" style={{ height: H }}>
        {w > 0 && n > 0 && (
          <svg width={w} height={H} className="block">
            <defs>
              <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${accent})`} stopOpacity={0.22} />
                <stop offset="100%" stopColor={`var(--color-${accent})`} stopOpacity={0} />
              </linearGradient>
            </defs>

            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={0} x2={innerW} y1={yP(t)} y2={yP(t)} className="stroke-line" strokeWidth={1} />
                <text x={w - padR + 8} y={yP(t) + 3} className="fill-muted-foreground font-mono" fontSize={10}>
                  {fmt(t)}
                </text>
              </g>
            ))}

            {mode === "area" ? (
              <g className={periodUp ? "text-success" : "text-destructive"}>
                <path d={areaPath} fill={`url(#g${gid})`} />
                <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" />
              </g>
            ) : (
              candles.map((c, i) => {
                const up = c.close >= c.open;
                const cls = up ? "fill-success stroke-success" : "fill-destructive stroke-destructive";
                const x = xC(i);
                const top = Math.min(yP(c.open), yP(c.close));
                const h = Math.max(1, Math.abs(yP(c.close) - yP(c.open)));
                return (
                  <g key={i} className={cls}>
                    <line x1={x} x2={x} y1={yP(c.high)} y2={yP(c.low)} strokeWidth={1} />
                    <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} rx={0.5} />
                  </g>
                );
              })
            )}

            {/* volume lane */}
            {volume.map((v, i) => {
              const c = candles[i];
              const up = c && c.close >= c.open;
              const x = mode === "candles" ? xC(i) : xL(i);
              const bw = mode === "candles" ? bodyW : Math.max(1, slot - 2);
              const y = yV(v.value);
              return (
                <rect key={i} x={x - bw / 2} y={y} width={bw} height={Math.max(0, volTop + volH - y)} className={up ? "fill-success/30" : "fill-destructive/30"} />
              );
            })}

            {/* last price line + tag */}
            {last && (
              <g className={periodUp ? "fill-success stroke-success" : "fill-destructive stroke-destructive"}>
                <line x1={0} x2={innerW} y1={yP(last.close)} y2={yP(last.close)} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <rect x={w - padR + 2} y={yP(last.close) - 9} width={padR - 4} height={18} rx={3} className={periodUp ? "fill-success" : "fill-destructive"} />
                <text x={w - padR / 2 + 1} y={yP(last.close) + 3} textAnchor="middle" className="fill-background font-mono font-medium" fontSize={10} stroke="none">
                  {last.close.toFixed(0)}
                </text>
              </g>
            )}

            {monthLabels.map((m, i) => (
              <text key={i} x={m.x} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
                {m.label}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
