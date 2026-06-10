"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle, VolumeBar } from "@/lib/github";

// Clean SVG candlestick chart: tight (no gaps), readable, theme-aware, dot grid.
export default function CandleChart({
  candles,
  volume,
}: {
  candles: Candle[];
  volume: VolumeBar[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 440;
  const padR = 60;
  const padT = 12;
  const padB = 24;
  const volH = 64;
  const gap = 12;
  const priceH = H - padT - padB - volH - gap;
  const innerW = Math.max(0, w - padR);
  const n = candles.length;
  const slot = n ? innerW / n : 0;
  const bodyW = Math.max(1.5, slot - 2); // tight: ~2px between candles

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const hi = Math.max(1, ...highs);
  const lo = Math.min(0, ...lows);
  const pad = (hi - lo) * 0.06 || 1;
  const dMax = hi + pad;
  const dMin = Math.max(0, lo - pad);
  const yP = (v: number) => padT + priceH * (1 - (v - dMin) / (dMax - dMin || 1));
  const xC = (i: number) => i * slot + slot / 2;

  const volMax = Math.max(1, ...volume.map((v) => v.value));
  const volTop = padT + priceH + gap;
  const yV = (v: number) => volTop + volH * (1 - v / volMax);

  // y-axis ticks (nice-ish): 5 evenly spaced
  const ticks = Array.from({ length: 5 }, (_, i) => dMin + ((dMax - dMin) * i) / 4);
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);

  // month labels where the month changes
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = "";
  candles.forEach((c, i) => {
    const m = c.time.slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      const d = new Date(c.time + "T00:00:00Z");
      monthLabels.push({ x: xC(i), label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }) });
    }
  });

  const last = candles[candles.length - 1];
  const lastUp = last ? last.close >= last.open : true;

  return (
    <div ref={ref} className="cm-dotbg relative w-full" style={{ height: H }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={H} className="block">
          {/* gridlines + price labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={innerW} y1={yP(t)} y2={yP(t)} className="stroke-line" strokeWidth={1} />
              <text x={w - padR + 8} y={yP(t) + 3} className="fill-muted-foreground font-mono" fontSize={10}>
                {fmt(t)}
              </text>
            </g>
          ))}

          {/* candles */}
          {candles.map((c, i) => {
            const up = c.close >= c.open;
            const cls = up ? "fill-success stroke-success" : "fill-destructive stroke-destructive";
            const x = xC(i);
            const yO = yP(c.open);
            const yCl = yP(c.close);
            const top = Math.min(yO, yCl);
            const h = Math.max(1, Math.abs(yCl - yO));
            return (
              <g key={i} className={cls}>
                <line x1={x} x2={x} y1={yP(c.high)} y2={yP(c.low)} strokeWidth={1} />
                <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} rx={0.5} />
              </g>
            );
          })}

          {/* volume lane */}
          {volume.map((v, i) => {
            const c = candles[i];
            const up = c && c.close >= c.open;
            const x = xC(i);
            const y = yV(v.value);
            return (
              <rect
                key={i}
                x={x - bodyW / 2}
                y={y}
                width={bodyW}
                height={Math.max(0, volTop + volH - y)}
                className={up ? "fill-success/35" : "fill-destructive/35"}
              />
            );
          })}

          {/* last price line + tag */}
          {last && (
            <g className={lastUp ? "fill-success stroke-success" : "fill-destructive stroke-destructive"}>
              <line x1={0} x2={innerW} y1={yP(last.close)} y2={yP(last.close)} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <rect x={w - padR + 2} y={yP(last.close) - 9} width={padR - 4} height={18} rx={3} className={lastUp ? "fill-success" : "fill-destructive"} />
              <text x={w - padR / 2} y={yP(last.close) + 3} textAnchor="middle" className="fill-background font-mono font-medium" fontSize={10} stroke="none">
                {last.close.toFixed(0)}
              </text>
            </g>
          )}

          {/* month labels */}
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
              {m.label}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
