// Logarithmic Market Scoring Rule (Hanson 2003) — the automated market maker
// for a binary (YES/NO) prediction market. Chosen over an order book because
// commits.sh will have MANY thin markets (one per dev/event); LMSR always
// quotes a live price and provides instant liquidity with no counterparty.
//
//   cost(qYes,qNo)  = b · ln(e^(qYes/b) + e^(qNo/b))        — the maker's scoring
//   priceYes        = e^(qYes/b) / (e^(qYes/b)+e^(qNo/b))   — = implied probability
//   buy Δ of YES    = cost(qYes+Δ,qNo) − cost(qYes,qNo)     — what the trader pays
//
// `b` is the liquidity parameter: larger b = deeper market (more shares to move
// the odds) and larger max maker subsidy of b·ln2 (which, being play-money, is free).
// All math is log-sum-exp stabilized so large q never overflows.

export function cost(qYes: number, qNo: number, b: number): number {
  const a = qYes / b;
  const c = qNo / b;
  const m = Math.max(a, c);
  return b * (m + Math.log(Math.exp(a - m) + Math.exp(c - m)));
}

/** Implied probability of YES, in (0,1). */
export function priceYes(qYes: number, qNo: number, b: number): number {
  const a = qYes / b;
  const c = qNo / b;
  const m = Math.max(a, c);
  const ea = Math.exp(a - m);
  const ec = Math.exp(c - m);
  return ea / (ea + ec);
}

export function priceNo(qYes: number, qNo: number, b: number): number {
  return 1 - priceYes(qYes, qNo, b);
}

/**
 * Play-money cost to trade `shares` of `outcome`.
 * shares > 0 = buy (returns a positive cost the trader pays);
 * shares < 0 = sell (returns a negative number = play-money returned).
 */
export function tradeCost(
  qYes: number,
  qNo: number,
  b: number,
  outcome: "YES" | "NO",
  shares: number,
): number {
  const before = cost(qYes, qNo, b);
  const after =
    outcome === "YES" ? cost(qYes + shares, qNo, b) : cost(qYes, qNo + shares, b);
  return after - before;
}

/** Upper bound on the maker's loss for a binary market (play-money subsidy). */
export function maxSubsidy(b: number): number {
  return b * Math.log(2);
}
