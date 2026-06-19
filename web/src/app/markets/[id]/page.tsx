import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HatchSeparator } from "@/components/HatchSeparator";
import { ProbChart } from "@/components/market/ProbChart";
import { TradePanel } from "@/components/market/TradePanel";
import { Panel } from "@/components/panel";
import { marketPrice } from "@/lib/market/engine";
import { getMarket, getPosition, listTrades } from "@/lib/market/store";
import { currentWalletId } from "@/lib/market/wallet-cookie";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = await getMarket(id);
  return { title: m ? `${m.title} — commit-markets` : "Market — commit-markets" };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span className="text-muted-foreground">
      {label} <span className={`tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
    </span>
  );
}

export default async function MarketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMarket(id);
  if (!m) notFound();

  const wid = await currentWalletId();
  const position = wid ? await getPosition(wid, id) : { walletId: "", marketId: id, yes: 0, no: 0 };
  const trades = (await listTrades(id)).sort((a, b) => a.atMs - b.atMs);
  const yes = Math.round(marketPrice(m).yes * 100);
  const points = [0.5, ...trades.map((t) => t.priceYesAfter)];
  const resolved = m.status === "resolved";
  const lean = yes >= 50;
  const drift = yes - 50;
  const volume = trades.reduce((s, t) => s + Math.abs(t.cost), 0);
  const spec = m.kind === "threshold" && m.metric ? `${m.metric} ≥ ${m.threshold}` : "ships / week";

  return (
    <main className="px-2">
      <div className="mx-auto max-w-2xl">
        {/* one panel: identity → chart → trade */}
        <Panel>
          <div className="flex items-start gap-3.5 px-4 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://github.com/${m.handle}.png?size=120`} alt="" className="size-12 shrink-0 rounded-md border border-line sm:size-14" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/${m.handle}`} className="truncate font-mono text-sm font-bold tracking-tight text-foreground hover:text-amber">
                  ${m.handle.toUpperCase()}
                </Link>
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{m.kind}</span>
                {resolved ? (
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${m.outcome === "YES" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {m.outcome} · {m.observed}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
                    <span className="size-1 animate-pulse rounded-full bg-success" /> open
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 font-mono text-lg font-semibold leading-snug tracking-tight text-foreground text-balance">{m.title}</h1>
            </div>
            <div className="shrink-0 text-right">
              <div className={`font-mono text-3xl font-bold tabular-nums leading-none ${lean ? "text-success" : "text-destructive"}`}>
                {yes}<span className="text-xl">%</span>
              </div>
              <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">{drift >= 0 ? "▲" : "▼"} {Math.abs(drift)} vs open</div>
            </div>
          </div>

          <div className="screen-line-top">
            <ProbChart points={points} />
          </div>

          <div className="screen-line-top">
            <TradePanel marketId={m.id} qYes={m.qYes} qNo={m.qNo} b={m.b} resolved={resolved} initialPosition={{ yes: position.yes, no: position.no }} />
          </div>
        </Panel>

        <HatchSeparator />

        {/* inline stat strip — no boxed cells */}
        <div className="screen-line-bottom border-x border-line px-4 py-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px]">
            <Stat label="Vol" value={`${volume.toFixed(0)} $CMKT`} />
            <Stat label="Trades" value={`${trades.length}`} />
            <Stat label="Liquidity" value={`${m.b}`} />
            <Stat label={resolved ? "Resolved" : "Resolves"} value={new Date(m.resolveAtMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <Stat label="Spec" value={spec} />
            <Stat label="You" value={`${position.yes}/${position.no}`} accent={position.yes || position.no ? "text-foreground" : "text-muted-foreground"} />
          </div>
        </div>

        <HatchSeparator />

        {/* order flow */}
        <div className="border-x border-line">
          <div className="screen-line-bottom px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Order flow</div>
          {trades.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">No trades yet — be first.</div>
          ) : (
            <div className="divide-y divide-line">
              {[...trades].reverse().slice(0, 25).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2 font-mono text-xs tabular-nums">
                  <span className={t.outcome === "YES" ? "text-success" : "text-destructive"}>
                    {t.shares >= 0 ? "buy" : "sell"} {Math.abs(t.shares)} {t.outcome}
                  </span>
                  <span className="text-muted-foreground">
                    {t.cost >= 0 ? "−" : "+"}{Math.abs(t.cost).toFixed(1)} → {Math.round(t.priceYesAfter * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-x border-line px-4 py-6 text-center">
          <Link href="/markets" className="font-mono text-xs text-muted-foreground link-underline hover:text-foreground">← all markets</Link>
        </div>
      </div>
    </main>
  );
}
