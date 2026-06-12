import { getUserTicker, getUserEvents } from "@/lib/github";
import { toCandles, candleSvg, UP, DOWN } from "@/lib/badges/core";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { DotDigits, SegmentBar } from "@/components/live/DotMatrix";
import {
  ClockPanel,
  RenderPanel,
  MemoryPanel,
  NetworkPanel,
  BatteryPanel,
  SeismographPanel,
  LiveChrome,
} from "@/components/live/LivePanels";
import { UsageSection } from "@/components/live/UsagePanels";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `$${handle.toUpperCase()} · LIVE — commit-markets`,
    description: `Mission control for @${handle}: live telemetry, contributions, streaks, activity.`,
  };
}

function rel(at: string): string {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(at)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function LivePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const t = await getUserTicker(handle, "1y");
  if (!t) notFound();
  const events = await getUserEvents(t.handle);

  const up = t.stats.changePct30d >= 0;
  const candles = candleSvg(toCandles(t.priceDaily.slice(-120), 24), 0, 2, 192, 56, {
    up: UP,
    down: DOWN,
  });

  // streak details
  let run = 0;
  let best = 0;
  for (const d of t.days) {
    if (d.commits > 0) {
      run++;
      if (run > best) best = run;
    } else run = 0;
  }
  const since = new Date(Date.now() - t.stats.currentStreakDays * 86400000)
    .toLocaleDateString("en", { day: "2-digit", month: "short" })
    .toUpperCase();

  return (
    <main className="px-2">
      <div className="mx-auto max-w-5xl py-4">
        {/* header strip */}
        <div className="mb-3 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>
            <Link href={`/${t.handle}`} className="text-foreground hover:text-success">{t.symbol}</Link> · MISSION CONTROL
          </span>
          <span>COMMIT-MARKETS · SYS.CM1</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {/* row 1-2 */}
          <div className="lg:col-span-2 lg:row-span-2 grid">
            <ClockPanel />
          </div>
          <RenderPanel />
          <MemoryPanel />

          {/* velocity */}
          <LiveChrome label="velocity · 120d">
            <div className="flex flex-1 items-end justify-between gap-3">
              <div>
                <div className="font-mono text-2xl font-bold text-foreground">{t.stats.price.toFixed(2)}</div>
                <div className={`font-mono text-[11px] font-semibold ${up ? "text-success" : "text-destructive"}`}>
                  {up ? "▲" : "▼"} {Math.abs(t.stats.changePct30d).toFixed(1)}% · 30D
                </div>
              </div>
              <svg width="192" height="60" viewBox="0 0 192 60" className="shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: candles }} />
            </div>
          </LiveChrome>
          <BatteryPanel />

          {/* premium telemetry (connector) */}
          <UsageSection handle={t.handle} />

          {/* row 3 */}
          <NetworkPanel />
          <LiveChrome label={`contributions · @${t.handle}`} right={<span>{t.stats.totalLastYear.toLocaleString()} / YR</span>} className="sm:col-span-2">
            <ActivityHeatmap days={t.daysYear} />
          </LiveChrome>
          <LiveChrome label="streak">
            <div className="flex flex-1 items-baseline gap-1 text-[#ff9f0a]">
              <DotDigits text={`${t.stats.currentStreakDays}`} dot={5} gap={2.5} />
              <span className="opacity-40"><DotDigits text="D" dot={3.5} gap={1.5} /></span>
            </div>
            <SegmentBar pct={(t.stats.currentStreakDays / Math.max(1, best)) * 100} segments={10} onClass="fill-[#ff9f0a]" className="mt-3" />
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {t.stats.currentStreakDays > 0 ? `SINCE ${since} · ` : ""}BEST {best}
            </div>
          </LiveChrome>

          {/* row 4 */}
          <div className="sm:col-span-2">
            <SeismographPanel />
          </div>
          <LiveChrome label={`activity · @${t.handle}`} right={<span>PUSH · MAIN</span>} className="sm:col-span-2">
            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
              {events.length === 0 && <span className="text-muted-foreground">no recent public events</span>}
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-14 shrink-0 font-semibold ${e.verb === "PUSH" ? "text-success" : "text-muted-foreground"}`}>{e.verb}</span>
                  <span className="truncate text-foreground/80">{e.repo}</span>
                  <span className="shrink-0 text-muted-foreground/70">{e.detail}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground/50">{rel(e.at)}</span>
                </div>
              ))}
            </div>
          </LiveChrome>
        </div>

        <div className="mt-3 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          <span>RENDER · MEMORY · NETWORK · BATTERY · INPUT = YOUR BROWSER, MEASURED LIVE</span>
          <Link href={`/${t.handle}`} className="hover:text-foreground">← TICKER</Link>
        </div>
      </div>
    </main>
  );
}
