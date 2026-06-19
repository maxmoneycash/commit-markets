import { marketPrice, trade, TradeError } from "@/lib/market/engine";
import { ensureWalletCookie } from "@/lib/market/wallet-cookie";
import type { Outcome } from "@/lib/market/types";

export const dynamic = "force-dynamic";

// POST /api/markets/:id/trade  body: { outcome: "YES"|"NO", shares: number }
// shares > 0 buys, < 0 sells. Uses the anonymous cookie wallet.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { outcome?: Outcome; shares?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  if (body.outcome !== "YES" && body.outcome !== "NO") {
    return Response.json({ ok: false, error: "outcome must be YES or NO" }, { status: 400 });
  }
  if (typeof body.shares !== "number") {
    return Response.json({ ok: false, error: "shares must be a number" }, { status: 400 });
  }

  const walletId = await ensureWalletCookie();
  try {
    const r = await trade(walletId, id, body.outcome, body.shares);
    return Response.json({
      ok: true,
      market: { ...r.market, price: marketPrice(r.market) },
      wallet: r.wallet,
      position: r.position,
      trade: r.trade,
    });
  } catch (e) {
    const status = e instanceof TradeError ? 400 : 500;
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
