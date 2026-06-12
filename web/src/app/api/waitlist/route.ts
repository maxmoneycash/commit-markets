import { Redis } from "@upstash/redis";

// Storage is optional at build/preview time. On Vercel, add an Upstash Redis
// integration (Marketplace) and these env vars are injected automatically.
// Until then the form still works and signups are logged loudly — but they are
// NOT persisted, so provision storage before pointing paid traffic here.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Pragmatic email shape check — not RFC-complete, just rejects obvious junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email: unknown;
  let source: unknown;
  try {
    const body = await request.json();
    email = body?.email;
    source = body?.source;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return Response.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();
  const record = {
    email: normalized,
    source: typeof source === "string" ? source.slice(0, 120) : "direct",
    ts: new Date().toISOString(),
  };

  if (!redis) {
    console.warn("[waitlist] STORAGE NOT CONFIGURED — signup not persisted:", record);
    // Still report success so the UX works in dev/preview; do not run ads yet.
    return Response.json({ ok: true, persisted: false });
  }

  try {
    // Set dedupes; the list keeps an ordered, exportable capture log.
    const added = await redis.sadd("waitlist:emails", normalized);
    await redis.lpush("waitlist:log", JSON.stringify(record));
    return Response.json({ ok: true, persisted: true, isNew: added === 1 });
  } catch (err) {
    console.error("[waitlist] store failed:", err);
    return Response.json({ ok: false, error: "Could not save right now. Try again." }, { status: 500 });
  }
}
