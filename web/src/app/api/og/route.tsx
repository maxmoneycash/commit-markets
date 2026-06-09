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
  const closes = t.candles.map((c) => c.close);
  const max = Math.max(1, ...closes);
  const min = Math.min(...closes);
  const range = Math.max(1, max - min);
  const bars = closes.slice(-48);

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

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170, marginTop: 40 }}>
          {bars.map((c, i) => {
            const h = 16 + ((c - min) / range) * 150;
            return <div key={i} style={{ width: 18, height: h, background: accent, opacity: 0.85, borderRadius: 3 }} />;
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
