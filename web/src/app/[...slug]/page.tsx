import { getUserTicker, getRepoTicker, analystBlurb, type Ticker } from "@/lib/github";
import { ChartSection } from "@/components/ChartSection";
import ShareButton from "@/components/ShareButton";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { RangeBar } from "@/components/RangeBar";
import { HatchSeparator } from "@/components/HatchSeparator";
import { Panel, PanelHeader, PanelTitle, PanelContent } from "@/components/panel";
import { CopyButton } from "@/components/CopyButton";
import { Fundamentals } from "@/components/Fundamentals";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getClaim, claimConfigured } from "@/lib/claims";

export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function resolve(slug: string[]): Promise<Ticker | null> {
  if (slug.length >= 2) return getRepoTicker(slug[0], slug.slice(1).join("/"));
  return getUserTicker(slug[0], "1y");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const handle = slug.join("/");
  const t = await resolve(slug);
  if (!t) return { title: "ticker not found — commits.sh" };
  const title = `${t.symbol} — commits.sh`;
  const description = analystBlurb(t);
  const og = `/api/og?handle=${encodeURIComponent(handle)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-background px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-base tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const t = await resolve(slug);
  if (!t) notFound();

  // Verified-ownership claim (global state, so the page stays cacheable — we do
  // NOT read the visitor's session cookie here, which would force dynamic render).
  const claim = t.kind === "user" ? await getClaim(t.handle) : null;
  const claimable = t.kind === "user" && !claim && claimConfigured();

  const s = t.stats;
  const up = s.changePct30d >= 0;
  const changeColor = up ? "text-success" : "text-destructive";
  const rangeLow = Math.min(...t.priceDaily);
  const rangeHigh = Math.max(...t.priceDaily);
  const verdict = s.changePct30d > 25 ? "bullish" : s.changePct30d < -25 ? "bearish" : "neutral";
  const verdictCls =
    verdict === "bullish"
      ? "border-success/30 bg-success/10 text-success"
      : verdict === "bearish"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-line text-muted-foreground";

  const stats: { label: string; value: string; accent?: string }[] = [
    { label: "Mkt Cap", value: `$${(s.marketCap / 1000).toFixed(1)}K` },
    { label: "Commits 52w", value: s.totalLastYear.toLocaleString() },
    { label: "Peak week", value: `${s.peakWeek}` },
    { label: "Busiest day", value: `${s.busiestDay}` },
    { label: "Active days", value: `${s.activeDays}` },
    { label: "Longest streak", value: `${s.longestStreak}d` },
    t.kind === "user"
      ? { label: "Streak", value: `${s.currentStreakDays}d`, accent: s.currentStreakDays > 0 ? "text-success" : undefined }
      : { label: "Avg / wk", value: s.avgPerWeek.toString() },
    t.kind === "user"
      ? { label: "Followers", value: s.followers.toLocaleString() }
      : { label: "Stars", value: s.followers.toLocaleString() },
  ];

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        {/* hero header */}
        <Panel>
          <div className="flex items-start justify-between gap-3 px-4 py-5 sm:gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              {t.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="size-11 shrink-0 rounded-md border border-line sm:size-14" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h1 className="truncate font-mono text-lg font-bold tracking-tight text-foreground sm:text-2xl">{t.symbol}</h1>
                  <span className="hidden shrink-0 rounded border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                    {t.kind}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <a href={t.url} target="_blank" className="block truncate font-mono text-xs text-muted-foreground hover:text-foreground sm:text-sm">
                    {t.handle}
                  </a>
                  {t.kind === "user" && (
                    <Link href={`/${t.handle}/live`} className="flex shrink-0 items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success hover:bg-success/20">
                      <span className="size-1 animate-pulse rounded-full bg-success" />
                      live
                    </Link>
                  )}
                  {claim && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sky-500"
                      title={`Verified owner — claimed ${new Date(claim.verifiedAt).toLocaleDateString()}`}
                    >
                      ✓ verified
                    </span>
                  )}
                  {claimable && (
                    <Link
                      href={`/claim?handle=${encodeURIComponent(t.handle)}`}
                      className="flex shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      title="Own this GitHub account? Verify your ticker."
                    >
                      claim
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                {s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`font-mono text-xs tabular-nums sm:text-sm ${changeColor}`}>
                {up ? "▲" : "▼"} {Math.abs(s.changePct30d)}% <span className="text-muted-foreground">30d</span>
              </div>
            </div>
          </div>
          <div className="screen-line-top px-4 py-3">
            <RangeBar low={rangeLow} high={rangeHigh} current={s.price} label="1Y" />
          </div>
        </Panel>

        {/* chart */}
        <Panel>
          <ChartSection handle={t.handle} kind={t.kind} initial={{ days: t.days, priceDaily: t.priceDaily }} />
          <div className="screen-line-top flex justify-end px-4 py-3">
            <ShareButton handle={t.handle} symbol={t.symbol} change={s.changePct30d} />
          </div>
        </Panel>

        <HatchSeparator />

        {/* snapshot */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Snapshot</PanelTitle>
          </PanelHeader>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {stats.map((st) => (
              <StatCell key={st.label} label={st.label} value={st.value} accent={st.accent} />
            ))}
          </div>
        </Panel>

        {t.kind === "user" && <Fundamentals handle={t.handle} avgPerWeek={s.avgPerWeek} />}

        <HatchSeparator />

        {/* activity heatmap */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Activity · last year</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <ActivityHeatmap days={t.daysYear} />
          </PanelContent>
        </Panel>

        <HatchSeparator />

        {/* analyst */}
        <Panel>
          <PanelHeader className="flex items-center justify-between">
            <PanelTitle>Analyst note</PanelTitle>
            <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${verdictCls}`}>
              {verdict}
            </span>
          </PanelHeader>
          <PanelContent>
            <p className="font-mono text-sm leading-relaxed text-foreground/80">{analystBlurb(t)}</p>
          </PanelContent>
        </Panel>

        {t.kind === "user" && (
          <>
            <HatchSeparator />
            <Panel>
              <PanelHeader className="flex items-center justify-between gap-3">
                <PanelTitle>Put this on your README</PanelTitle>
                <CopyButton
                  text={`[![${t.symbol} on commits.sh](${SITE}/api/badge?handle=${encodeURIComponent(t.handle)}&style=pro)](${SITE}/${encodeURIComponent(t.handle)})`}
                />
              </PanelHeader>
              <PanelContent className="flex flex-col items-center gap-4 py-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/badge?handle=${encodeURIComponent(t.handle)}&style=pro`}
                  alt={`${t.symbol} README badge`}
                  className="max-w-full"
                  loading="lazy"
                />
                <Link
                  href={`/badges?handle=${encodeURIComponent(t.handle)}`}
                  className="font-mono text-xs text-muted-foreground link-underline hover:text-foreground"
                >
                  10 more styles → card, terminal, ticker tape, receipt…
                </Link>
              </PanelContent>
            </Panel>
          </>
        )}

        <div className="border-x border-line px-4 py-6 text-center">
          <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            ← list another ticker
          </Link>
        </div>
      </div>
    </main>
  );
}
