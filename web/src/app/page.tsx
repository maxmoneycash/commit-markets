import { getUserSummary, type UserSummary } from "@/lib/github";
import { SearchBox } from "@/components/SearchBox";
import { TickerCard } from "@/components/TickerCard";
import { Panel, PanelHeader, PanelTitle } from "@/components/panel";

export const revalidate = 3600;

// Curated board of notable accounts (the "listed" market until real listings exist).
const BOARD = [
  "torvalds", "antirez", "sindresorhus", "gaearon", "tj", "yyx990803",
  "kentcdodds", "ThePrimeagen", "mitchellh", "addyosmani", "leerob", "rauchg",
  "shadcn", "t3dotgg", "jdalton", "maxmoneycash",
];

export default async function Home() {
  const settled = await Promise.all(BOARD.map((h) => getUserSummary(h)));
  const board = settled.filter((s): s is UserSummary => s !== null);
  const movers = [...board].sort((a, b) => b.changePct30d - a.changePct30d);
  const active = [...board].sort((a, b) => b.totalLastYear - a.totalLastYear);

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        {/* hero */}
        <Panel className="px-4 py-10 text-center sm:py-14">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">commits.sh</div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
            The GitHub Stock Exchange
          </h1>
          <p className="mx-auto mt-3 max-w-md font-mono text-sm text-muted-foreground">
            Every dev is a stock. Every repo is a ticker. Trade the tape of code.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <SearchBox />
          </div>
        </Panel>

        {/* top movers */}
        <Panel>
          <PanelHeader className="flex items-center justify-between">
            <PanelTitle>Top movers · 30d</PanelTitle>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{board.length} listed</span>
          </PanelHeader>
          <div className="divide-y divide-line">
            {movers.map((s, i) => (
              <TickerCard key={s.handle} s={s} rank={i + 1} />
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
              <TickerCard key={s.handle} s={s} rank={i + 1} />
            ))}
          </div>
        </Panel>

        <div className="border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          play money · not financial advice
        </div>
      </div>
    </main>
  );
}
