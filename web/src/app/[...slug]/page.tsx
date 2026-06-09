import { getUserTicker, getRepoTicker, analystBlurb, type Ticker } from "@/lib/github";
import TickerChart from "@/components/TickerChart";
import { notFound } from "next/navigation";
import Link from "next/link";

export const revalidate = 3600;

async function resolve(slug: string[]): Promise<Ticker | null> {
  if (slug.length >= 2) return getRepoTicker(slug[0], slug.slice(1).join("/"));
  return getUserTicker(slug[0]);
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-white/5 px-4 first:border-l-0 first:pl-0">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className={`font-mono text-sm ${accent ?? "text-neutral-200"}`}>{value}</span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const t = await resolve(slug);
  if (!t) notFound();

  const s = t.stats;
  const up = s.changePct30d >= 0;
  const changeColor = up ? "text-emerald-400" : "text-red-400";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8">
      {/* header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {t.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatarUrl} alt="" className="h-14 w-14 rounded-md border border-white/10" />
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-neutral-100">{t.symbol}</h1>
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
                {t.kind}
              </span>
            </div>
            <a href={t.url} target="_blank" className="font-mono text-sm text-neutral-500 hover:text-neutral-300">
              {t.handle}
            </a>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold tabular-nums text-neutral-100">
            {s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`font-mono text-sm tabular-nums ${changeColor}`}>
            {up ? "▲" : "▼"} {Math.abs(s.changePct30d)}% <span className="text-neutral-600">30d</span>
          </div>
        </div>
      </div>

      {/* chart */}
      <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0b0f0e]">
        <TickerChart candles={t.candles} volume={t.volume} up={up} />
      </div>

      {/* stats */}
      <div className="mt-5 flex flex-wrap gap-y-4 rounded-lg border border-white/5 bg-white/[0.015] p-4">
        <Stat label="Mkt Cap" value={`$${(s.marketCap / 1000).toFixed(1)}K`} />
        <Stat label="Commits 52w" value={s.totalLastYear.toLocaleString()} />
        <Stat label="Peak Week" value={`${s.peakWeek}`} />
        {t.kind === "user" ? (
          <>
            <Stat label="Streak" value={`${s.currentStreakDays}d`} accent={s.currentStreakDays > 0 ? "text-emerald-400" : undefined} />
            <Stat label="Followers" value={s.followers.toLocaleString()} />
          </>
        ) : (
          <Stat label="Stars" value={s.followers.toLocaleString()} />
        )}
        <Stat label="30d" value={`${up ? "+" : ""}${s.changePct30d}%`} accent={changeColor} />
      </div>

      {/* analyst blurb */}
      <div className="mt-5 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-4">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-amber-500/70">Analyst note</div>
        <p className="font-mono text-sm leading-relaxed text-neutral-300">{analystBlurb(t)}</p>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="font-mono text-xs text-neutral-600 hover:text-neutral-400">
          ← list another ticker
        </Link>
      </div>
    </main>
  );
}
