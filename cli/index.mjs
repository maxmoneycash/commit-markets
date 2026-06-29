#!/usr/bin/env node
// commit-markets CLI — the GitHub stock exchange in your terminal.
// Hits the public API (no auth). Override host with COMMITS_API.
//
//   npx commits <handle>            quote a user (or owner/repo)
//   npx commits top [limit]         leaderboard by commit velocity
//   npx commits compare <a> <b>     head-to-head
//   npx commits embed <handle> [s]  print README badge markdown
//   --json                          raw JSON for any command

const API = process.env.COMMITS_API || "https://commit-markets.vercel.app";
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};
const args = process.argv.slice(2);
const json = args.includes("--json");
const pos = args.filter((a) => !a.startsWith("--"));

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { "user-agent": "commits-cli" } });
  const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
const money = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(1)}%`;
const dir = (n, s) => (n >= 0 ? C.g(s) : C.r(s));

function printQuote(t) {
  console.log(`\n  ${C.b(t.symbol)}  ${C.d(t.handle + " · " + t.kind)}`);
  console.log(`  ${C.b(money(t.price))}   ${dir(t.changePct30d, pct(t.changePct30d) + " 30d")}`);
  const s = t.stats;
  console.log(C.d(`  commits 52w ${s.commits52w.toLocaleString()} · peak wk ${s.peakWeek} · busiest ${s.busiestDay} · streak ${s.currentStreak}d`));
  console.log(C.d(`  ${t.analyst}`));
  console.log(C.d(`  ${t.page}\n`));
}

async function main() {
  const cmd = pos[0];
  try {
    if (!cmd || cmd === "help" || args.includes("--help")) {
      console.log(`commit-markets — the github stock exchange\n
  commits <handle>            quote a user (or owner/repo)
  commits top [limit]         leaderboard by commit velocity
  commits compare <a> <b>     head-to-head
  commits embed <handle> [s]  README badge markdown
  --json                      raw JSON\n`);
      return;
    }
    if (cmd === "top") {
      const limit = Number(pos[1]) || 25;
      const { leaderboard } = await get(`/api/v1/leaderboard?limit=${limit}`);
      if (json) return console.log(JSON.stringify(leaderboard, null, 2));
      console.log(`\n  ${C.b("COMMIT-MARKETS — TOP BY VELOCITY")}\n`);
      for (const row of leaderboard)
        console.log(`  ${C.d(String(row.rank).padStart(3))}  ${C.b(row.symbol.padEnd(22))} ${money(row.price).padStart(12)}  ${C.d(row.commits52w.toLocaleString() + " commits")}`);
      console.log();
      return;
    }
    if (cmd === "compare") {
      const [a, b] = [pos[1], pos[2]];
      if (!a || !b) throw new Error("usage: commits compare <a> <b>");
      const data = await get(`/api/v1/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      if (json) return console.log(JSON.stringify(data, null, 2));
      printQuote(data.a); printQuote(data.b);
      console.log(`  ${C.b("verdict:")} ${data.verdict.summary}\n`);
      return;
    }
    if (cmd === "embed") {
      const handle = pos[1];
      const style = pos[2] || "pro";
      if (!handle) throw new Error("usage: commits embed <handle> [style]");
      const h = encodeURIComponent(handle.replace(/^@/, ""));
      console.log(`[![$${handle.toUpperCase()} on commit-markets](${API}/api/badge?handle=${h}&style=${style})](${API}/${h})`);
      return;
    }
    // default: quote a handle (supports owner/repo via positional join)
    const handle = pos.join("/");
    const { ticker } = await get(`/api/v1/ticker/${encodeURIComponent(handle).replace(/%2F/g, "/")}`);
    if (json) return console.log(JSON.stringify(ticker, null, 2));
    printQuote(ticker);
  } catch (e) {
    console.error(C.r(`error: ${e.message}`));
    process.exit(1);
  }
}
main();
