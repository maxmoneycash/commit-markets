import { putUsage, type UsagePayload } from "@/lib/usageStore";
import { tokenLogin } from "@/lib/pairing";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const MAX_BODY = 16 * 1024; // model breakdown adds ~24 rows
const AGENT_NAMES = /^[a-z0-9 ._-]{1,24}$/i;
const MODEL_NAMES = /^[a-z0-9 ._/:-]{1,48}$/i; // e.g. claude-opus-4-7, openrouter/pony-alpha
const HANDLE_RE = /^[a-zA-Z0-9-]{1,39}$/;

// POST /api/ingest — collector endpoint (see tools/cm-agent.mjs).
// Auth: Bearer token. Dev: CM_INGEST_TOKEN env (default "dev-token");
// production swaps in per-user tokens backed by KV.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const shared = process.env.CM_INGEST_TOKEN ?? "dev-token";

  // Per-user device token (from pairing) → forces handle to that login, so a
  // device can only stream its OWN verified ticker. Shared token = legacy
  // operator collector (trusts body.handle).
  const deviceLogin = token && token !== shared ? await tokenLogin(token) : null;
  if (token !== shared && !deviceLogin) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "payload too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // Bind the payload to the token's login (device tokens can't spoof handles).
  if (deviceLogin && body && typeof body === "object") {
    (body as Record<string, unknown>).handle = deviceLogin;
  }

  const p = sanitize(body);
  if (!p) return Response.json({ error: "invalid payload" }, { status: 422 });

  try {
    await putUsage(p);
    revalidatePath(`/${p.handle}/live`);
  } catch (err) {
    console.error("[ingest] store failed:", err);
    return Response.json({ error: "store unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true, handle: p.handle });
}

const num = (v: unknown, max: number): number | undefined => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : undefined;
  return n === undefined ? undefined : Math.max(0, Math.min(max, n));
};

function sanitize(b: unknown): UsagePayload | null {
  if (typeof b !== "object" || b === null) return null;
  const o = b as Record<string, unknown>;
  const handle = typeof o.handle === "string" ? o.handle.trim() : "";
  if (!HANDLE_RE.test(handle)) return null;

  const out: UsagePayload = { v: 0, handle, updated: new Date().toISOString() };

  if (typeof o.plan === "string" && /^(pro|max5|max20|api)$/.test(o.plan)) out.plan = o.plan;

  const m = o.machine as Record<string, unknown> | undefined;
  if (m && typeof m === "object") {
    out.machine = {
      platform: typeof m.platform === "string" ? m.platform.slice(0, 24) : undefined,
      cpu_cores: num(m.cpu_cores, 512),
      cpu_load_1m: num(m.cpu_load_1m, 4096),
      mem_used_gb: num(m.mem_used_gb, 4096),
      mem_total_gb: num(m.mem_total_gb, 4096),
      uptime_h: num(m.uptime_h, 100_000),
    };
  }

  if (Array.isArray(o.agents)) {
    out.agents = o.agents
      .slice(0, 12)
      .map((a) => {
        const r = a as Record<string, unknown>;
        const name = typeof r.name === "string" && AGENT_NAMES.test(r.name) ? r.name.toLowerCase() : null;
        if (!name) return null;
        return { name, cpu: num(r.cpu, 6400) ?? 0, mem_mb: num(r.mem_mb, 262_144) ?? 0 };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }

  const t = o.tokens as Record<string, unknown> | undefined;
  if (t && typeof t === "object") {
    out.tokens = {
      total: num(t.total, 1e15),
      cost_usd_total: num(t.cost_usd_total, 1e9),
      cache_hit_rate: num(t.cache_hit_rate, 1),
      models_used: num(t.models_used, 10_000),
      avg_usd_month: num(t.avg_usd_month, 1e7),
      live_total: num(t.live_total, 1e15),
      live_cost_usd: num(t.live_cost_usd, 1e9),
      input_total: num(t.input_total, 1e15),
      output_total: num(t.output_total, 1e15),
      cache_read_total: num(t.cache_read_total, 1e15),
      cache_write_total: num(t.cache_write_total, 1e15),
      by_agent: Array.isArray(t.by_agent)
        ? t.by_agent
            .slice(0, 12)
            .map((a) => {
              const r = a as Record<string, unknown>;
              const name = typeof r.name === "string" && AGENT_NAMES.test(r.name) ? r.name.toLowerCase() : null;
              const tokens = num(r.tokens, 1e15);
              return name && tokens !== undefined ? { name, tokens } : null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null)
        : undefined,
      by_model: Array.isArray(t.by_model)
        ? t.by_model
            .slice(0, 24)
            .map((a) => {
              const r = a as Record<string, unknown>;
              const name = typeof r.name === "string" && MODEL_NAMES.test(r.name) ? r.name.slice(0, 48) : null;
              if (!name) return null;
              return {
                name,
                in: num(r.in, 1e15) ?? 0,
                out: num(r.out, 1e15) ?? 0,
                cacheRead: num(r.cacheRead, 1e15) ?? 0,
                cacheWrite: num(r.cacheWrite, 1e15) ?? 0,
                cost: num(r.cost, 1e9) ?? 0,
              };
            })
            .filter((a): a is NonNullable<typeof a> => a !== null)
        : undefined,
    };
  }

  return out;
}
