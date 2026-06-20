import { tickHash, verifyTick } from "@/lib/oracle";
import { getHead, getTape } from "@/lib/oracleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oracle/<handle>          → head commitment + chain length
// GET /api/oracle/<handle>?full=1   → the full signed tape (for independent
//                                     re-verification: anyone can recompute the
//                                     hashes/signatures and confirm the head).
// GET /api/oracle/<handle>?verify=1 → re-verify the whole chain server-side.
export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const url = new URL(req.url);
  const head = await getHead(handle);
  if (!head) return Response.json({ ok: true, handle, head: null, length: 0 });

  const out: Record<string, unknown> = { ok: true, handle, head, length: head.seq + 1 };

  if (url.searchParams.get("full") === "1") {
    out.tape = await getTape(handle);
  }

  if (url.searchParams.get("verify") === "1") {
    const tape = await getTape(handle);
    let prev = "";
    let valid = true;
    let brokeAt: number | null = null;
    for (const s of tape) {
      if (!verifyTick(s) || s.tick.prev !== prev || s.pubkey !== head.pubkey) {
        valid = false;
        brokeAt = s.tick.seq;
        break;
      }
      prev = tickHash(s.tick);
    }
    out.verify = { valid, brokeAt, headMatches: valid && prev === head.head };
  }

  return Response.json(out);
}
