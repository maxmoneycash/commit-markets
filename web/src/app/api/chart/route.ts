import { getUserTicker, type Range } from "@/lib/github";

export const runtime = "nodejs";

// Returns just the chart series for a handle + range, so the timeframe selector
// can swap candles client-side without re-rendering the whole page.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle") ?? "";
  const range = (searchParams.get("range") ?? "1y") as Range;
  const t = await getUserTicker(handle, range);
  if (!t) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ days: t.days, priceDaily: t.priceDaily });
}
