import { getUsage } from "@/lib/usageStore";

export const runtime = "nodejs";

// GET /api/usage?handle=X — latest self-reported telemetry for a handle.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get("handle") ?? "").trim();
  if (!handle) return Response.json({ error: "missing handle" }, { status: 400 });
  const e = getUsage(handle);
  if (!e) return Response.json({ connected: false }, { status: 404 });
  return Response.json(
    { connected: true, ageSec: e.ageSec, ...e.payload },
    { headers: { "Cache-Control": "no-store" } },
  );
}
