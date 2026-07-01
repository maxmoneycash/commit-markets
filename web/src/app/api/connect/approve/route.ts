import { NextRequest, NextResponse } from "next/server";
import { currentLogin } from "@/lib/claims";
import { approvePair, isPairCode } from "@/lib/pairing";

// A signed-in (claimed) user approves a device pairing code. Only they can — the
// device then streams as their login. This is the payoff of claiming.
export async function POST(req: NextRequest) {
  const login = await currentLogin();
  if (!login) return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });

  let code = "";
  try {
    code = String((await req.json())?.code ?? "").trim().toUpperCase();
  } catch {
    /* fall through */
  }
  if (!isPairCode(code)) return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });

  const token = await approvePair(code, login);
  if (!token) return NextResponse.json({ ok: false, error: "expired_or_used" }, { status: 409 });

  return NextResponse.json({ ok: true, login });
}
