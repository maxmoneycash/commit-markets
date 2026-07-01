#!/usr/bin/env node
// commits.sh CLI — proof of work for developers, in your terminal.
// Hits the public API (no auth). Override host with COMMITS_API.
//
//   npx commits-sh <handle>            quote a user (or owner/repo)
//   npx commits-sh top [limit]         leaderboard by commit velocity
//   npx commits-sh compare <a> <b>     head-to-head
//   npx commits-sh embed <handle> [s]  print README badge markdown
//   npx commits-sh connect             stream your live ccusage to your ticker
//   --json                             raw JSON for any command

import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const API = process.env.COMMITS_API || "https://commits.sh";
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function printQuote(t) {
  console.log(`\n  ${C.b(t.symbol)}  ${C.d(t.handle + " · " + t.kind)}`);
  console.log(`  ${C.b(money(t.price))}   ${dir(t.changePct30d, pct(t.changePct30d) + " 30d")}`);
  const s = t.stats;
  console.log(C.d(`  commits 52w ${s.commits52w.toLocaleString()} · peak wk ${s.peakWeek} · busiest ${s.busiestDay} · streak ${s.currentStreak}d`));
  console.log(C.d(`  ${t.analyst}`));
  console.log(C.d(`  ${t.page}\n`));
}

// ── connect: pair once, then stream local ccusage every minute ───────────────

const CONFIG_FILE = path.join(os.homedir(), ".commits", "config.json");
function saveConfig(cfg) {
  mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const a = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(cmd, a, () => {});
}

// Reads local AI usage. Prefers ccusage --json; falls back to the profile
// pipeline's tokens.json. Sends only counts & costs — no paths/prompts/args.
async function collectUsage() {
  try {
    const { stdout } = await execFileP("npx", ["-y", "ccusage@20.0.9", "--json"], {
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const d = JSON.parse(stdout);
    const t = d.totals ?? d;
    const total = t.totalTokens ?? t.tokensTotal ?? t.total;
    const cost = t.totalCost ?? t.costUsdTotal ?? t.cost;
    if (typeof total === "number") {
      return {
        total,
        cost_usd_total: typeof cost === "number" ? cost : 0,
        input_total: t.inputTokens,
        output_total: t.outputTokens,
        cache_read_total: t.cacheReadTokens,
        cache_write_total: t.cacheCreationTokens,
      };
    }
  } catch {
    /* fall through to file */
  }
  for (const f of [path.join(os.homedir(), "maxmoneycash-profile", "data", "tokens.json")]) {
    try {
      const t = JSON.parse(readFileSync(f, "utf8")).totals ?? {};
      if (typeof t.totalTokens === "number") {
        return {
          total: t.totalTokens,
          cost_usd_total: t.totalCost ?? 0,
          input_total: t.inputTokens,
          output_total: t.outputTokens,
          cache_read_total: t.cacheReadTokens,
          cache_write_total: t.cacheCreationTokens,
        };
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

async function streamTick(login, token) {
  const tokens = await collectUsage();
  const ts = new Date().toLocaleTimeString();
  if (!tokens) return console.log(C.d(`  ${ts}  no ccusage data found yet — is Claude Code / ccusage set up?`));
  const res = await fetch(`${API}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ handle: login, source: "ccusage", tokens }),
  });
  console.log(
    res.ok
      ? C.d(`  ${ts}  streamed ${Number(tokens.total).toLocaleString()} tokens · $${Math.round(tokens.cost_usd_total).toLocaleString()} value`)
      : C.r(`  ${ts}  ingest failed (HTTP ${res.status})`),
  );
}

async function connect() {
  const pair = await get(`/api/connect/pair`);
  console.log(`\n  ${C.b("Link your Mac to commits.sh")}\n`);
  console.log(`  Approve here:  ${C.g(pair.verifyUrl)}`);
  console.log(`  Code:          ${C.b(pair.code)}\n`);
  openBrowser(pair.verifyUrl);

  let token, login;
  process.stdout.write("  waiting for approval");
  for (let i = 0; i < 100 && !token; i++) {
    await sleep(3000);
    process.stdout.write(".");
    const st = await get(`/api/connect/pair?code=${pair.code}`);
    if (st.status === "approved" && st.token) {
      token = st.token;
      login = st.login;
    } else if (st.status === "expired") {
      throw new Error("pairing expired — run `connect` again");
    }
  }
  if (!token) throw new Error("timed out waiting for approval");

  saveConfig({ api: API, token, login });
  console.log(`\n  ${C.g("✓")} connected as ${C.b("$" + login.toUpperCase())}`);
  console.log(C.d(`  streaming every 60s · leave this running · ${API}/${login}/live\n`));

  await streamTick(login, token);
  setInterval(() => streamTick(login, token), 60_000);
}

async function main() {
  const cmd = pos[0];
  try {
    if (!cmd || cmd === "help" || args.includes("--help")) {
      console.log(`commits.sh — proof of work for developers\n
  commits-sh <handle>            quote a user (or owner/repo)
  commits-sh top [limit]         leaderboard by commit velocity
  commits-sh compare <a> <b>     head-to-head
  commits-sh embed <handle> [s]  README badge markdown
  commits-sh connect             stream your live ccusage to your ticker
  --json                         raw JSON\n`);
      return;
    }
    if (cmd === "connect") return await connect();
    if (cmd === "top") {
      const limit = Number(pos[1]) || 25;
      const { leaderboard } = await get(`/api/v1/leaderboard?limit=${limit}`);
      if (json) return console.log(JSON.stringify(leaderboard, null, 2));
      console.log(`\n  ${C.b("COMMITS.SH — TOP BY VELOCITY")}\n`);
      for (const row of leaderboard)
        console.log(`  ${C.d(String(row.rank).padStart(3))}  ${C.b(row.symbol.padEnd(22))} ${money(row.price).padStart(12)}  ${C.d(row.commits52w.toLocaleString() + " commits")}`);
      console.log();
      return;
    }
    if (cmd === "compare") {
      const [a, b] = [pos[1], pos[2]];
      if (!a || !b) throw new Error("usage: commits-sh compare <a> <b>");
      const data = await get(`/api/v1/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      if (json) return console.log(JSON.stringify(data, null, 2));
      printQuote(data.a);
      printQuote(data.b);
      console.log(`  ${C.b("verdict:")} ${data.verdict.summary}\n`);
      return;
    }
    if (cmd === "embed") {
      const handle = pos[1];
      const style = pos[2] || "pro";
      if (!handle) throw new Error("usage: commits-sh embed <handle> [style]");
      const h = encodeURIComponent(handle.replace(/^@/, ""));
      console.log(`[![$${handle.toUpperCase()} on commits.sh](${API}/api/badge?handle=${h}&style=${style})](${API}/${h})`);
      return;
    }
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
