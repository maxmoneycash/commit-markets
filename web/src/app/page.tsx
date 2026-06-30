import Link from "next/link";
import { getUserSummary, type UserSummary } from "@/lib/github";
import { getClaim } from "@/lib/claims";
import { buildLiveBoard } from "@/lib/live";
import { SearchBox } from "@/components/SearchBox";
import { TickerCard } from "@/components/TickerCard";
import { LiveBoard } from "@/components/LiveBoard";
import { Panel, PanelHeader, PanelTitle } from "@/components/panel";

export const revalidate = 3600;

// Curated board of notable accounts (the "listed" market until real listings exist).
const BOARD = [
  "torvalds", "antirez", "sindresorhus", "gaearon", "tj", "yyx990803",
  "kentcdodds", "ThePrimeagen", "mitchellh", "addyosmani", "leerob", "rauchg",
  "shadcn", "t3dotgg", "jdalton", "maxmoneycash",
];

export default async function Home() {
  const [settled, live] = await Promise.all([
    Promise.all(BOARD.map((h) => getUserSummary(h))),
    buildLiveBoard(6),
  ]);
  const board = settled.filter((s): s is UserSummary => s !== null);
  const movers = [...board].sort((a, b) => b.changePct30d - a.changePct30d);
  const active = [...board].sort((a, b) => b.totalLastYear - a.totalLastYear);

  // Which listed accounts have verified ownership (cheap Redis reads).
  const claimedPairs = await Promise.all(
    board.map(async (s) => [s.handle.toLowerCase(), Boolean(await getClaim(s.handle))] as const),
  );
  const claimed = new Set(claimedPairs.filter(([, c]) => c).map(([h]) => h));
  const isVerified = (s: UserSummary) => claimed.has(s.handle.toLowerCase());

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        {/* hero */}
        <Panel className="px-4 py-10 text-center sm:py-14">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">proof of work</div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
            Get noticed for the work you ship.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty font-mono text-sm leading-relaxed text-muted-foreground">
            You commit every day — but it&apos;s buried in a wall of green squares. commits.sh ranks your GitHub
            shipping and turns it into a profile worth showing off. Where do you land?
          </p>
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3">
            <div className="w-full">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-success">
                see your dev rank — type your handle
              </div>
              <SearchBox />
            </div>
            <Link
              href="/claim"
              className="font-mono text-xs text-muted-foreground underline decoration-muted-foreground/30 underline-offset-2 hover:text-foreground"
            >
              already know yours? claim your $TICKER →
            </Link>
          </div>
        </Panel>

        {/* live — shipping right now */}
        <LiveBoard initial={live} />

        {/* top movers */}
        <Panel>
          <PanelHeader className="flex items-center justify-between">
            <PanelTitle>Top movers · 30d</PanelTitle>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{board.length} profiles</span>
          </PanelHeader>
          <div className="divide-y divide-line">
            {movers.map((s, i) => (
              <TickerCard key={s.handle} s={s} rank={i + 1} verified={isVerified(s)} />
            ))}
          </div>
        </Panel>

        {/* most active */}
        <Panel>
          <PanelHeader>
            <PanelTitle>Most active · 52w</PanelTitle>
          </PanelHeader>
          <div className="divide-y divide-line">
            {active.slice(0, 8).map((s, i) => (
              <TickerCard key={s.handle} s={s} rank={i + 1} verified={isVerified(s)} />
            ))}
          </div>
        </Panel>

        {/* claim CTA strip */}
        <Link
          href="/claim"
          className="block border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/40"
        >
          That&apos;s your work up there — <span className="text-sky-500">claim your ticker</span> to get the verified ✓ →
        </Link>
      </div>
    </main>
  );
}
