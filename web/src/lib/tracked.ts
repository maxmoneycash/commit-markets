// The DYNAMIC universe of tracked GitHub handles — the resolution set every
// market draws from. Seeded from the curated board.ts constant and grown by
// /api/discover (which searches GitHub for the actual highest-commit accounts).
//
// Stored as an Upstash set (`tracked:handles`) in prod; falls back to the seed
// list in dev. The curated seed is always unioned in, so it can't be lost.

import { Redis } from "@upstash/redis";
import { TRACKED_HANDLES as SEED } from "./board";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const KEY = "tracked:handles";

/** The live tracked universe (seed ∪ discovered), de-duped. */
export async function getTrackedHandles(): Promise<string[]> {
  if (!redis) return [...SEED];
  const discovered = await redis.smembers(KEY);
  return [...new Set<string>([...SEED, ...discovered])];
}

/** Add handles to the universe (idempotent). Returns the ones newly added. */
export async function addTrackedHandles(handles: string[]): Promise<string[]> {
  const clean = [...new Set(handles.map((h) => h.trim().toLowerCase()).filter(Boolean))];
  if (!clean.length || !redis) return redis ? [] : clean;
  const existing = new Set((await redis.smembers(KEY)).map((h) => h.toLowerCase()));
  const seed = new Set(SEED.map((h) => h.toLowerCase()));
  const fresh = clean.filter((h) => !existing.has(h) && !seed.has(h));
  if (fresh.length) await redis.sadd(KEY, fresh[0], ...fresh.slice(1));
  return fresh;
}
