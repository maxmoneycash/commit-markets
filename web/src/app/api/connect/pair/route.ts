import { NextRequest, NextResponse } from "next/server";
import { createPair, getPair, isPairCode } from "@/lib/pairing";

// Device-pairing endpoint for `npx commits connect`.
//   GET            → create a pairing code + verify URL
//   GET ?code=XXXX → poll status; returns the device token once approved
export const revalidate = 0;

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://commits.sh";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    if (!isPairCode(code)) return NextResponse.json({ error: "bad code" }, { status: 400, headers: CORS });
    const rec = await getPair(code);
    if (!rec) return NextResponse.json({ status: "expired" }, { headers: CORS });
    return NextResponse.json(
      { status: rec.status, token: rec.token ?? null, login: rec.login ?? null },
      { headers: CORS },
    );
  }
  const created = await createPair();
  if (!created) return NextResponse.json({ error: "storage not configured" }, { status: 503, headers: CORS });
  return NextResponse.json({ code: created, verifyUrl: `${site()}/connect?code=${created}` }, { headers: CORS });
}
