<div align="center">

# commits.sh

**Proof of work for developers — get noticed for the work you ship.**

Your best work is buried in a wall of green squares. commits.sh turns your GitHub
history into a ranked, verifiable, shareable profile — a candlestick chart of your
commit velocity, a dev **rank** (top X% of shippers), embeddable badges, and a
live "shipping right now" board.

[**commits.sh**](https://commits.sh) · [a ticker](https://commits.sh/torvalds) · [badges](https://commits.sh/badges) · [leaderboard](https://commits.sh/leaderboard)

</div>

---

## What it is

Every GitHub account's commits are a time series. commits.sh turns that series into:

- **A dev rank** — a calibrated tier (`S+`…`D`) and percentile ("top 0.4% of GitHub
  shippers"). The flex, and the share hook.
- **A velocity chart** — candlesticks built from commit momentum (EWMA of daily
  commits), not lines of code.
- **Embeddable badges** — 11 self-contained, Camo-safe SVG styles for your README
  or profile, each linking back to your ticker.
- **A live board** — who's shipping *right now*, ranked by current velocity, with
  real GitHub push/PR/release events on a live-ticking clock.
- **Verified ownership** — prove you control your account (one public gist, no
  OAuth app) to put a ✓ on your ticker.
- **An agent surface** — a public REST API, an MCP server, and a CLI.

It's a fun, viral, dev-first product — no account required to look anyone up.

## Repository layout

This is a monorepo. The product is `web/`; the rest is supporting and experimental.

```
web/        The commits.sh app — Next.js (App Router), deployed on Vercel.
            The product: rank, charts, badges, live board, claim/verify,
            /api/v1 (REST), /api/mcp (MCP server), /api/og (share cards).
cli/        The `commits` CLI (npx, zero-dep) — hits the public API.
src/        Rust "cmkt" engine — a fast parallel commit harvester + indexer.
move/       Experimental Aptos Move contracts (on-chain oracle / attestation).
tools/      Node helpers for the on-chain/oracle layer (agent, anchor, oracle).
legacy/     Original Python/bash prototype (superseded by web/ and src/).
docs/       BADGES.md and other docs.
data/       Generated output (gitignored).
```

## Run the app locally

```bash
cd web
npm install
npm run dev          # → http://localhost:3000  (needs Node ≥ 20)
```

A `GITHUB_TOKEN` (any classic PAT, public scope) raises the API rate limit.
Optional Upstash Redis env (`UPSTASH_REDIS_REST_URL` / `_TOKEN`) enables claims,
the live-board cache, and waitlist persistence. The app degrades gracefully
without them.

## README badges

Put your live ticker on your GitHub profile — pick a style in the interactive
gallery at [`/badges`](https://commits.sh/badges):

```md
[![$YOU on commits.sh](https://commits.sh/api/badge?handle=YOU&style=pro)](https://commits.sh/YOU)
```

Eleven styles (pro, card, terminal, tape, candles, heatmap, stonks, pill,
bloomberg, receipt, glow). Docs: [`docs/BADGES.md`](docs/BADGES.md).

## Status

Live and actively built, frontend-first. The on-chain layer (`move/`, `tools/`)
is **experimental** — a future, independent phase exploring verifiable on-chain
attestation of developer activity. The web product stands on its own.

## License

Not yet licensed — open-sourcing is planned. Until a `LICENSE` file is added, all
rights reserved.

## Credits

Commit-to-candle modeling inspired by
[april-jk/stoke-your-code](https://github.com/april-jk/stoke-your-code)
(idea reimplemented; no code vendored).
