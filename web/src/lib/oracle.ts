// The ORACLE CORE — a signed, hash-chained stream of ccusage telemetry ticks.
//
// This is the trust spine of cost-per-commit markets. Each tick is:
//   1. SIGNED by the subject's per-user ed25519 key  → authenticity (who said it)
//   2. CHAINED to the previous tick (prev = sha256)   → ordering + tamper-evidence
// The chain HEAD hash commits to the entire ordered history (like a mini
// blockchain), so it's the single value we anchor on Aptos and the tape we
// store on Shelby. The SAME ed25519 signature verifies here (Node) and on-chain
// (aptos_std::ed25519::signature_verify_strict_internal) — one identity, two
// verifiers.
//
// IMPORTANT: signing proves the holder of key K *asserted* these numbers; it
// does not prove the numbers are true (ccusage reads local files). Truth-of-
// origin is a separate, later upgrade (provider-billing receipts). What this
// layer buys is non-repudiation + immutability + public auditability, which is
// what makes fabricating a believable stream expensive.

import { createHash, createPublicKey, verify as edVerify } from "node:crypto";

// The surveilled values. Counts/costs only — mirrors what cm-agent already
// sends, never paths/prompts/args. Extend cautiously: the canonical bytes are
// what gets signed, so any field added here changes every downstream hash.
export type TickMetrics = {
  costUsdTotal: number; // cumulative $ spent (the cost-per-commit numerator)
  tokensTotal: number; // cumulative tokens
};

export type OracleTick = {
  handle: string;
  seq: number; // monotonic per handle, starts at 0
  ts: number; // client epoch ms (server also stamps its own recvTs)
  prev: string; // hex sha256 of the previous tick's canonical bytes ("" at seq 0)
  metrics: TickMetrics;
};

export type SignedTick = {
  tick: OracleTick;
  pubkey: string; // hex, 32-byte raw ed25519 public key = the subject's identity
  sig: string; // hex, 64-byte signature over canonicalBytes(tick)
};

// A head commitment: the value we anchor on Aptos / pin alongside the Shelby blob.
export type Commitment = {
  handle: string;
  seq: number; // last tick's seq
  head: string; // hex sha256 of the last tick (commits to the whole chain)
  pubkey: string; // the signing identity for this handle
  ts: number; // last tick's client ts
};

// ── Canonicalization ─────────────────────────────────────────────────────────
// Deterministic, key-sorted JSON so the signed/hashed bytes are reproducible on
// any machine and in any language (the Move verifier must hash the same bytes).
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export function canonicalBytes(tick: OracleTick): Buffer {
  return Buffer.from(canonical(tick), "utf8");
}

export function tickHash(tick: OracleTick): string {
  return createHash("sha256").update(canonicalBytes(tick)).digest("hex");
}

// ── Signature verification ───────────────────────────────────────────────────
// Wrap a raw 32-byte ed25519 public key in the fixed SPKI DER prefix so Node's
// crypto can import it. (Aptos uses the same raw 32-byte key form.)
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function rawEd25519ToKeyObject(pubkeyHex: string) {
  const raw = Buffer.from(pubkeyHex, "hex");
  if (raw.length !== 32) throw new Error("ed25519 pubkey must be 32 bytes");
  const der = Buffer.concat([SPKI_ED25519_PREFIX, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/** True iff `sig` is a valid ed25519 signature by `pubkey` over the tick bytes. */
export function verifyTick(s: SignedTick): boolean {
  try {
    const key = rawEd25519ToKeyObject(s.pubkey);
    return edVerify(null, canonicalBytes(s.tick), key, Buffer.from(s.sig, "hex"));
  } catch {
    return false;
  }
}

// ── Append validation ────────────────────────────────────────────────────────
// A new tick is admissible iff: signature verifies, the signer matches the
// chain's established identity, seq increments by 1, and prev matches the
// stored head. Returns the new Commitment or a reason it was rejected.
export type AppendResult =
  | { ok: true; commitment: Commitment; hash: string }
  | { ok: false; reason: string };

export function validateAppend(s: SignedTick, head: Commitment | null): AppendResult {
  if (s.tick.handle.toLowerCase() !== s.tick.handle) {
    // keep handles lower-cased so identity/keys collate
    return { ok: false, reason: "handle must be lowercase" };
  }
  if (!verifyTick(s)) return { ok: false, reason: "bad signature" };

  if (!head) {
    if (s.tick.seq !== 0) return { ok: false, reason: "first tick must have seq 0" };
    if (s.tick.prev !== "") return { ok: false, reason: "first tick must have empty prev" };
  } else {
    if (s.pubkey !== head.pubkey) return { ok: false, reason: "signer key changed for handle" };
    if (s.tick.seq !== head.seq + 1) return { ok: false, reason: `seq must be ${head.seq + 1}` };
    if (s.tick.prev !== head.head) return { ok: false, reason: "prev does not match chain head" };
  }

  const hash = tickHash(s.tick);
  return {
    ok: true,
    hash,
    commitment: { handle: s.tick.handle, seq: s.tick.seq, head: hash, pubkey: s.pubkey, ts: s.tick.ts },
  };
}
