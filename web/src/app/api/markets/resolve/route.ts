import { resolveAllDue } from "@/lib/market/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Resolves every due, open market from the index snapshots. Cron-triggered
// (add to vercel.json crons). Protected by CRON_SECRET when set.
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const results = await resolveAllDue();
  return Response.json({ ok: true, resolved: results.filter((r) => r.status === "resolved").length, results });
}

export const GET = run;
export const POST = run;
