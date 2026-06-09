"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
} from "lightweight-charts";
import type { Candle, VolumeBar } from "@/lib/github";

export default function TickerChart({
  candles,
  volume,
  up,
}: {
  candles: Candle[];
  volume: VolumeBar[];
  up: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart: IChartApi = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f0e" },
        textColor: "#8a9a94",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#141b19" },
        horzLines: { color: "#141b19" },
      },
      rightPriceScale: { borderColor: "#1c2522" },
      timeScale: { borderColor: "#1c2522", timeVisible: false },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
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
  }, [candles, volume]);

  return (
    <div
      ref={ref}
      className="h-[420px] w-full"
      style={{ boxShadow: up ? "inset 0 0 120px rgba(38,166,154,0.06)" : "inset 0 0 120px rgba(239,83,80,0.06)" }}
    />
  );
}
