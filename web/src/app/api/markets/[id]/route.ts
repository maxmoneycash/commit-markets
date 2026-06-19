import { marketPrice } from "@/lib/market/engine";
import { getMarket, getPosition } from "@/lib/market/store";
import { currentWalletId } from "@/lib/market/wallet-cookie";

export const dynamic = "force-dynamic";

// GET /api/markets/:id — market + live price + the caller's position (if any).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMarket(id);
  if (!m) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const wid = await currentWalletId();
  const position = wid ? await getPosition(wid, id) : null;
  return Response.json({ ok: true, market: { ...m, price: marketPrice(m) }, position });
}
