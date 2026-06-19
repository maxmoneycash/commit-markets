import { cookies } from "next/headers";

// Anonymous play-money wallet keyed to a browser cookie — no auth needed for a
// play-money game. (Next 16: cookies() is async.)
const COOKIE = "cmkt_wallet";
const YEAR = 60 * 60 * 24 * 365;

/** Read the wallet id from the cookie without minting one. */
export async function currentWalletId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE)?.value ?? null;
}

/** Read the wallet id, minting + setting the cookie if absent. */
export async function ensureWalletCookie(): Promise<string> {
  const c = await cookies();
  const existing = c.get(COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  c.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR });
  return id;
}
