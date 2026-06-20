// Persistence for the oracle core: the append-only signed tape per handle plus
// its head commitment. Upstash in prod, in-memory in dev — same pattern as the
// rest of the app. The tape is the durable record we later mirror to Shelby;
// the head is the value we later anchor on Aptos.

import { Redis } from "@upstash/redis";
import type { Commitment, SignedTick } from "./oracle";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const g = globalThis as unknown as {
  __cmOracleTape?: Map<string, SignedTick[]>;
  __cmOracleHead?: Map<string, Commitment>;
};
const tape = (g.__cmOracleTape ??= new Map());
const heads = (g.__cmOracleHead ??= new Map());

const TAPE_MAX = 5000; // chain length cap per handle (Shelby holds full history)

export async function getHead(handle: string): Promise<Commitment | null> {
  const key = handle.toLowerCase();
  if (redis) return (await redis.get<Commitment>(`oracle:head:${key}`)) ?? null;
  return heads.get(key) ?? null;
}

export async function appendTick(s: SignedTick, commitment: Commitment): Promise<void> {
  const key = s.tick.handle.toLowerCase();
  if (redis) {
    await Promise.all([
      redis.rpush(`oracle:tape:${key}`, JSON.stringify(s)).then(() => redis.ltrim(`oracle:tape:${key}`, -TAPE_MAX, -1)),
      redis.set(`oracle:head:${key}`, commitment),
    ]);
    return;
  }
  const arr = tape.get(key) ?? [];
  arr.push(s);
  if (arr.length > TAPE_MAX) arr.splice(0, arr.length - TAPE_MAX);
  tape.set(key, arr);
  heads.set(key, commitment);
}

export async function getTape(handle: string): Promise<SignedTick[]> {
  const key = handle.toLowerCase();
  if (redis) {
    const raw = await redis.lrange(`oracle:tape:${key}`, 0, -1);
    return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as SignedTick);
  }
  return tape.get(key) ?? [];
}
