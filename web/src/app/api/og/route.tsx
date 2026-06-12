import { ImageResponse } from "next/og";
import { getUserTicker, getRepoTicker, type Ticker } from "@/lib/github";

export const runtime = "nodejs";
export const alt = "commit-markets ticker";
const size = { width: 1200, height: 630 };

async function resolve(handle: string): Promise<Ticker | null> {
  const parts = handle.split("/").filter(Boolean);
  if (parts.length >= 2) return getRepoTicker(parts[0], parts.slice(1).join("/"));
  if (parts.length === 1) return getUserTicker(parts[0]);
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle") ?? "";
  const t = await resolve(handle);

  const bg = "#0a0c0b";
  const green = "#26a69a";
  const red = "#ef5350";

  if (!t) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color: "#888", fontSize: 48 }}>
          ticker not found
        </div>
      ),
      size,
    );
  }

  const up = t.stats.changePct30d >= 0;
  const accent = up ? green : red;
  // real candlesticks (same look as the site chart): weekly OHLC of the momentum
  const UPC = "#22c55e";
  const DOWNC = "#e5484d";
  const candles = t.candles.slice(-48);
  const hi = Math.max(1, ...candles.map((c) => c.high));
  const lo = Math.min(0, ...candles.map((c) => c.low));
  const range = Math.max(1, hi - lo);
  const CH = 170; // chart band height
  const yOf = (v: number) => CH - ((v - lo) / range) * CH;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: bg,
          padding: "64px 72px",
          fontFamily: "monospace",
          color: "#ededed",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {t.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.avatarUrl} width={108} height={108} style={{ borderRadius: 16, border: "2px solid #ffffff20" }} alt="" />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>{t.symbol}</div>
              <div style={{ fontSize: 28, color: "#8a9a94", marginTop: 4 }}>{t.handle}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 72, fontWeight: 700 }}>
              {t.stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 36, color: accent, marginTop: 2, display: "flex" }}>
              {`${up ? "▲" : "▼"} ${Math.abs(t.stats.changePct30d)}% 30d`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, height: CH, marginTop: 40 }}>
          {candles.map((c, i) => {
            const colr = c.close >= c.open ? UPC : DOWNC;
            const bodyTop = yOf(Math.max(c.open, c.close));
            const bodyH = Math.max(2, Math.abs(yOf(c.close) - yOf(c.open)));
            const wickTop = yOf(c.high);
            const wickH = Math.max(2, yOf(c.low) - yOf(c.high));
            return (
              <div key={i} style={{ display: "flex", position: "relative", width: 17, height: CH }}>
                <div style={{ position: "absolute", left: 8, top: wickTop, width: 1.5, height: wickH, background: colr, display: "flex" }} />
                <div style={{ position: "absolute", left: 2, top: bodyTop, width: 13, height: bodyH, background: colr, borderRadius: 1, display: "flex" }} />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 64, marginTop: 36 }}>
          <Stat label="COMMITS 52W" value={t.stats.totalLastYear.toLocaleString()} />
          <Stat label="PEAK WEEK" value={`${t.stats.peakWeek}`} />
          {t.kind === "user" ? (
            <Stat label="STREAK" value={`${t.stats.currentStreakDays}d`} />
          ) : (
            <Stat label="STARS" value={t.stats.followers.toLocaleString()} />
          )}
          <Stat label="MKT CAP" value={`$${(t.stats.marketCap / 1000).toFixed(1)}K`} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ fontSize: 26, color: green, letterSpacing: 4 }}>COMMIT-MARKETS</div>
          <div style={{ fontSize: 24, color: "#8a9a94" }}>The GitHub Stock Exchange</div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 22, color: "#6b7a74", letterSpacing: 2 }}>{label}</div>
      <div style={{ fontSize: 40, color: "#ededed", marginTop: 6 }}>{value}</div>
    </div>
  );
}
