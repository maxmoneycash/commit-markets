// Persistence for the market module. Mirrors the rest of the codebase: Upstash
// Redis in prod (when UPSTASH_*/KV_* env is set), local JSON file in dev.
//
// Upstash layout:
//   mkt:ids                       set of market ids
//   mkt:m:<id>                    Market JSON
//   mkt:w:<id>                    Wallet JSON
//   mkt:pos:<wid>:<mid>           Position JSON
//   mkt:posids:<mid>              set of wallet ids holding a position in <mid>
//   mkt:trades:<mid>              list (lpush) of Trade JSON
//
// Local: one JSON file (data/market/db.json) read-modify-written per op. Single
// dev process, so good enough — NOT safe for concurrent prod writes (that's what
// the Upstash path is for; even there, balance updates are last-writer-wins in
// this v1 — fine for play-money, revisit with atomic ops before real stakes).

import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Market, Position, Trade, Wallet } from "./types";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const DB_PATH = join(process.cwd(), "data", "market", "db.json");

type LocalDb = {
  markets: Record<string, Market>;
  wallets: Record<string, Wallet>;
  positions: Record<string, Position>; // key `${wid}:${mid}`
  trades: Record<string, Trade[]>; // key marketId
};

async function loadLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8")) as LocalDb;
  } catch {
    return { markets: {}, wallets: {}, positions: {}, trades: {} };
  }
}
async function saveLocal(db: LocalDb): Promise<void> {
  await mkdir(join(process.cwd(), "data", "market"), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}
const pk = (wid: string, mid: string) => `${wid}:${mid}`;

// ── Markets ──────────────────────────────────────────────────────────────────
export async function putMarket(m: Market): Promise<void> {
  if (redis) {
    await redis.set(`mkt:m:${m.id}`, JSON.stringify(m));
    await redis.sadd("mkt:ids", m.id);
    return;
  }
  const db = await loadLocal();
  db.markets[m.id] = m;
  await saveLocal(db);
}
export async function getMarket(id: string): Promise<Market | null> {
  if (redis) {
    const v = await redis.get<string>(`mkt:m:${id}`);
    return v ? (typeof v === "string" ? JSON.parse(v) : (v as Market)) : null;
  }
  return (await loadLocal()).markets[id] ?? null;
}
export async function listMarkets(): Promise<Market[]> {
  if (redis) {
    const ids = await redis.smembers("mkt:ids");
    const out: Market[] = [];
    for (const id of ids) {
      const m = await getMarket(id);
      if (m) out.push(m);
    }
    return out;
  }
  return Object.values((await loadLocal()).markets);
}

// ── Wallets ──────────────────────────────────────────────────────────────────
export async function putWallet(w: Wallet): Promise<void> {
  if (redis) {
    await redis.set(`mkt:w:${w.id}`, JSON.stringify(w));
    return;
  }
  const db = await loadLocal();
  db.wallets[w.id] = w;
  await saveLocal(db);
}
export async function getWallet(id: string): Promise<Wallet | null> {
  if (redis) {
    const v = await redis.get<string>(`mkt:w:${id}`);
    return v ? (typeof v === "string" ? JSON.parse(v) : (v as Wallet)) : null;
  }
  return (await loadLocal()).wallets[id] ?? null;
}

// ── Positions ────────────────────────────────────────────────────────────────
export async function putPosition(p: Position): Promise<void> {
  if (redis) {
    await redis.set(`mkt:pos:${p.walletId}:${p.marketId}`, JSON.stringify(p));
    await redis.sadd(`mkt:posids:${p.marketId}`, p.walletId);
    return;
  }
  const db = await loadLocal();
  db.positions[pk(p.walletId, p.marketId)] = p;
  await saveLocal(db);
}
export async function getPosition(walletId: string, marketId: string): Promise<Position> {
  const empty: Position = { walletId, marketId, yes: 0, no: 0 };
  if (redis) {
    const v = await redis.get<string>(`mkt:pos:${walletId}:${marketId}`);
    return v ? (typeof v === "string" ? JSON.parse(v) : (v as Position)) : empty;
  }
  return (await loadLocal()).positions[pk(walletId, marketId)] ?? empty;
}
/** All wallet ids holding a position in a market (for payout on resolution). */
export async function holdersOf(marketId: string): Promise<string[]> {
  if (redis) return await redis.smembers(`mkt:posids:${marketId}`);
  const db = await loadLocal();
  return Object.values(db.positions)
    .filter((p) => p.marketId === marketId)
    .map((p) => p.walletId);
}

// ── Trades ───────────────────────────────────────────────────────────────────
export async function appendTrade(t: Trade): Promise<void> {
  if (redis) {
    await redis.lpush(`mkt:trades:${t.marketId}`, JSON.stringify(t));
    return;
  }
  const db = await loadLocal();
  (db.trades[t.marketId] ??= []).push(t);
  await saveLocal(db);
}
export async function listTrades(marketId: string): Promise<Trade[]> {
  if (redis) {
    const raw = await redis.lrange<string>(`mkt:trades:${marketId}`, 0, -1);
    return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as Trade);
  }
  return (await loadLocal()).trades[marketId] ?? [];
}
