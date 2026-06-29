import { getUserTicker, getUserEvents } from "@/lib/github";
import { chartBandSvg } from "@/lib/badges/core";
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
import { Panel, PanelHeader, PanelTitle } from "@/components/panel";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `$${handle.toUpperCase()} · LIVE — commits.sh`,
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
  const bandDark = chartBandSvg(t.priceDaily, 0, 8, 560, 230, "dark");
  const bandLight = chartBandSvg(t.priceDaily, 0, 8, 560, 230, "light");

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
        <Panel>
          <PanelHeader className="flex flex-wrap items-center justify-between gap-1">
            <PanelTitle>
              <Link href={`/${t.handle}`} className="text-foreground hover:text-success">{t.symbol}</Link> · Mission Control
            </PanelTitle>
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              COMMIT-MARKETS · SYS.CM1
            </span>
          </PanelHeader>

          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {/* row 1-2: the chart is the star */}
          <div className="grid sm:col-span-2 lg:col-span-2 lg:row-span-2">
            <LiveChrome
              label="velocity · 1y"
              right={
                <span className={`font-semibold ${up ? "text-success" : "text-destructive"}`}>
                  {t.stats.price.toFixed(2)} {up ? "▲" : "▼"} {Math.abs(t.stats.changePct30d).toFixed(1)}%
                </span>
              }
              className="cm-dotbg"
            >
              <svg viewBox="0 0 560 246" className="hidden h-full w-full flex-1 dark:block" preserveAspectRatio="xMidYMid meet" aria-hidden dangerouslySetInnerHTML={{ __html: bandDark }} />
              <svg viewBox="0 0 560 246" className="h-full w-full flex-1 dark:hidden" preserveAspectRatio="xMidYMid meet" aria-hidden dangerouslySetInnerHTML={{ __html: bandLight }} />
            </LiveChrome>
          </div>
          <RenderPanel />
          <MemoryPanel />

          <ClockPanel compact />
          <BatteryPanel />

          {/* premium telemetry (connector) */}
          <UsageSection handle={t.handle} />

          {/* row 3 */}
          <NetworkPanel />
          <LiveChrome label={`contributions · @${t.handle}`} right={<span>{t.stats.totalLastYear.toLocaleString()} / YR</span>} className="sm:col-span-2">
            <ActivityHeatmap days={t.daysYear} />
          </LiveChrome>
          <LiveChrome label="streak">
            <div className="flex flex-1 items-baseline gap-1 text-amber">
              <DotDigits text={`${t.stats.currentStreakDays}`} dot={5} gap={2.5} />
              <span className="opacity-40"><DotDigits text="D" dot={3.5} gap={1.5} /></span>
            </div>
            <SegmentBar pct={(t.stats.currentStreakDays / Math.max(1, best)) * 100} segments={10} onClass="fill-amber" className="mt-3" />
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t.stats.currentStreakDays > 0 ? `SINCE ${since} · ` : ""}BEST {best}
            </div>
          </LiveChrome>

          {/* row 4 */}
          <div className="grid sm:col-span-2">
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

          <div className="screen-line-top flex flex-wrap items-center justify-between gap-1 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <span>RENDER · MEMORY · NETWORK · BATTERY · INPUT = YOUR BROWSER, MEASURED LIVE</span>
            <Link href={`/${t.handle}`} className="hover:text-foreground">← TICKER</Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}
