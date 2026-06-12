import { getBadgeData, PAL, MONO, esc } from "@/lib/badges/core";
import { STYLES } from "@/lib/badges/styles";

export const runtime = "nodejs";

// GET /api/badge?handle=torvalds&style=card&theme=dark
// Returns a self-contained SVG for GitHub READMEs (proxied by Camo).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get("handle") ?? "").trim().replace(/^@/, "");
  const styleName = searchParams.get("style") ?? "card";
  const theme = searchParams.get("theme") === "light" ? ("light" as const) : ("dark" as const);

  const style = STYLES[styleName];
  if (!handle || !style || handle.includes("/")) {
    return svgResponse(fallbackSvg(handle ? "unknown style or repo handle" : "missing ?handle="), 404);
  }

  try {
    const data = await getBadgeData(handle, style.needsAvatar);
    if (!data) return svgResponse(fallbackSvg(`@${handle} not found`), 404);
    return svgResponse(style.render(data, theme), 200);
  } catch {
    return svgResponse(fallbackSvg("temporarily unavailable"), 503);
  }
}

function svgResponse(svg: string, status: number): Response {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Camo respects Cache-Control; commit data changes ~daily, so cache hard.
      "Cache-Control":
        status === 200
          ? "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400"
          : "public, max-age=120",
    },
  });
}

function fallbackSvg(msg: string): string {
  const P = PAL.dark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="60" viewBox="0 0 380 60" role="img" aria-label="commit-markets badge error">
<rect width="380" height="60" rx="10" fill="${P.bg}"/>
<rect x="0.5" y="0.5" width="379" height="59" rx="9.5" fill="none" stroke="${P.line}"/>
<text x="20" y="27" font-family="${MONO}" font-size="12" font-weight="700" fill="${P.text}">commit-markets</text>
<text x="20" y="44" font-family="${MONO}" font-size="11" fill="${P.muted}">${esc(msg)}</text>
</svg>`;
}
