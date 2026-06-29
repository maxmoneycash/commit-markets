import Link from "next/link";
import type { Metadata } from "next";
import { searchTopCommitters } from "@/lib/github";
import { Panel } from "@/components/panel";
import { HatchSeparator } from "@/components/HatchSeparator";

export const metadata: Metadata = {
  title: "Leaderboard — commits.sh",
  description: "The most committed humans on GitHub, ranked by commit velocity. Bots and constant-push commit farms removed.",
};

// Heavy (scores ~90 accounts); cache for an hour and regenerate in the background.
export const revalidate = 3600;
export const maxDuration = 60;

export default async function LeaderboardPage() {
  const ranked = await searchTopCommitters({ minCommits: 1000 });
  const filtered = ranked.filter((c) => c.flagged).length;
  const rows = ranked.filter((c) => !c.flagged).slice(0, 50);

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        <Panel className="px-4 py-10 text-center">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">leaderboard</div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
            The most committed humans on GitHub
          </h1>
          <p className="mx-auto mt-3 max-w-md font-mono text-sm text-muted-foreground">
            Ranked by commit velocity over the last 52 weeks. Bots and constant-push commit farms are filtered out — only real, bursty human shipping.
          </p>
        </Panel>

        <HatchSeparator />

        <Panel>
          <div className="divide-y divide-line">
            {rows.map((c, i) => (
              <Link
                key={c.login}
                href={`/${c.login}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="size-8 shrink-0 rounded-md border border-line" loading="lazy" />
                ) : (
                  <div className="size-8 shrink-0 rounded-md border border-line bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-semibold text-foreground">${c.login.toUpperCase()}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{c.name || c.login}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm tabular-nums text-foreground">{c.totalLastYear.toLocaleString()}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">commits 52w</div>
                </div>
                <div className="hidden w-20 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground sm:block">
                  {c.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          {filtered} bot / constant-push account{filtered === 1 ? "" : "s"} filtered out · ranking refreshes hourly
        </div>
      </div>
    </main>
  );
}
