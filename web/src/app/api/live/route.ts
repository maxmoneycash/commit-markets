import { NextResponse } from "next/server";
import { buildLiveBoard } from "@/lib/live";

// Polled by the homepage LiveBoard. The assembled board is cheap (underlying
// GitHub calls are cached); we let the CDN hold it ~20s so a traffic spike of
// pollers collapses onto one rebuild.
export const revalidate = 0;

export async function GET() {
  const data = await buildLiveBoard(6);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" },
  });
}
