// GitHub data layer — turns a handle's commit activity into a velocity-based
// candle series + stock-style stats, via the GitHub API (no cloning).
//
// User charts come from the GraphQL contributions calendar (daily commit counts
// = velocity). Repo charts come from REST commit_activity (52 weekly counts).

import { commitPatternFlag } from "@/lib/antibot";

const GQL = "https://api.github.com/graphql";
const REST = "https://api.github.com";

export type Candle = {
  time: string; // YYYY-MM-DD (week start)
  open: number;
  high: number;
  low: number;
  close: number;
};
export type VolumeBar = { time: string; value: number; color: string };

export type Day = { date: string; commits: number };

export type Ticker = {
  kind: "user" | "repo";
  handle: string; // torvalds  |  vercel/next.js
  symbol: string; // $TORVALDS
  name: string;
  avatarUrl: string | null;
  url: string;
  candles: Candle[];
  volume: VolumeBar[];
  days: Day[]; // daily commit counts for the chart range
  daysYear: Day[]; // last ~year, Sunday-aligned (for the contribution graph)
  priceDaily: number[]; // daily EWMA momentum, aligned with days (for the chart)
  stats: {
    price: number; // latest momentum value (cosmetic "$")
    changePct30d: number;
    totalLastYear: number; // commits/contributions last 52w
    peakWeek: number; // busiest week (commits)
    currentStreakDays: number; // user only; 0 for repo
    longestStreak: number; // longest run of active days
    activeDays: number; // days with >=1 commit
    avgPerWeek: number; // mean commits/week
    busiestDay: number; // most commits in a single day
    followers: number; // user only
    contributors: number; // repo only
    marketCap: number; // fun, derived
  };
};

// Derived activity metrics from a daily series.
function dayStats(days: Day[]) {
  let longest = 0;
  let run = 0;
  let active = 0;
  let busiest = 0;
  for (const d of days) {
    if (d.commits > 0) {
      run++;
      active++;
      if (run > longest) longest = run;
      if (d.commits > busiest) busiest = d.commits;
    } else {
      run = 0;
    }
  }
  const total = days.reduce((s, d) => s + d.commits, 0);
  const weeks = Math.max(1, days.length / 7);
  return { longestStreak: longest, activeDays: active, busiestDay: busiest, avgPerWeek: +(total / weeks).toFixed(1) };
}

const GREEN = "rgba(38,166,154,0.5)";
const RED = "rgba(239,83,80,0.5)";

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set");
  return t;
}

// EWMA of a daily commit series -> a smooth, trending "price" line that rises
// while shipping and decays when idle. This is the velocity index, chart-ready.
function momentum(daily: number[], alpha = 0.25, scale = 100): number[] {
  let m = 0;
  return daily.map((d) => {
    m = alpha * d + (1 - alpha) * m;
    return +(m * scale).toFixed(2);
  });
}

// Group a daily [{date,value}] series into weekly OHLC candles of the momentum
// line, with weekly raw-commit volume.
function toWeekly(
  days: { date: string; commits: number }[],
): { candles: Candle[]; volume: VolumeBar[]; price: number[] } {
  const price = momentum(days.map((d) => d.commits));
  const candles: Candle[] = [];
  const volume: VolumeBar[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const p = price.slice(i, i + 7);
    if (!chunk.length) continue;
    const open = p[0];
    const close = p[p.length - 1];
    candles.push({
      time: chunk[0].date,
      open,
      close,
      high: Math.max(...p),
      low: Math.min(...p),
    });
    volume.push({
      time: chunk[0].date,
      value: chunk.reduce((s, d) => s + d.commits, 0),
      color: close >= open ? GREEN : RED,
    });
  }
  return { candles, volume, price };
}

function pct(now: number, then: number): number {
  if (!then) return 0;
  return +(((now - then) / then) * 100).toFixed(1);
}

export type Range = "1m" | "1y" | "max";

export async function getUserTicker(login: string, range: Range = "1y"): Promise<Ticker | null> {
  const headers = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };

  // How many yearly windows to fetch (the contributions API caps at 1yr/query).
  let yearsToFetch = 1;
  if (range === "max") {
    const cr = await fetch(GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: `query($login:String!){user(login:$login){createdAt}}`, variables: { login } }),
      next: { revalidate: 86400 },
    });
    if (cr.ok) {
      const created = (await cr.json())?.data?.user?.createdAt;
      if (created) {
        const cy = new Date(created).getUTCFullYear();
        const ny = new Date().getUTCFullYear();
        yearsToFetch = Math.min(16, Math.max(1, ny - cy + 1));
      }
    }
  }

  const now = new Date();
  const windows: { from: string; to: string }[] = [];
  for (let k = 0; k < yearsToFetch; k++) {
    const to = new Date(now);
    to.setUTCFullYear(to.getUTCFullYear() - k);
    const from = new Date(to);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    windows.push({ from: from.toISOString(), to: to.toISOString() });
  }
  // Fetch each year window as its own request IN PARALLEL — one combined query
  // with N aliased windows serializes server-side and is very slow for MAX.
  async function fetchWindow(w: { from: string; to: string }, withMeta: boolean) {
    const meta = withMeta ? "login name avatarUrl url followers{totalCount}" : "";
    const query = `query($login:String!){ user(login:$login){ ${meta} contributionsCollection(from:"${w.from}",to:"${w.to}"){ contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`;
    const res = await fetch(GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: { login } }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json())?.data?.user ?? null;
  }
  const results = await Promise.all(windows.map((w, k) => fetchWindow(w, k === 0)));
  const u = results[0];
  if (!u) return null;

  const byDate = new Map<string, number>();
  for (const r of results) {
    const col = r?.contributionsCollection;
    if (!col) continue;
    for (const w of col.contributionCalendar.weeks) {
      for (const d of w.contributionDays) byDate.set(d.date, d.contributionCount);
    }
  }
  const allDays: Day[] = Array.from(byDate, ([date, commits]) => ({ date, commits })).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!allDays.length) return null;
  const priceAll = momentum(allDays.map((d) => d.commits));

  // chart range slice (momentum keeps full-history warmup)
  const sliceN = range === "1m" ? 31 : range === "1y" ? 365 : allDays.length;
  const days = allDays.slice(-sliceN);
  const priceDaily = priceAll.slice(-sliceN);

  // snapshot stats are always last 52w (stable, independent of chart range)
  const snap = allDays.slice(-364);
  // contribution graph: last ~year, sliced on a Sunday boundary (allDays[0] is a Sunday)
  const totalWeeks = Math.floor(allDays.length / 7);
  const daysYear = allDays.slice(Math.max(0, totalWeeks - 52) * 7);
  const { candles, volume } = toWeekly(days); // for the OG card sparkline
  const snapWeekly = toWeekly(snap);
  const ds = dayStats(snap);

  let streak = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].commits > 0) streak++;
    else break;
  }

  const total = snap.reduce((sum, d) => sum + d.commits, 0);
  const followers = u.followers.totalCount;
  const last = priceAll[priceAll.length - 1] ?? 0;
  const monthAgo = priceAll[Math.max(0, priceAll.length - 30)] ?? last;

  return {
    kind: "user",
    handle: u.login,
    symbol: `$${u.login.toUpperCase()}`,
    name: u.name || u.login,
    avatarUrl: u.avatarUrl,
    url: u.url,
    candles,
    volume,
    days,
    daysYear,
    priceDaily,
    stats: {
      price: last,
      changePct30d: pct(last, monthAgo),
      totalLastYear: total,
      peakWeek: Math.max(0, ...snapWeekly.volume.map((v) => v.value)),
      currentStreakDays: streak,
      longestStreak: ds.longestStreak,
      activeDays: ds.activeDays,
      avgPerWeek: ds.avgPerWeek,
      busiestDay: ds.busiestDay,
      followers,
      contributors: 0,
      marketCap: Math.round(total * 100 + followers * 50 + last * 1000),
    },
  };
}

export async function getRepoTicker(
  owner: string,
  repo: string,
): Promise<Ticker | null> {
  const headers = {
    Authorization: `Bearer ${token()}`,
    Accept: "application/vnd.github+json",
  };
  // /stats/commit_activity returns 52 weeks of daily commit counts.
  // It can 202 while GitHub computes; retry briefly.
  let weeks: { total: number; week: number; days: number[] }[] | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${REST}/repos/${owner}/${repo}/stats/commit_activity`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (r.status === 202) {
      await new Promise((res) => setTimeout(res, 1200));
      continue;
    }
    if (!r.ok) return null;
    weeks = await r.json();
    break;
  }
  if (!weeks || !weeks.length) return null;

  const days: { date: string; commits: number }[] = [];
  for (const w of weeks) {
    for (let i = 0; i < 7; i++) {
      const ts = (w.week + i * 86400) * 1000;
      days.push({ date: new Date(ts).toISOString().slice(0, 10), commits: w.days[i] ?? 0 });
    }
  }
  const { candles, volume, price } = toWeekly(days);

  // repo meta (stars/contributors-ish) — best effort
  let stars = 0;
  let contributors = 0;
  const meta = await fetch(`${REST}/repos/${owner}/${repo}`, { headers, next: { revalidate: 86400 } });
  if (meta.ok) {
    const m = await meta.json();
    stars = m.stargazers_count ?? 0;
  }
  const total = weeks.reduce((s, w) => s + w.total, 0);
  const last = price[price.length - 1] ?? 0;
  const monthAgo = price[Math.max(0, price.length - 30)] ?? last;
  const ds = dayStats(days);
  const priceDaily = momentum(days.map((d) => d.commits));

  return {
    kind: "repo",
    handle: `${owner}/${repo}`,
    symbol: `$${repo.toUpperCase()}`,
    name: `${owner}/${repo}`,
    avatarUrl: `https://github.com/${owner}.png`,
    url: `https://github.com/${owner}/${repo}`,
    candles,
    volume,
    days,
    daysYear: days,
    priceDaily,
    stats: {
      price: last,
      changePct30d: pct(last, monthAgo),
      totalLastYear: total,
      peakWeek: Math.max(0, ...volume.map((v) => v.value)),
      currentStreakDays: 0,
      longestStreak: ds.longestStreak,
      activeDays: ds.activeDays,
      avgPerWeek: ds.avgPerWeek,
      busiestDay: ds.busiestDay,
      followers: stars,
      contributors,
      marketCap: Math.round(total * 100 + stars * 50 + last * 1000),
    },
  };
}

// Compact card data for the discovery board.
export type UserSummary = {
  handle: string;
  symbol: string;
  name: string;
  avatarUrl: string | null;
  spark: number[]; // downsampled momentum line
  price: number;
  changePct30d: number;
  totalLastYear: number;
};

export async function getUserSummary(login: string): Promise<UserSummary | null> {
  const t = await getUserTicker(login, "1y");
  if (!t) return null;
  const p = t.priceDaily;
  const step = Math.max(1, Math.ceil(p.length / 48));
  const spark: number[] = [];
  for (let i = 0; i < p.length; i += step) spark.push(p[i]);
  if (spark[spark.length - 1] !== p[p.length - 1]) spark.push(p[p.length - 1]);
  return {
    handle: t.handle,
    symbol: t.symbol,
    name: t.name,
    avatarUrl: t.avatarUrl,
    spark,
    price: t.stats.price,
    changePct30d: t.stats.changePct30d,
    totalLastYear: t.stats.totalLastYear,
  };
}

// Recent public events for the /live activity feed.
export type GhEvent = { verb: string; repo: string; detail: string; at: string };

export async function getUserEvents(login: string): Promise<GhEvent[]> {
  const res = await fetch(`${REST}/users/${encodeURIComponent(login)}/events/public?per_page=10`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  type RawEvent = {
    type: string;
    repo?: { name?: string };
    created_at?: string;
    payload?: { commits?: unknown[]; action?: string; ref_type?: string; ref?: string | null };
  };
  const raw: RawEvent[] = await res.json();
  return raw.slice(0, 8).map((e) => {
    const repo = e.repo?.name ?? "";
    const at = e.created_at ?? "";
    const p = e.payload ?? {};
    switch (e.type) {
      case "PushEvent":
        return { verb: "PUSH", repo, detail: `${p.commits?.length ?? 0} commit${(p.commits?.length ?? 0) === 1 ? "" : "s"}`, at };
      case "PullRequestEvent":
        return { verb: "PR", repo, detail: p.action ?? "", at };
      case "IssuesEvent":
        return { verb: "ISSUE", repo, detail: p.action ?? "", at };
      case "WatchEvent":
        return { verb: "STAR", repo, detail: "starred", at };
      case "CreateEvent":
        return { verb: "CREATE", repo, detail: p.ref_type ?? "", at };
      case "ForkEvent":
        return { verb: "FORK", repo, detail: "forked", at };
      case "ReleaseEvent":
        return { verb: "RELEASE", repo, detail: p.action ?? "", at };
      default:
        return { verb: e.type.replace("Event", "").toUpperCase().slice(0, 8), repo, detail: "", at };
    }
  });
}

// ── Discovery: search GitHub for the highest-output accounts ──────────────────
// GitHub's user-search API CANNOT sort by commit count, so we cast a wide net
// with the queryable proxies (followers / repos) then RANK locally by our own
// commit index (totalLastYear from the contributions calendar). Bots + humans
// are both included — no filtering on account type.

export type Candidate = {
  login: string;
  name: string;
  avatarUrl: string | null;
  followers: number;
  totalLastYear: number; // commits last 52w — the ranking key
  price: number;
  changePct30d: number;
  flagged: boolean; // bot / constant-push pattern (excluded from the leaderboard)
  flagReason: string;
};

// One page-bounded GitHub user search, returning logins (followers-sorted).
async function searchLogins(q: string, pages: number): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(
      `${REST}/search/users?q=${encodeURIComponent(q)}&sort=followers&order=desc&per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" }, next: { revalidate: 3600 } },
    );
    if (!res.ok) break;
    const data = await res.json();
    const items: { login: string }[] = data.items ?? [];
    for (const it of items) out.push(it.login);
    if (items.length < 100) break; // last page
  }
  return out;
}

/**
 * Find high-commit GitHub accounts. Pools candidates from several search
 * queries, scores up to `scoreLimit` of them by our commit index (one
 * contributions query each, bounded-parallel), returns ranked desc by commits.
 */
export async function searchTopCommitters(opts?: {
  queries?: string[];
  scoreLimit?: number;
  minCommits?: number;
}): Promise<Candidate[]> {
  const queries = opts?.queries ?? ["followers:>20000", "followers:>5000 repos:>50", "repos:>800"];
  const scoreLimit = opts?.scoreLimit ?? 90;
  const minCommits = opts?.minCommits ?? 0;

  // Pool unique logins across queries (each query caps at 1000 results).
  const seen = new Set<string>();
  for (const q of queries) {
    for (const login of await searchLogins(q, 3)) seen.add(login);
  }
  const candidates = [...seen].slice(0, scoreLimit);

  // Score in bounded-parallel batches — each getUserTicker = one GraphQL call.
  const scored: Candidate[] = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH);
    const rows = await Promise.all(
      chunk.map(async (login): Promise<Candidate | null> => {
        try {
          const t = await getUserTicker(login, "1y");
          if (!t) return null;
          const flag = commitPatternFlag(t.handle, t.daysYear);
          return {
            login: t.handle,
            name: t.name,
            avatarUrl: t.avatarUrl,
            followers: t.stats.followers,
            totalLastYear: t.stats.totalLastYear,
            price: t.stats.price,
            changePct30d: t.stats.changePct30d,
            flagged: flag.flagged,
            flagReason: flag.reason,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of rows) if (r && r.totalLastYear >= minCommits) scored.push(r);
  }
  scored.sort((a, b) => b.totalLastYear - a.totalLastYear);
  return scored;
}

// Templated analyst blurb from stats (Claude upgrade later).
export function analystBlurb(t: Ticker): string {
  const s = t.stats;
  const subj = t.kind === "user" ? t.name : t.handle;
  if (s.changePct30d > 25)
    return `${subj} is ripping — momentum up ${s.changePct30d}% on the month with a ${s.currentStreakDays || s.peakWeek}-${t.kind === "user" ? "day streak" : "commit peak week"}. Shippooor energy. Analysts say: bullish.`;
  if (s.changePct30d < -25)
    return `${subj} is cooling off, down ${Math.abs(s.changePct30d)}% this month. Either touching grass or cooking something off-main. Analysts say: accumulate the dip?`;
  if (s.totalLastYear > 2000)
    return `${subj} is a blue chip — ${s.totalLastYear.toLocaleString()} commits last year. Steady hands, relentless output. Analysts say: hold forever.`;
  if (s.totalLastYear < 50)
    return `${subj} is a deep-value microcap — ${s.totalLastYear} commits last year. High risk, high upside, possibly abandoned. Analysts say: lottery ticket.`;
  return `${subj}: ${s.totalLastYear.toLocaleString()} commits last year, flat on the month. Quietly compounding. Analysts say: market perform.`;
}
