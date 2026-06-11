import { getUserTicker, getRepoTicker, analystBlurb, type Ticker } from "@/lib/github";
import PriceChart from "@/components/PriceChart";
import ShareButton from "@/components/ShareButton";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { Panel, PanelHeader, PanelTitle, PanelContent } from "@/components/panel";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600;

async function resolve(slug: string[], years = 1): Promise<Ticker | null> {
  if (slug.length >= 2) return getRepoTicker(slug[0], slug.slice(1).join("/"));
  return getUserTicker(slug[0], years);
}

const RANGES: { v: string; label: string; years: number }[] = [
  { v: "1y", label: "1Y", years: 1 },
  { v: "2y", label: "2Y", years: 2 },
  { v: "3y", label: "3Y", years: 3 },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const handle = slug.join("/");
  const t = await resolve(slug);
  if (!t) return { title: "ticker not found — commit-markets" };
  const title = `${t.symbol} — commit-markets`;
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

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const range = RANGES.find((r) => r.v === sp.range) ?? RANGES[0];
  const t = await resolve(slug, range.years);
  if (!t) notFound();

  const s = t.stats;
  const up = s.changePct30d >= 0;
  const changeColor = up ? "text-success" : "text-destructive";

  const stats: { label: string; value: string; accent?: string }[] = [
    { label: "Mkt Cap", value: `$${(s.marketCap / 1000).toFixed(1)}K` },
    { label: "Commits 52w", value: s.totalLastYear.toLocaleString() },
    { label: "Avg / wk", value: s.avgPerWeek.toString() },
    { label: "Peak week", value: `${s.peakWeek}` },
    { label: "Active days", value: `${s.activeDays}` },
    { label: "Longest streak", value: `${s.longestStreak}d` },
    t.kind === "user"
      ? { label: "Streak", value: `${s.currentStreakDays}d`, accent: s.currentStreakDays > 0 ? "text-success" : undefined }
      : { label: "Busiest day", value: `${s.busiestDay}` },
    t.kind === "user"
      ? { label: "Followers", value: s.followers.toLocaleString() }
      : { label: "Stars", value: s.followers.toLocaleString() },
  ];

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        {/* hero header */}
        <Panel>
          <div className="flex items-start justify-between gap-4 px-4 py-5">
            <div className="flex items-center gap-4">
              {t.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="size-14 rounded-md border border-line" />
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">{t.symbol}</h1>
                  <span className="rounded border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.kind}
                  </span>
                </div>
                <a href={t.url} target="_blank" className="font-mono text-sm text-muted-foreground hover:text-foreground">
                  {t.handle}
                </a>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
                {s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`font-mono text-sm tabular-nums ${changeColor}`}>
                {up ? "▲" : "▼"} {Math.abs(s.changePct30d)}% <span className="text-muted-foreground">30d</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* chart */}
        <Panel>
          <PanelHeader className="flex items-center justify-between">
            <PanelTitle>Velocity · {range.label}</PanelTitle>
            {t.kind === "user" ? (
              <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                {RANGES.map((r) => (
                  <Link
                    key={r.v}
                    href={`/${t.handle}?range=${r.v}`}
                    scroll={false}
                    className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      r.v === range.v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">52W</span>
            )}
          </PanelHeader>
          <div className="px-2 py-2">
            <PriceChart days={t.days} priceDaily={t.priceDaily} />
          </div>
          <div className="screen-line-top flex justify-end px-4 py-3">
            <ShareButton handle={t.handle} symbol={t.symbol} change={s.changePct30d} />
          </div>
        </Panel>

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

        {/* activity heatmap */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Activity · last year</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <ActivityHeatmap days={t.days} />
          </PanelContent>
        </Panel>

        {/* analyst */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Analyst note</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="font-mono text-sm leading-relaxed text-foreground/80">{analystBlurb(t)}</p>
          </PanelContent>
        </Panel>

        <div className="border-x border-line px-4 py-6 text-center">
          <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            ← list another ticker
          </Link>
        </div>
      </div>
    </main>
  );
}
