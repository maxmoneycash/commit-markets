"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
} from "lightweight-charts";
import type { Candle, VolumeBar } from "@/lib/github";

// Zinc palettes matched to the chanhdai theme tokens. Hardcoded hex (not the
// oklch CSS vars) because the canvas renderer needs concrete colors.
const PALETTES = {
  dark: { bg: "#18181b", grid: "#27272a", text: "#a1a1aa", border: "#27272a" },
  light: { bg: "#ffffff", grid: "#f4f4f5", text: "#71717a", border: "#e4e4e7" },
};
const UP = "#26a69a";
const DOWN = "#ef5350";

export default function TickerChart({
  candles,
  volume,
}: {
  candles: Candle[];
  volume: VolumeBar[];
  up?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const p = resolvedTheme === "light" ? PALETTES.light : PALETTES.dark;

    const chart: IChartApi = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: p.bg },
        textColor: p.text,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: p.grid },
        horzLines: { color: p.grid },
      },
      rightPriceScale: { borderColor: p.border },
      timeScale: { borderColor: p.border, timeVisible: false },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candleSeries.setData(candles);

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeries.setData(volume);

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles, volume, resolvedTheme]);

  return <div ref={ref} className="h-[420px] w-full" />;
}
