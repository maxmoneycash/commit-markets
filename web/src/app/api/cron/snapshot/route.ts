import { listEntities, recordSnapshot } from "@/lib/momentumStore";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily snapshot job — this is what gives the momentum graph its memory.
// Wired to a Vercel Cron (see web/vercel.json). Each run walks every tracked
// entity and persists one dated reading; re-runs in the same day are idempotent.
//
// Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
// If CRON_SECRET is unset (local/dev), the route is open for manual triggering.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const handles = await listEntities();
  // Modest concurrency so we don't burst the GitHub API rate limit.
  const results: { handle: string; ok: boolean }[] = [];
  const BATCH = 4;
  for (let i = 0; i < handles.length; i += BATCH) {
    const batch = handles.slice(i, i + BATCH);
    const settled = await Promise.all(
      batch.map(async (h) => {
        try {
          const snap = await recordSnapshot(h);
          return { handle: h, ok: snap !== null };
        } catch {
          return { handle: h, ok: false };
        }
      }),
    );
    results.push(...settled);
  }

  const written = results.filter((r) => r.ok).length;
  return Response.json({ ok: true, tracked: handles.length, written, results });
}
