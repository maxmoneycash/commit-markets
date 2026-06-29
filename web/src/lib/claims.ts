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

/** True iff GitHub OAuth is configured in this environment. */
export function oauthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_OAUTH_CLIENT_ID &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET &&
      process.env.AUTH_SECRET,
  );
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
