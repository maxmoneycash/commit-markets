// Market engine — the coherent core. Creates markets, quotes/executes LMSR
// trades against play-money wallets, and AUTO-RESOLVES from index snapshots
// (lib/resolution.ts). No human judge: a market settles by reading what the
// recorded commit-velocity index actually was at resolveAtMs.

import { resolveShipped, resolveThreshold, type Resolution } from "@/lib/resolution";
import { cost, priceYes, tradeCost } from "./lmsr";
import * as store from "./store";
import {
  DEFAULT_B,
  STARTING_BALANCE,
  type Market,
  type MarketKind,
  type Outcome,
  type Position,
  type ThresholdMetric,
  type Wallet,
} from "./types";

const uuid = () => crypto.randomUUID();

// ── Wallets ──────────────────────────────────────────────────────────────────
export async function getOrCreateWallet(id?: string): Promise<Wallet> {
  if (id) {
    const existing = await store.getWallet(id);
    if (existing) return existing;
  }
  const w: Wallet = { id: id ?? uuid(), balance: STARTING_BALANCE, createdAtMs: Date.now() };
  await store.putWallet(w);
  return w;
}

// ── Create ───────────────────────────────────────────────────────────────────
export type CreateSpec = {
  kind: MarketKind;
  handle: string;
  title: string;
  resolveAtMs: number;
  metric?: ThresholdMetric; // required for threshold
  threshold?: number; // required for threshold
  b?: number;
};

export async function createMarket(spec: CreateSpec): Promise<Market> {
  if (spec.kind === "threshold" && (spec.metric == null || spec.threshold == null)) {
    throw new Error("threshold market requires metric + threshold");
  }
  const m: Market = {
    id: uuid(),
    kind: spec.kind,
    handle: spec.handle,
    title: spec.title,
    metric: spec.metric,
    threshold: spec.threshold,
    resolveAtMs: spec.resolveAtMs,
    createdAtMs: Date.now(),
    b: spec.b ?? DEFAULT_B,
    qYes: 0,
    qNo: 0,
    status: "open",
  };
  await store.putMarket(m);
  return m;
}

// ── Quote / live view ────────────────────────────────────────────────────────
export function marketPrice(m: Market): { yes: number; no: number } {
  const yes = priceYes(m.qYes, m.qNo, m.b);
  return { yes, no: 1 - yes };
}

export function quote(m: Market, outcome: Outcome, shares: number) {
  const c = tradeCost(m.qYes, m.qNo, m.b, outcome, shares);
  const before = priceYes(m.qYes, m.qNo, m.b);
  const after =
    outcome === "YES"
      ? priceYes(m.qYes + shares, m.qNo, m.b)
      : priceYes(m.qYes, m.qNo + shares, m.b);
  return { cost: c, priceYesBefore: before, priceYesAfter: after };
}

// ── Trade ────────────────────────────────────────────────────────────────────
export class TradeError extends Error {}

export async function trade(walletId: string, marketId: string, outcome: Outcome, shares: number) {
  if (!Number.isFinite(shares) || shares === 0) throw new TradeError("shares must be a non-zero number");

  const m = await store.getMarket(marketId);
  if (!m) throw new TradeError("market not found");
  if (m.status !== "open") throw new TradeError("market is resolved");
  if (Date.now() >= m.resolveAtMs) throw new TradeError("market is past its resolution time");

  const wallet = await getOrCreateWallet(walletId);
  const pos = await store.getPosition(walletId, marketId);

  // selling: can't sell more shares than held
  if (shares < 0) {
    const held = outcome === "YES" ? pos.yes : pos.no;
    if (held < -shares) throw new TradeError(`can't sell ${-shares} ${outcome}; you hold ${held}`);
  }

  const c = tradeCost(m.qYes, m.qNo, m.b, outcome, shares);
  if (shares > 0 && c > wallet.balance + 1e-9) {
    throw new TradeError(`insufficient balance: costs ${c.toFixed(2)}, you have ${wallet.balance.toFixed(2)}`);
  }

  // apply
  wallet.balance -= c; // sell => c < 0 => balance rises
  if (outcome === "YES") m.qYes += shares;
  else m.qNo += shares;
  const next: Position = {
    walletId,
    marketId,
    yes: pos.yes + (outcome === "YES" ? shares : 0),
    no: pos.no + (outcome === "NO" ? shares : 0),
  };

  await store.putMarket(m);
  await store.putWallet(wallet);
  await store.putPosition(next);
  const t = {
    id: uuid(),
    walletId,
    marketId,
    outcome,
    shares,
    cost: c,
    priceYesAfter: priceYes(m.qYes, m.qNo, m.b),
    atMs: Date.now(),
  };
  await store.appendTrade(t);

  return { market: m, wallet, position: next, trade: t };
}

// ── Resolve (auto, from snapshots) ───────────────────────────────────────────
async function resolutionFor(m: Market): Promise<Resolution> {
  if (m.kind === "shipped") return resolveShipped(m.handle, m.resolveAtMs);
  return resolveThreshold(m.handle, m.metric!, m.threshold!, m.resolveAtMs);
}

/** Resolve one market if it's due and a snapshot exists. Pays winning shares 1:1. */
export async function resolveMarket(marketId: string): Promise<{ market: Market; status: string }> {
  const m = await store.getMarket(marketId);
  if (!m) throw new Error("market not found");
  if (m.status === "resolved") return { market: m, status: "already-resolved" };
  if (Date.now() < m.resolveAtMs) return { market: m, status: "not-due" };

  const res = await resolutionFor(m);
  if (!res.resolved || !res.outcome) return { market: m, status: `pending: ${res.reason ?? "no snapshot yet"}` };

  m.status = "resolved";
  m.outcome = res.outcome;
  m.observed = res.observed;
  m.resolvedAtMs = Date.now();
  await store.putMarket(m);

  // pay out winning shares (1 play-money each)
  for (const wid of await store.holdersOf(m.id)) {
    const pos = await store.getPosition(wid, m.id);
    const winShares = res.outcome === "YES" ? pos.yes : pos.no;
    if (winShares > 0) {
      const w = await store.getWallet(wid);
      if (w) {
        w.balance += winShares;
        await store.putWallet(w);
      }
    }
  }
  return { market: m, status: "resolved" };
}

/** Resolve every due, open market. For the cron. */
export async function resolveAllDue(): Promise<{ id: string; status: string }[]> {
  const out: { id: string; status: string }[] = [];
  for (const m of await store.listMarkets()) {
    if (m.status === "open" && Date.now() >= m.resolveAtMs) {
      const r = await resolveMarket(m.id);
      out.push({ id: m.id, status: r.status });
    }
  }
  return out;
}

// re-export for routes
export { cost };
