#!/usr/bin/env node
// cm-agent — open-source local collector for commit-markets premium telemetry.
//
//   node tools/cm-agent.mjs <handle> [--watch] [--interval 30]
//
// Outbound-only: reads local usage data + a process scan and POSTs aggregates
// to /api/ingest. Sends ONLY counts/rates/costs — no paths, prompts, or args.
//
// env: CM_URL (default http://localhost:3000), CM_TOKEN (default dev-token)

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const HANDLE = process.argv[2];
const WATCH = process.argv.includes("--watch");
const INTERVAL = (Number(process.argv[process.argv.indexOf("--interval") + 1]) || 30) * 1000;
const CM_URL = process.env.CM_URL ?? "http://localhost:3000";
const CM_TOKEN = process.env.CM_TOKEN ?? "dev-token";
const CCUSAGE_VERSION = "20.0.9"; // pinned; vetted (>=20.0.10 codex double-count unverified)

if (!HANDLE) {
  console.error("usage: cm-agent <github-handle> [--watch] [--interval seconds]");
  process.exit(2);
}

// ---- TokenSource interface: { name, collect() -> tokens block | null } -----

/** Reads the profile-pipeline tokens.json (ccusage aggregated by the user's
 *  own scheduled collector) if present — instant and battle-tested. */
const profileJsonSource = {
  name: "profile-tokens.json",
  collect() {
    const candidates = [
      path.join(os.homedir(), "maxmoneycash-profile", "data", "tokens.json"),
      path.join(os.homedir(), HANDLE, "data", "tokens.json"),
    ];
    const file = candidates.find((c) => existsSync(c));
    if (!file) return null;
    const d = JSON.parse(readFileSync(file, "utf8"));
    const t = d.totals ?? {};
    const months = Array.isArray(d.monthly) ? d.monthly.length : 0;
    const cacheRead = t.cacheReadTokens ?? 0;
    return {
      total: t.totalTokens,
      cost_usd_total: t.totalCost,
      cache_hit_rate: t.totalTokens ? cacheRead / t.totalTokens : undefined,
      avg_usd_month: months ? (t.totalCost ?? 0) / months : undefined,
      by_agent: Object.entries(d.agents ?? {})
        .map(([name, a]) => ({ name, tokens: a?.totals?.totalTokens ?? 0 }))
        .filter((a) => a.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens),
    };
  },
};

/** Live ccusage fallback (pinned, offline) — totals only, slower. */
const ccusageSource = {
  name: `ccusage@${CCUSAGE_VERSION}`,
  collect() {
    const runners = [
      ["bunx", ["--bun", `ccusage@${CCUSAGE_VERSION}`]],
      ["npx", ["-y", `ccusage@${CCUSAGE_VERSION}`]],
    ];
    for (const [bin, pre] of runners) {
      try {
        const out = execFileSync(bin, [...pre, "monthly", "--json", "--offline"], {
          timeout: 300_000, // a loaded box can take ~3 min over a deep history

          encoding: "utf8",
          env: { ...process.env, PATH: `${os.homedir()}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
        });
        const d = JSON.parse(out);
        const t = d.totals ?? {};
        return {
          total: t.totalTokens,
          cost_usd_total: t.totalCost,
          cache_hit_rate: t.totalTokens ? (t.cacheReadTokens ?? 0) / t.totalTokens : undefined,
        };
      } catch {
        /* try next runner */
      }
    }
    return null;
  },
};

const AGENT_RE = /(claude|codex|cursor|kimi|droid|opencode)/i;

function scanAgents() {
  // name-only scan: comm basename, cpu%, rss — no args/paths ever read
  const out = execFileSync("ps", ["-A", "-o", "%cpu=,rss=,comm="], { encoding: "utf8" });
  const agg = new Map();
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^([\d.]+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const base = path.basename(m[3]).toLowerCase();
    const hit = base.match(AGENT_RE);
    if (!hit) continue;
    const name = hit[1].toLowerCase();
    const cur = agg.get(name) ?? { name, cpu: 0, mem_mb: 0 };
    cur.cpu += parseFloat(m[1]);
    cur.mem_mb += parseInt(m[2], 10) / 1024;
    agg.set(name, cur);
  }
  return [...agg.values()]
    .map((a) => ({ ...a, cpu: +a.cpu.toFixed(1), mem_mb: Math.round(a.mem_mb) }))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 8);
}

function machine() {
  return {
    platform: `${os.platform()}-${os.arch()}`,
    cpu_cores: os.cpus().length,
    cpu_load_1m: +os.loadavg()[0].toFixed(2),
    mem_used_gb: +((os.totalmem() - os.freemem()) / 1073741824).toFixed(1),
    mem_total_gb: +(os.totalmem() / 1073741824).toFixed(0),
    uptime_h: +(os.uptime() / 3600).toFixed(1),
  };
}

// Live burn signal: the profile tokens.json only moves when that repo's
// pipeline pushes, so poll ccusage directly on a slow cadence and merge the
// moving total in as live_total (feeds the burn lane on /live).
const LIVE_POLL_MS = 5 * 60_000;
let liveLastPoll = 0;

// Returns fresh data only on poll ticks (every ~5 min) — ticks in between get
// null so the server's burn history isn't padded with stale duplicates.
function liveTokens() {
  if (Date.now() - liveLastPoll < LIVE_POLL_MS) return null;
  liveLastPoll = Date.now();
  try {
    return ccusageSource.collect();
  } catch {
    return null;
  }
}

async function tick() {
  let tokens = null;
  let source = "none";
  for (const s of [profileJsonSource, ccusageSource]) {
    try {
      tokens = s.collect();
      if (tokens) {
        source = s.name;
        break;
      }
    } catch {
      /* next source */
    }
  }
  const live = liveTokens();
  if (live?.total != null) {
    tokens = { ...(tokens ?? {}), live_total: live.total, live_cost_usd: live.cost_usd_total };
    source += "+live";
  }
  const payload = { v: 0, handle: HANDLE, machine: machine(), agents: scanAgents(), ...(tokens ? { tokens } : {}) };
  const res = await fetch(`${CM_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CM_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log(
    `[cm-agent] ${new Date().toISOString()} ${res.status} tokens:${source} agents:${payload.agents.length} -> ${body.slice(0, 80)}`,
  );
}

let inTick = false;
async function guardedTick() {
  if (inTick) return; // ccusage poll can block past the interval — skip pile-ups
  inTick = true;
  try {
    await tick();
  } finally {
    inTick = false;
  }
}

await guardedTick();
if (WATCH) {
  console.log(`[cm-agent] watching — every ${INTERVAL / 1000}s, posting to ${CM_URL}`);
  setInterval(() => guardedTick().catch((e) => console.error("[cm-agent]", e.message)), INTERVAL);
}
