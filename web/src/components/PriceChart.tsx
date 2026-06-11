"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Day } from "@/lib/github";

// Primary price chart, rendered at DAILY resolution.
// - area: the daily momentum line (fine-grained)
// - candles: bucketed to a few days each so they stay small + dense but keep real OHLC
export default function PriceChart({
  days,
  priceDaily,
}: {
  days: Day[];
  priceDaily: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [mode, setMode] = useState<"area" | "candles">("candles");
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
  const volH = 56;
  const gap = 12;
  const priceH = H - padT - padB - volH - gap;
  const innerW = Math.max(0, w - padR);
  const N = days.length;

  // Daily candles built from multiple facets of the activity:
  //   body  = velocity trend (open=prior close, close=today's momentum)
  //   upper wick = BURST: how far the day's raw count spiked above the trend
  //   lower wick = cooling when the day fell below the trend
  // (raw count enters in the same *100 scale as the momentum series)
  type C = { i: number; open: number; close: number; high: number; low: number; vol: number };
  const candles: C[] = [];
  for (let i = 0; i < N; i++) {
    const open = priceDaily[i - 1] ?? priceDaily[i] ?? 0;
    const close = priceDaily[i] ?? 0;
    const spike = (days[i]?.commits ?? 0) * 100; // raw magnitude in price units
    const bodyHi = Math.max(open, close);
    const bodyLo = Math.min(open, close);
    const high = bodyHi + 0.5 * Math.max(0, spike - bodyHi); // burst above trend
    const low = Math.max(0, bodyLo - 0.45 * Math.max(0, bodyLo - spike)); // cooling below trend
    candles.push({ i, open, close, high, low, vol: days[i]?.commits ?? 0 });
  }

  // y-domain covers the line AND candle wicks
  const seriesHi = mode === "candles" ? Math.max(1, ...candles.map((c) => c.high)) : Math.max(1, ...priceDaily);
  const seriesLo = 0;
  const padv = (seriesHi - seriesLo) * 0.06 || 1;
  const dMax = seriesHi + padv;
  const dMin = seriesLo;
  const yP = (v: number) => padT + priceH * (1 - (v - dMin) / (dMax - dMin || 1));

  const slot = N ? innerW / N : 0;
  const bodyW = Math.max(1, slot - 0.4); // thin, dense daily candles
  const xCandle = (i: number) => i * slot + slot / 2;
  const xDay = (i: number) => (N > 1 ? (i / (N - 1)) * innerW : 0);

  // volume scaling per mode
  const volDailyMax = Math.max(1, ...days.map((d) => d.commits));
  const volCandleMax = Math.max(1, ...candles.map((c) => c.vol));
  const volTop = padT + priceH + gap;

  const ticks = Array.from({ length: 5 }, (_, i) => dMin + ((dMax - dMin) * i) / 4);
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = "";
  days.forEach((d, i) => {
    const m = d.date.slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      const dt = new Date(d.date + "T00:00:00Z");
      const x = mode === "candles" ? xCandle(i) : xDay(i);
      monthLabels.push({ x, label: dt.toLocaleString("en", { month: "short", timeZone: "UTC" }) });
    }
  });

  const lastVal = priceDaily[N - 1] ?? 0;
  const firstVal = priceDaily[0] ?? 0;
  const periodUp = lastVal >= firstVal;

  const linePath = priceDaily.map((v, i) => `${i ? "L" : "M"}${xDay(i).toFixed(1)} ${yP(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xDay(N - 1).toFixed(1)} ${yP(dMin).toFixed(1)} L0 ${yP(dMin).toFixed(1)} Z`;

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
        {w > 0 && N > 0 && (
          <svg width={w} height={H} className="block">
            <defs>
              <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${periodUp ? "success" : "destructive"})`} stopOpacity={0.22} />
                <stop offset="100%" stopColor={`var(--color-${periodUp ? "success" : "destructive"})`} stopOpacity={0} />
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
                <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
              </g>
            ) : (
              candles.map((c, b) => {
                const up = c.close >= c.open;
                const cls = up ? "fill-success stroke-success" : "fill-destructive stroke-destructive";
                const x = xCandle(b);
                const top = Math.min(yP(c.open), yP(c.close));
                const h = Math.max(1, Math.abs(yP(c.close) - yP(c.open)));
                return (
                  <g key={b} className={cls}>
                    <line x1={x} x2={x} y1={yP(c.high)} y2={yP(c.low)} strokeWidth={1} />
                    <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} rx={0.5} />
                  </g>
                );
              })
            )}

            {/* volume lane */}
            {mode === "area"
              ? days.map((d, i) => {
                  if (d.commits <= 0) return null;
                  const up = (priceDaily[i] ?? 0) >= (priceDaily[i - 1] ?? 0);
                  const y = volTop + volH * (1 - d.commits / volDailyMax);
                  const bw = Math.max(1, innerW / N - 0.5);
                  return <rect key={i} x={xDay(i) - bw / 2} y={y} width={bw} height={Math.max(0, volTop + volH - y)} className={up ? "fill-success/30" : "fill-destructive/30"} />;
                })
              : candles.map((c, b) => {
                  const up = c.close >= c.open;
                  const y = volTop + volH * (1 - c.vol / volCandleMax);
                  return <rect key={b} x={xCandle(b) - bodyW / 2} y={y} width={bodyW} height={Math.max(0, volTop + volH - y)} className={up ? "fill-success/30" : "fill-destructive/30"} />;
                })}

            {/* last price line + tag */}
            <g className={periodUp ? "fill-success stroke-success" : "fill-destructive stroke-destructive"}>
              <line x1={0} x2={innerW} y1={yP(lastVal)} y2={yP(lastVal)} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <rect x={w - padR + 2} y={yP(lastVal) - 9} width={padR - 4} height={18} rx={3} className={periodUp ? "fill-success" : "fill-destructive"} />
              <text x={w - padR / 2 + 1} y={yP(lastVal) + 3} textAnchor="middle" className="fill-background font-mono font-medium" fontSize={10} stroke="none">
                {lastVal.toFixed(0)}
              </text>
            </g>

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
