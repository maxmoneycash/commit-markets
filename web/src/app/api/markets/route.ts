import { createMarket, marketPrice, type CreateSpec } from "@/lib/market/engine";
import { listMarkets } from "@/lib/market/store";

export const dynamic = "force-dynamic";

// GET /api/markets — all markets with live LMSR prices.
export async function GET() {
  const markets = await listMarkets();
  const withPrice = markets
    .map((m) => ({ ...m, price: marketPrice(m) }))
    .sort((a, b) => a.resolveAtMs - b.resolveAtMs);
  return Response.json({ ok: true, count: withPrice.length, markets: withPrice });
}

// POST /api/markets — create a market. Play-money, so open for now.
export async function POST(request: Request) {
  let body: Partial<CreateSpec>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  if (!body.kind || !body.handle || !body.title || !body.resolveAtMs) {
    return Response.json({ ok: false, error: "kind, handle, title, resolveAtMs required" }, { status: 400 });
  }
  try {
    const m = await createMarket(body as CreateSpec);
    return Response.json({ ok: true, market: { ...m, price: marketPrice(m) } }, { status: 201 });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
