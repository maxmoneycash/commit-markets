// Anti-bot / "constant push" detector for the leaderboard.
//
// Real humans ship in BURSTS: some days nothing, some days 30 commits, weekend
// dips, vacation gaps. Commit-graph farmers and cron bots push a near-constant
// number EVERY day — a flat green wall. We flag the flat ones from the daily
// 52-week series (already fetched for the ticker, so this is free) plus obvious
// bot logins. Thresholds are deliberately conservative to avoid nuking genuine
// prolific humans (who are always bursty).
import type { Day } from "@/lib/github";

export type PatternFlag = {
  flagged: boolean;
  reason: string;
  activeRatio: number; // share of days with >=1 commit
  cv: number; // coefficient of variation of active-day counts (burstiness)
  modeFraction: number; // share of active days sharing the single most common count
  weekendRatio: number; // weekend mean / weekday mean (humans < 1)
  perActiveDay: number; // mean commits on days that had any (volume sanity)
};

// No human hand-authors this many commits per working day, sustained for a year.
// Above it = agents/CI/squash-free automation inflating the count.
const MAX_HUMAN_PER_ACTIVE_DAY = 120;

const BOT_LOGIN =
  /\[bot\]$|(^|[-_])bot([-_]|$)|dependa|renovate|github-?actions|greenkeeper|snyk|semantic-release|allcontributors|imgbot|netlify|vercel\[bot\]/i;

export function commitPatternFlag(login: string, days: Day[]): PatternFlag {
  const counts = days.map((d) => d.commits);
  const n = counts.length || 1;
  const active = counts.filter((c) => c > 0);
  const activeRatio = active.length / n;

  const mean = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
  const variance = active.length ? active.reduce((a, b) => a + (b - mean) ** 2, 0) / active.length : 0;
  const cv = mean ? Math.sqrt(variance) / mean : 0;

  const freq = new Map<number, number>();
  for (const c of active) freq.set(c, (freq.get(c) ?? 0) + 1);
  let modeCount = 0;
  for (const v of freq.values()) modeCount = Math.max(modeCount, v);
  const modeFraction = active.length ? modeCount / active.length : 0;

  let weSum = 0, weDays = 0, wdSum = 0, wdDays = 0;
  for (const d of days) {
    const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) { weSum += d.commits; weDays++; }
    else { wdSum += d.commits; wdDays++; }
  }
  const weMean = weDays ? weSum / weDays : 0;
  const wdMean = wdDays ? wdSum / wdDays : 0;
  const weekendRatio = wdMean ? weMean / wdMean : 1;

  let flagged = false, reason = "";
  if (BOT_LOGIN.test(login)) {
    flagged = true; reason = "automated/bot account";
  } else if (mean > MAX_HUMAN_PER_ACTIVE_DAY) {
    flagged = true; reason = `implausible volume — ~${Math.round(mean)} commits per active day (agent/automation)`;
  } else if (activeRatio >= 0.96 && cv < 0.55) {
    flagged = true; reason = "commits almost every day with near-constant volume (automated cadence)";
  } else if (active.length >= 80 && modeFraction >= 0.55) {
    flagged = true; reason = "identical commit count on most active days (scripted)";
  } else if (activeRatio >= 0.99 && weekendRatio > 0.9 && cv < 0.8) {
    flagged = true; reason = "no off-days or weekend dip (constant push)";
  }

  return { flagged, reason, activeRatio, cv, modeFraction, weekendRatio, perActiveDay: mean };
}
