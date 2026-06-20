import { validateAppend, type SignedTick } from "@/lib/oracle";
import { appendTick, getHead } from "@/lib/oracleStore";

export const runtime = "nodejs"; // needs node:crypto for ed25519 verification
export const dynamic = "force-dynamic";

// POST /api/oracle/commit — submit one SIGNED, hash-chained telemetry tick.
// The server verifies the ed25519 signature and the chain link (seq + prev),
// then appends it to the handle's tape and advances the head commitment.
// Auth is the signature itself: only the holder of the handle's registered key
// can extend its chain. No bearer token needed — forging a tick requires the key.
export async function POST(req: Request) {
  let body: SignedTick;
  try {
    body = (await req.json()) as SignedTick;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body?.tick || !body.pubkey || !body.sig) {
    return Response.json({ ok: false, error: "tick, pubkey, sig required" }, { status: 400 });
  }

  const head = await getHead(body.tick.handle);
  const res = validateAppend(body, head);
  if (!res.ok) return Response.json({ ok: false, error: res.reason }, { status: 422 });

  await appendTick(body, res.commitment);
  return Response.json({ ok: true, commitment: res.commitment }, { status: 201 });
}
