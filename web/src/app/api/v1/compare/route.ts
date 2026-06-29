import { resolveTicker, tickerSummary, jsonRes, CORS } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/v1/compare?a={handle}&b={handle} — head-to-head, with a verdict on
// who's shipping harder by price and 30d momentum.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a")?.trim();
  const b = url.searchParams.get("b")?.trim();
  if (!a || !b) return jsonRes({ ok: false, error: "need ?a= and ?b=" }, 400);

  const [ta, tb] = await Promise.all([resolveTicker(a), resolveTicker(b)]);
  if (!ta) return jsonRes({ ok: false, error: `not found: ${a}` }, 404);
  if (!tb) return jsonRes({ ok: false, error: `not found: ${b}` }, 404);

  const A = tickerSummary(ta), B = tickerSummary(tb);
  const leaderByPrice = A.price >= B.price ? A.symbol : B.symbol;
  const leaderByMomentum = A.changePct30d >= B.changePct30d ? A.symbol : B.symbol;

  return jsonRes({
    ok: true,
    a: A,
    b: B,
    verdict: {
      higherPrice: leaderByPrice,
      hotterMomentum: leaderByMomentum,
      priceGap: Math.abs(A.price - B.price),
      summary: `${leaderByPrice} has the higher price; ${leaderByMomentum} has hotter 30d momentum.`,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
