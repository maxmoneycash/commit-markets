// Prediction-market domain types. A Market is a question about a tracked
// account's future commit activity that AUTO-RESOLVES from the index snapshots
// (see lib/resolution.ts) — no human judge. Play-money only.

export type Outcome = "YES" | "NO";

// What is being asked. Both resolve purely from recorded snapshots.
export type MarketKind =
  | "threshold" // "will <metric> reach <threshold> by resolveAt?"
  | "shipped"; // "will <handle> ship (any commits in the trailing week) by resolveAt?"

export type ThresholdMetric = "total7d" | "total30d" | "totalYear" | "price";

export type Market = {
  id: string;
  kind: MarketKind;
  handle: string; // the GitHub account the market is about
  title: string; // human-readable question

  // resolution spec (consumed by lib/resolution.ts at resolveAtMs)
  metric?: ThresholdMetric; // threshold markets only
  threshold?: number; // threshold markets only
  resolveAtMs: number; // when the market settles
  createdAtMs: number;

  // LMSR state
  b: number; // liquidity parameter
  qYes: number; // outstanding YES shares
  qNo: number; // outstanding NO shares

  // lifecycle
  status: "open" | "resolved";
  outcome?: Outcome; // set on resolution
  observed?: number; // the metric value observed at resolution
  resolvedAtMs?: number;
};

export type Wallet = {
  id: string;
  balance: number; // play-money ($CMKT)
  createdAtMs: number;
};

export type Position = {
  walletId: string;
  marketId: string;
  yes: number; // YES shares held
  no: number; // NO shares held
};

export type Trade = {
  id: string;
  walletId: string;
  marketId: string;
  outcome: Outcome;
  shares: number; // + buy / − sell
  cost: number; // play-money delta (> 0 paid, < 0 received)
  priceYesAfter: number; // implied YES probability after the trade
  atMs: number;
};

export const STARTING_BALANCE = 1000; // play-money granted to a new wallet
export const DEFAULT_B = 100; // default LMSR liquidity for a new market
