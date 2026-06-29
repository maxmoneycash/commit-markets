import { CORS, SITE } from "@/lib/api";

// GET /api/v1 — self-describing index so agents/CLIs can discover the surface.
export function GET() {
  return Response.json(
    {
      name: "commits.sh API",
      version: "1",
      docs: `${SITE}/badges`,
      endpoints: {
        ticker: `${SITE}/api/v1/ticker/{handle}  (handle = user, or owner/repo; ?series=1 for chart arrays)`,
        leaderboard: `${SITE}/api/v1/leaderboard?limit=25&min=2000`,
        compare: `${SITE}/api/v1/compare?a={handle}&b={handle}`,
        badge: `${SITE}/api/badge?handle={handle}&style=pro&theme=dark|light`,
        mcp: `${SITE}/api/mcp`,
      },
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
