import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { searchTopCommitters } from "@/lib/github";
import { resolveTicker, tickerSummary, SITE } from "@/lib/api";

// MCP server for commit-markets — lets Claude/Cursor/agents pull live commit
// "stock" data. Mounted at /api/mcp (basePath /api). Stateless; no Redis needed.
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_ticker",
      {
        title: "Get commit ticker",
        description:
          "Live commit-velocity 'stock' for a GitHub user or repo. handle is a username, or owner/repo for a repository. Returns price (EWMA commit-momentum index), 30d change, market cap, and activity stats.",
        inputSchema: { handle: z.string().describe("GitHub username, or owner/repo") },
      },
      async ({ handle }) => {
        const t = await resolveTicker(handle);
        if (!t) return { content: [{ type: "text", text: `No ticker found for "${handle}".` }] };
        return { content: [{ type: "text", text: JSON.stringify(tickerSummary(t), null, 2) }] };
      },
    );

    server.registerTool(
      "get_leaderboard",
      {
        title: "Get commit leaderboard",
        description: "Top GitHub accounts ranked by commit index (commits in the last 52 weeks).",
        inputSchema: {
          limit: z.number().int().min(1).max(100).default(25),
          minCommits: z.number().int().min(0).default(2000),
        },
      },
      async ({ limit, minCommits }) => {
        const ranked = await searchTopCommitters({ minCommits });
        const rows = ranked.slice(0, limit).map((c, i) => ({
          rank: i + 1,
          handle: c.login,
          price: c.price,
          commits52w: c.totalLastYear,
          followers: c.followers,
        }));
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      },
    );

    server.registerTool(
      "compare_tickers",
      {
        title: "Compare two tickers",
        description: "Head-to-head of two GitHub users/repos by price and 30d momentum.",
        inputSchema: { a: z.string(), b: z.string() },
      },
      async ({ a, b }) => {
        const [ta, tb] = await Promise.all([resolveTicker(a), resolveTicker(b)]);
        if (!ta || !tb)
          return { content: [{ type: "text", text: `Not found: ${!ta ? a : b}` }] };
        const A = tickerSummary(ta), B = tickerSummary(tb);
        const out = {
          a: A, b: B,
          higherPrice: A.price >= B.price ? A.symbol : B.symbol,
          hotterMomentum: A.changePct30d >= B.changePct30d ? A.symbol : B.symbol,
        };
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      },
    );

    server.registerTool(
      "get_badge_markdown",
      {
        title: "Get README badge markdown",
        description: "Markdown to embed a live commit-markets badge in a GitHub README.",
        inputSchema: {
          handle: z.string(),
          style: z
            .enum(["pro", "card", "terminal", "candles", "heatmap", "tape", "stonks", "pill", "bloomberg", "receipt", "glow"])
            .default("pro"),
          theme: z.enum(["dark", "light"]).default("dark"),
        },
      },
      async ({ handle, style, theme }) => {
        const h = encodeURIComponent(handle.replace(/^@/, ""));
        const md = `[![$${handle.toUpperCase()} on commit-markets](${SITE}/api/badge?handle=${h}&style=${style}&theme=${theme})](${SITE}/${h})`;
        return { content: [{ type: "text", text: md }] };
      },
    );
  },
  {},
  { basePath: "/api", maxDuration: 60, verboseLogs: true },
);

export { handler as GET, handler as POST };
