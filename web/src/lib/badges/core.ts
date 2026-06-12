// Badge core — shared data + drawing helpers for the README badge SVGs.
// Hard constraint (GitHub Camo): SVGs must be fully self-contained — no external
// fonts, no external images (avatar is inlined as a data URI), no scripts.

import { getUserTicker, type Ticker } from "@/lib/github";

export type BadgeTheme = "dark" | "light";

export type BadgeData = {
  handle: string;
  symbol: string; // $TORVALDS
  name: string;
  price: number;
  changePct30d: number;
  up: boolean;
  totalLastYear: number;
  streak: number;
  peakWeek: number;
  followers: number;
  spark: number[]; // downsampled momentum (~60 pts)
  days: { date: string; commits: number }[]; // last 364 days, week-aligned
  avatar: string | null; // data URI or null
};

// — palettes ————————————————————————————————————————————————————————————
export const UP = "#26a69a";
export const DOWN = "#ef5350";
export const AMBER = "#ff9f0a";

export const PAL = {
  dark: {
    bg: "#0a0c0b",
    panel: "#131614",
    line: "#26292b",
    text: "#e8eae9",
    muted: "#9ba3a0",
    faint: "#5c625f",
  },
  light: {
    bg: "#ffffff",
    panel: "#fafafa",
    line: "#e4e4e7",
    text: "#18181b",
    muted: "#71717a",
    faint: "#a1a1aa",
  },
} as const;

export const MONO =
  "ui-monospace,'SF Mono','Cascadia Mono','Segoe UI Mono',Menlo,Consolas,'Liberation Mono',monospace";
export const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// — helpers ———————————————————————————————————————————————————————————
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fmt(n: number): string {
  const trim = (s: string) => s.replace(/\.0$/, "");
  if (n >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1000) return `${trim((n / 1000).toFixed(1))}k`;
  return `${Math.round(n)}`;
}

export function clampHandle(h: string, max = 18): string {
  return h.length > max ? h.slice(0, max - 1) + "…" : h;
}

/** Polyline path for a series within a box. */
export function sparkPath(points: number[], x: number, y: number, w: number, h: number): string {
  if (points.length < 2) return "";
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const r = max - min || 1;
  return points
    .map((v, i) => {
      const px = x + (i / (points.length - 1)) * w;
      const py = y + h - ((v - min) / r) * h;
      return `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
}

export function areaPath(points: number[], x: number, y: number, w: number, h: number): string {
  const line = sparkPath(points, x, y, w, h);
  if (!line) return "";
  return `${line} L${(x + w).toFixed(1)} ${(y + h).toFixed(1)} L${x.toFixed(1)} ${(y + h).toFixed(1)} Z`;
}

export type MiniCandle = { open: number; close: number; high: number; low: number };

/** Bucket a daily series into n OHLC candles (open = prior close). */
export function toCandles(series: number[], n: number): MiniCandle[] {
  if (!series.length) return [];
  const B = Math.max(1, Math.ceil(series.length / n));
  const out: MiniCandle[] = [];
  for (let i = 0; i < series.length; i += B) {
    const seg = series.slice(i, i + B);
    const open = series[i - 1] ?? seg[0];
    const close = seg[seg.length - 1];
    out.push({ open, close, high: Math.max(open, ...seg), low: Math.min(open, ...seg) });
  }
  return out;
}

/** SVG for candles drawn into a box. */
export function candleSvg(
  candles: MiniCandle[],
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { up?: string; down?: string; gapRatio?: number } = {},
): string {
  if (!candles.length) return "";
  const up = opts.up ?? UP;
  const down = opts.down ?? DOWN;
  const hi = Math.max(...candles.map((c) => c.high), 1);
  const lo = Math.min(...candles.map((c) => c.low), 0);
  const r = hi - lo || 1;
  const Y = (v: number) => y + h - ((v - lo) / r) * h;
  const slot = w / candles.length;
  const bw = Math.max(1.5, slot * (1 - (opts.gapRatio ?? 0.3)));
  let s = "";
  candles.forEach((c, i) => {
    const cx = x + i * slot + slot / 2;
    const col = c.close >= c.open ? up : down;
    const top = Math.min(Y(c.open), Y(c.close));
    const bh = Math.max(1, Math.abs(Y(c.close) - Y(c.open)));
    s += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${Y(c.high).toFixed(1)}" y2="${Y(c.low).toFixed(1)}" stroke="${col}" stroke-width="1"/>`;
    s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}"/>`;
  });
  return s;
}

export function heatLevel(commits: number): number {
  if (commits <= 0) return 0;
  if (commits <= 2) return 1;
  if (commits <= 5) return 2;
  if (commits <= 9) return 3;
  return 4;
}

/** Dot-grid pattern def + rect. Call defs once, then dotRect. */
export function dotDefs(id: string, color: string): string {
  return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${color}"/></pattern>`;
}

// — data ———————————————————————————————————————————————————————————————
const AVATAR_TTL = 86400;

export async function avatarDataUri(handle: string, size = 96): Promise<string | null> {
  try {
    const res = await fetch(`https://github.com/${encodeURIComponent(handle)}.png?size=${size}`, {
      next: { revalidate: AVATAR_TTL },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 300_000) return null; // keep badges light
    const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function getBadgeData(handle: string, withAvatar: boolean): Promise<BadgeData | null> {
  const t: Ticker | null = await getUserTicker(handle, "1y");
  if (!t) return null;
  const p = t.priceDaily;
  const step = Math.max(1, Math.ceil(p.length / 60));
  const spark: number[] = [];
  for (let i = 0; i < p.length; i += step) spark.push(p[i]);
  if (spark[spark.length - 1] !== p[p.length - 1]) spark.push(p[p.length - 1]);
  return {
    handle: t.handle,
    symbol: t.symbol,
    name: t.name,
    price: t.stats.price,
    changePct30d: t.stats.changePct30d,
    up: t.stats.changePct30d >= 0,
    totalLastYear: t.stats.totalLastYear,
    streak: t.stats.currentStreakDays,
    peakWeek: t.stats.peakWeek,
    followers: t.stats.followers,
    spark,
    days: t.daysYear,
    avatar: withAvatar ? await avatarDataUri(t.handle) : null,
  };
}
