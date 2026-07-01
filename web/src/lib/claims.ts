// Verified-ownership claims: "prove you control this GitHub account → your
// $TICKER is verified". This is the off-chain keystone of monetization (Phase 1)
// and the exact primitive that maps to an Aptos wallet-link claim later.
//
// We hand-roll the GitHub OAuth flow (no next-auth — it lags Next 16) and store
// claims in the existing Upstash Redis. OAuth proves control of the account, so
// signing in === verifying that login. Sessions/state are HMAC-signed with
// AUTH_SECRET; no DB beyond Redis.
import { cookies } from "next/headers";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
export const redis = url && token ? new Redis({ url, token }) : null;

export const SESSION_COOKIE = "cm_session";
export const STATE_COOKIE = "cm_oauth_state";

export type Claim = {
  login: string; // canonical GitHub login (as the API returns it)
  githubId: number;
  name?: string;
  avatarUrl?: string;
  verifiedAt: string; // ISO
  wallet?: string; // reserved for the future Aptos wallet link
};

const claimKey = (login: string) => `claim:${login.toLowerCase()}`;

/**
 * GitHub OAuth/App credentials for one-click "Sign in with GitHub". Prefers
 * creds provisioned via /api/setup (stored in Redis by the manifest flow), then
 * falls back to env vars. This lets the owner self-provision with one click and
 * never touch env vars or copy/paste a secret.
 */
export async function getOAuthCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  if (redis) {
    try {
      const [id, secret] = await Promise.all([
        redis.get<string>("oauth:client_id"),
        redis.get<string>("oauth:client_secret"),
      ]);
      if (id && secret) return { clientId: id, clientSecret: secret };
    } catch {
      /* fall through to env */
    }
  }
  const eid = process.env.GITHUB_OAUTH_CLIENT_ID;
  const esec = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  return eid && esec ? { clientId: eid, clientSecret: esec } : null;
}

export async function setOAuthCreds(clientId: string, clientSecret: string): Promise<void> {
  if (!redis) throw new Error("storage not configured");
  await redis.set("oauth:client_id", clientId);
  await redis.set("oauth:client_secret", clientSecret);
}

/** True iff one-click "Sign in with GitHub" is ready (creds + AUTH_SECRET). */
export async function oauthConfigured(): Promise<boolean> {
  return Boolean(process.env.AUTH_SECRET && (await getOAuthCreds()));
}

/**
 * True iff the gist-based claim flow is usable. Needs only AUTH_SECRET (to mint
 * the per-login code); GITHUB_TOKEN is optional but raises the gist-read rate
 * limit. This is the zero-setup path — live as soon as AUTH_SECRET exists.
 */
export function claimConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

const CODE_PREFIX = "cmsh-";

/**
 * Deterministic, stateless verification code for a login. Because it's an HMAC
 * of the login under our secret, we never have to store a pending challenge —
 * we just recompute it at verify time. It needn't be secret: ownership is proven
 * by the gist living UNDER that GitHub account (GitHub guarantees the owner),
 * the code just binds the gist to a commits.sh claim.
 */
export async function claimCode(login: string): Promise<string> {
  const sig = await hmac(`gist-claim:${login.toLowerCase()}`);
  return CODE_PREFIX + sig.slice(0, 16);
}

export async function getClaim(login: string): Promise<Claim | null> {
  if (!redis) return null;
  try {
    return (await redis.get<Claim>(claimKey(login))) ?? null;
  } catch {
    return null;
  }
}

export async function setClaim(c: Claim): Promise<void> {
  if (!redis) return;
  await redis.set(claimKey(c.login), c);
  await redis.sadd("claims:logins", c.login.toLowerCase());
}

// ---- HMAC-SHA256 signing over a base64url JSON payload ----

const SECRET = process.env.AUTH_SECRET ?? "";

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlEncodeStr(str: string): string {
  // payloads are ascii (github logins, nonces, timestamps)
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecodeStr(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

export async function sign(payload: Record<string, unknown>): Promise<string> {
  const body = b64urlEncodeStr(JSON.stringify({ ...payload, iat: Date.now() }));
  return `${body}.${await hmac(body)}`;
}

export async function verifyToken<T = Record<string, unknown>>(
  tok: string | undefined,
  maxAgeMs = 1000 * 60 * 60 * 24 * 30,
): Promise<T | null> {
  if (!tok || !SECRET) return null;
  const [body, sig] = tok.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const obj = JSON.parse(b64urlDecodeStr(body)) as { iat?: number };
    if (obj.iat && Date.now() - obj.iat > maxAgeMs) return null;
    return obj as T;
  } catch {
    return null;
  }
}

/** The GitHub login of the currently signed-in visitor, or null. */
export async function currentLogin(): Promise<string | null> {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await verifyToken<{ login: string }>(c);
  return s?.login ?? null;
}
