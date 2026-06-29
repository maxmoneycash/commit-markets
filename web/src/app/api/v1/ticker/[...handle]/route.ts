import { resolveTicker, tickerSummary, jsonRes, CORS } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/v1/ticker/{handle}        → summary for a user
// GET /api/v1/ticker/{owner}/{repo}  → summary for a repo
// GET /api/v1/ticker/{handle}?series=1 → also include priceDaily/candles/days
export async function GET(req: Request, ctx: { params: Promise<{ handle: string[] }> }) {
  const { handle } = await ctx.params;
  const h = (handle ?? []).join("/");
  if (!h) return jsonRes({ ok: false, error: "missing handle" }, 400);

  const t = await resolveTicker(h);
  if (!t) return jsonRes({ ok: false, error: `not found: ${h}` }, 404);

  const series = new URL(req.url).searchParams.get("series") === "1";
  return jsonRes({ ok: true, ticker: tickerSummary(t, { series }) });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
