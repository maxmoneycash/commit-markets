// Device pairing — what makes "claim" mean something. A claimed (session'd) user
// approves a device once; the device gets a scoped token bound to their login,
// and can then stream telemetry to /api/ingest as ONLY that login (no spoofing
// other handles, unlike the shared CM_INGEST_TOKEN). Powers `npx commits connect`
// and the future menu-bar app.
//
// Redis:
//   connect:pair:<code>  → { status, login?, token? }   (TTL 15m)
//   ingest:tok:<token>   → login
//   ingest:tokens:<login> → set of that user's device tokens
import { redis } from "@/lib/claims";

export type PairStatus = "pending" | "approved";
export type PairRecord = { status: PairStatus; login?: string; token?: string };

const PAIR_TTL = 900; // 15 min

function hex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Readable, unambiguous pairing code like "K7QP-2M9X" (no 0/O/1/I).
export function newPairCode(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  const s = Array.from(a, (b) => alpha[b % alpha.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
export const isPairCode = (c: string) => CODE_RE.test(c);

export async function createPair(): Promise<string | null> {
  if (!redis) return null;
  const code = newPairCode();
  await redis.set(`connect:pair:${code}`, { status: "pending" } satisfies PairRecord, { ex: PAIR_TTL });
  return code;
}

export async function getPair(code: string): Promise<PairRecord | null> {
  if (!redis || !isPairCode(code)) return null;
  return (await redis.get<PairRecord>(`connect:pair:${code}`)) ?? null;
}

/** Approve a pending pairing for `login` and mint the device token. */
export async function approvePair(code: string, login: string): Promise<string | null> {
  if (!redis || !isPairCode(code)) return null;
  const rec = await getPair(code);
  if (!rec || rec.status !== "pending") return null;
  const token = `cmk_${hex(24)}`;
  await redis.set(`ingest:tok:${token}`, login);
  await redis.sadd(`ingest:tokens:${login.toLowerCase()}`, token);
  await redis.set(`connect:pair:${code}`, { status: "approved", login, token } satisfies PairRecord, { ex: PAIR_TTL });
  return token;
}

/** The login a device token streams as, or null. */
export async function tokenLogin(token: string): Promise<string | null> {
  if (!redis || !token) return null;
  return (await redis.get<string>(`ingest:tok:${token}`)) ?? null;
}
