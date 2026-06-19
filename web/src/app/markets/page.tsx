import type { Metadata } from "next";
import { MarketBoard, type MarketView } from "@/components/market/MarketBoard";
import { TickerTape } from "@/components/market/TickerTape";
import { marketPrice } from "@/lib/market/engine";
import { listMarkets } from "@/lib/market/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets — commit-markets",
  description: "Play-money prediction markets on GitHub commit activity. Live odds, auto-resolved from real commits.",
};

export default async function MarketsPage() {
  const open = (await listMarkets())
    .filter((m) => m.status === "open")
    .sort((a, b) => a.resolveAtMs - b.resolveAtMs);

  const markets: MarketView[] = open.map((m) => ({
    id: m.id,
    title: m.title,
    handle: m.handle,
    kind: m.kind,
    resolveAtMs: m.resolveAtMs,
    priceYes: marketPrice(m).yes,
  }));
  const tape = markets.map((m) => ({ handle: m.handle, yes: Math.round(m.priceYes * 100) }));

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        <div className="screen-line-top screen-line-bottom border-x border-line px-4 py-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-success">prediction markets</div>
          <h1 className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Bet on who ships.</h1>
          <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-muted-foreground">
            Play-money markets on GitHub commit activity. Live LMSR odds, auto-resolved from real commits.
          </p>
        </div>

        <TickerTape items={tape} />
        <MarketBoard initialMarkets={markets} />

        <div className="border-x border-line px-4 py-6 text-center font-mono text-[11px] text-muted-foreground">
          play money · not financial advice
        </div>
      </div>
    </main>
  );
}
