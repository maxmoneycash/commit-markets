// Dev rank — the flex. Turns a year of commits into a tier + percentile so a
// profile reads as "top 0.4% · S-tier" instead of a raw number. This is the
// share hook, so it has to feel right: calibrated against the de-botted
// leaderboard (real top humans ~5k–8.7k commits/52w land S/S+; typical active
// devs land mid-pack). No external population needed — a log-normal model of
// yearly commits among *active* GitHub devs (median ~300/yr, ~8k/yr ≈ 99.9th).

export type DevRank = {
  tier: "S+" | "S" | "A" | "B" | "C" | "D";
  label: string; // "S-tier"
  topPct: number; // e.g. 0.4  → "top 0.4%"
  topPctLabel: string; // "0.4%"
  percentile: number; // 0..100
  color: string; // hex, for cards/badges
  blurb: string; // short flavor
};

const MU = 2.477; // log10(300)
const SIGMA = 0.461; // → log10(8000) ≈ 99.9th percentile

// erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

export function formatTopPct(topPct: number): string {
  if (topPct < 1) return `${topPct.toFixed(1)}%`;
  if (topPct < 10) return `${topPct.toFixed(1)}%`;
  return `${Math.round(topPct)}%`;
}

export function devRank(commits52w: number): DevRank {
  const c = Math.max(commits52w, 1);
  const z = (Math.log10(c) - MU) / SIGMA;
  const percentile = Math.min(99.99, Math.max(0.1, phi(z) * 100));
  const topPct = Math.max(0.05, 100 - percentile);

  let tier: DevRank["tier"];
  let color: string;
  let blurb: string;
  if (topPct <= 0.5) {
    tier = "S+";
    color = "#ffd23f";
    blurb = "generational shipper";
  } else if (topPct <= 2) {
    tier = "S";
    color = "#39d98a";
    blurb = "elite shipper";
  } else if (topPct <= 10) {
    tier = "A";
    color = "#38bdf8";
    blurb = "prolific";
  } else if (topPct <= 30) {
    tier = "B";
    color = "#a78bfa";
    blurb = "steady shipper";
  } else if (topPct <= 60) {
    tier = "C";
    color = "#94a3b8";
    blurb = "casual committer";
  } else {
    tier = "D";
    color = "#64748b";
    blurb = "just getting started";
  }

  return {
    tier,
    label: tier === "S+" ? "S+ tier" : `${tier}-tier`,
    topPct,
    topPctLabel: formatTopPct(topPct),
    percentile,
    color,
    blurb,
  };
}
