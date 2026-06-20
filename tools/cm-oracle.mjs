#!/usr/bin/env node
// cm-oracle — signed, hash-chained ccusage commitment collector.
//
//   node tools/cm-oracle.mjs <handle> [--watch] [--interval 300]
//
// This is the EDGE of the oracle core. It reads ccusage totals, builds a tick,
// signs it with a per-user ed25519 key, and POSTs to /api/oracle/commit. The
// server verifies the signature + chain link and advances the head commitment.
// Authenticity comes from the key — the same ed25519 key whose signatures are
// verifiable on Aptos (aptos_std::ed25519). The cost numbers are still self-
// reported; signing makes them non-repudiable, not provably true.
//
// Key + chain state live under ~/.cm-agent/ . The PUBLIC key (printed on first
// run) is the identity you register to get listed.
//
// env: CM_URL (default http://localhost:3000)

import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign as edSign, createPublicKey, createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readFileSync as rf } from "node:fs";
import os from "node:os";
import path from "node:path";

const HANDLE = (process.argv[2] || "").toLowerCase();
const WATCH = process.argv.includes("--watch");
const INTERVAL = (Number(process.argv[process.argv.indexOf("--interval") + 1]) || 300) * 1000;
const CM_URL = process.env.CM_URL ?? "http://localhost:3000";
const CCUSAGE_VERSION = "20.0.9";
const DIR = path.join(os.homedir(), ".cm-agent");

if (!HANDLE) {
  console.error("usage: cm-oracle <github-handle> [--watch] [--interval seconds]");
  process.exit(2);
}

// ── canonicalization: MUST byte-match web/src/lib/oracle.ts canonical() ───────
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");

// ── per-user ed25519 key (raw 32-byte pubkey = identity, Aptos-compatible) ────
function loadOrCreateKey() {
  mkdirSync(DIR, { recursive: true });
  const keyPath = path.join(DIR, "oracle-key.pem");
  if (existsSync(keyPath)) {
    const priv = createPrivateKey(rf(keyPath, "utf8"));
    const der = createPublicKey(priv).export({ format: "der", type: "spki" });
    return { priv, pubkeyHex: Buffer.from(der).subarray(12).toString("hex") };
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  writeFileSync(keyPath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  const der = publicKey.export({ format: "der", type: "spki" });
  const pubkeyHex = Buffer.from(der).subarray(12).toString("hex");
  console.log(`[cm-oracle] generated identity key. PUBLIC KEY (register this):\n  ${pubkeyHex}`);
  return { priv: privateKey, pubkeyHex };
}

// local chain cursor so we resume the same hash chain across runs
function loadCursor() {
  const p = path.join(DIR, `oracle-${HANDLE}.json`);
  if (existsSync(p)) return JSON.parse(rf(p, "utf8"));
  return { seq: -1, prev: "" }; // next tick is seq 0
}
function saveCursor(c) {
  writeFileSync(path.join(DIR, `oracle-${HANDLE}.json`), JSON.stringify(c));
}

// ── ccusage totals (pinned, offline) → the surveilled metrics ─────────────────
function collectMetrics() {
  for (const [bin, pre] of [["bunx", ["--bun", `ccusage@${CCUSAGE_VERSION}`]], ["npx", ["-y", `ccusage@${CCUSAGE_VERSION}`]]]) {
    try {
      const out = execFileSync(bin, [...pre, "monthly", "--json", "--offline"], {
        timeout: 300_000,
        encoding: "utf8",
        env: { ...process.env, PATH: `${os.homedir()}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
      });
      const t = JSON.parse(out).totals ?? {};
      return { costUsdTotal: +(t.totalCost ?? 0), tokensTotal: +(t.totalTokens ?? 0) };
    } catch {
      /* next runner */
    }
  }
  return null;
}

async function tick() {
  const { priv, pubkeyHex } = loadOrCreateKey();
  const metrics = collectMetrics();
  if (!metrics) {
    console.error("[cm-oracle] ccusage produced no totals; skipping tick");
    return;
  }
  const cursor = loadCursor();
  const tick = {
    handle: HANDLE,
    seq: cursor.seq + 1,
    ts: Date.now(),
    prev: cursor.prev,
    metrics,
  };
  const bytes = Buffer.from(canonical(tick), "utf8");
  const sig = edSign(null, bytes, priv).toString("hex");

  const res = await fetch(`${CM_URL}/api/oracle/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tick, pubkey: pubkeyHex, sig }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.ok) {
    saveCursor({ seq: body.commitment.seq, prev: body.commitment.head });
    console.log(
      `[cm-oracle] ${new Date().toISOString()} seq=${body.commitment.seq} head=${body.commitment.head.slice(0, 12)}… cost=$${metrics.costUsdTotal.toFixed(2)}`,
    );
  } else {
    // chain desync (e.g. server reset) — re-seed cursor from server head next run
    console.error(`[cm-oracle] rejected ${res.status}: ${body.error ?? "unknown"} (local hash=${sha256hex(bytes).slice(0, 12)}…)`);
  }
}

let inTick = false;
async function guarded() {
  if (inTick) return;
  inTick = true;
  try {
    await tick();
  } finally {
    inTick = false;
  }
}

await guarded();
if (WATCH) {
  console.log(`[cm-oracle] watching — every ${INTERVAL / 1000}s, committing to ${CM_URL}`);
  setInterval(() => guarded().catch((e) => console.error("[cm-oracle]", e.message)), INTERVAL);
}
