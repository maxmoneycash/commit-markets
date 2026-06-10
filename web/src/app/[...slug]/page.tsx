import { getUserTicker, getRepoTicker, analystBlurb, type Ticker } from "@/lib/github";
import CandleChart from "@/components/CandleChart";
import ShareButton from "@/components/ShareButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600;

async function resolve(slug: string[]): Promise<Ticker | null> {
  if (slug.length >= 2) return getRepoTicker(slug[0], slug.slice(1).join("/"));
  return getUserTicker(slug[0]);
}

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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-line px-4 first:border-l-0 first:pl-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const t = await resolve(slug);
  if (!t) notFound();

  const s = t.stats;
  const up = s.changePct30d >= 0;
  const changeColor = up ? "text-success" : "text-destructive";

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl border-x border-line">
        {/* header */}
        <div className="screen-line-bottom flex items-start justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-4">
            {t.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.avatarUrl} alt="" className="size-14 rounded-md border border-line" />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">{t.symbol}</h1>
                <span className="rounded border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
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

        {/* chart */}
        <div className="screen-line-bottom px-2 py-2">
          <CandleChart candles={t.candles} volume={t.volume} />
        </div>

        {/* share */}
        <div className="screen-line-bottom flex justify-end px-4 py-3">
          <ShareButton handle={t.handle} symbol={t.symbol} change={s.changePct30d} />
        </div>

        {/* stats */}
        <div className="screen-line-bottom flex flex-wrap gap-y-4 px-4 py-4">
          <Stat label="Mkt Cap" value={`$${(s.marketCap / 1000).toFixed(1)}K`} />
          <Stat label="Commits 52w" value={s.totalLastYear.toLocaleString()} />
          <Stat label="Peak Week" value={`${s.peakWeek}`} />
          {t.kind === "user" ? (
            <>
              <Stat label="Streak" value={`${s.currentStreakDays}d`} accent={s.currentStreakDays > 0 ? "text-success" : undefined} />
              <Stat label="Followers" value={s.followers.toLocaleString()} />
            </>
          ) : (
            <Stat label="Stars" value={s.followers.toLocaleString()} />
          )}
          <Stat label="30d" value={`${up ? "+" : ""}${s.changePct30d}%`} accent={changeColor} />
        </div>

        {/* analyst blurb */}
        <div className="screen-line-bottom px-4 py-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Analyst note</div>
          <p className="font-mono text-sm leading-relaxed text-foreground/80">{analystBlurb(t)}</p>
        </div>

        <div className="px-4 py-6 text-center">
          <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            ← list another ticker
          </Link>
        </div>
      </div>
    </main>
  );
}
