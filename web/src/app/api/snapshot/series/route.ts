import { getSeries } from "@/lib/resolution";

// Read endpoint for a handle's recorded index series — for charts, audits, and
// debugging the snapshot history. e.g. /api/snapshot/series?handle=torvalds
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");
  if (!handle) {
    return Response.json({ ok: false, error: "missing ?handle" }, { status: 400 });
  }
  const from = Number(searchParams.get("from")) || 0;
  const to = Number(searchParams.get("to")) || Number.MAX_SAFE_INTEGER;

  const series = await getSeries(handle, from, to);
  return Response.json({
    ok: true,
    handle,
    count: series.length,
    first: series[0]?.ts ?? null,
    last: series[series.length - 1]?.ts ?? null,
    series,
  });
}
