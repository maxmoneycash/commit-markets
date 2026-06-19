import { getOrCreateWallet } from "@/lib/market/engine";
import { ensureWalletCookie } from "@/lib/market/wallet-cookie";

export const dynamic = "force-dynamic";

// GET /api/wallet — the caller's play-money wallet (minting one if first visit).
export async function GET() {
  const id = await ensureWalletCookie();
  const wallet = await getOrCreateWallet(id);
  return Response.json({ ok: true, wallet });
}
