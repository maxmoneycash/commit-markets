<div align="center">

# commit-markets

**Perpetual futures on GitHub developer activity.**

List any GitHub account or repo → its commit history becomes a live activity
index → trade a leveraged perp on it. Long if you think they'll keep shipping,
short if you think they'll stall.

*Stocks price in earnings. commit-markets prices in commits.*

</div>

---

## What this is

A GitHub account's commits are a time series. Turn that series into a tradeable
index and you get a market whose underlying is real, public, verifiable
developer output — not a vibe, not a token, an actual on-chain-attestable signal.

- **List an account or repo.** An account aggregates every repo it owns into one
  index — a "trade the dev" unit. (`vercel`, `torvalds`, your rival's handle.)
- **The commit chart is the index.** It moves when commits land.
- **You trade a perpetual against that index.** Traders set the *mark* price;
  a *funding rate* ties the mark back to real commit activity.

This repository is the **index engine** — the fast oracle layer that turns
commit history into the series a market settles against. The on-chain market
layer (perp, funding, listing) is tracked separately; see
[`docs/DECISION.md`](docs/DECISION.md).

## How the market works (the one non-obvious part)

A perp has **two numbers, and that's the design, not a bug** — exactly like a
BTC perp (spot index + traded mark + funding):

| | |
|---|---|
| **index** | the commit-activity series — moves when commits land |
| **mark** | what traders are paying — moves with order flow |
| **funding** | the rubber band: when mark drifts from index, the crowded side pays the other, pulling mark back to reality |

This resolves the trap that kills the naïve version: if *trading* set the price
(a vAMM/token), the chart would stop being "made of commits." Keeping the index
and the mark as **separate lines tied by funding** lets the candles stay honestly
made of commits while traders still move a price.

**Same engine, unknowns to blue-chips — funding is the dial:**

- **Busy account** → rich, lively index → mark glued to it. Trades like a blue chip.
- **Brand-new account** → flat index → mark floats on pure speculation; longs
  *pay funding* to hold the hype. Ship and the index rises (market "graduates");
  ghost and longs bleed funding to shorts. A clean put-up-or-shut-up market.

**Peer-funded, never house-backed.** The listed party can move their own index by
committing, so the counterparty is other traders — owner-manipulation only
redistributes between traders, it can never drain the protocol.

## The index metric: commit velocity, not lines of code

We tested cumulative-LOC (the obvious metric) on **6,671 real commits** and it
failed: a single vendored-dependency commit moved the index by **±4.6M**, and the
charts were dead-flat-then-vertical — nothing tradeable in between. So:

> **The index of record is commit velocity** (commits per rolling window), with a
> per-commit churn cap. It reflects "is this account shipping," is hard to fake,
> and puts a tiny repo and a giant one on the same scale.

The harvester keeps per-commit `added`/`deleted`, so any metric can be recomputed
without re-harvesting. Full rationale + data in [`docs/DECISION.md`](docs/DECISION.md).

## Engine (`cmkt`)

Rust, parallel across repos via `rayon` — the work is locating/cloning every repo
an account owns and parsing `git log --numstat`, which fans out across all cores.
(Replaces an earlier Python/bash prototype, now in [`legacy/`](legacy/).)

```bash
cargo build --release

# account(s) -> data/<acct>.jsonl  (reads local checkouts in place; clones only
# what's missing, in parallel; deletes each clone after extraction)
./target/release/cmkt harvest <account> [<account> ...]

# data/<acct>.jsonl -> activity index + summary + JSON artifacts
./target/release/cmkt index <account> [<account> ...]

# both
./target/release/cmkt all <account> [<account> ...]
```

Requires `gh` (authenticated) and `git`. Output lands in `data/`, which is
**gitignored** — it is derived from real, sometimes private, repositories and is
never committed.

### Example

```
$ cmkt index maxmoneycash
================================================================
maxmoneycash  (account activity index)
================================================================
  repos with commits : 72
  commits            : 1805
  span               : 2017-05-02  ->  2026-06-06
  -- VELOCITY (metric of record) --
  commits last 7d    : 11
  commits last 30d   : 200
  avg commits/week   : 3.8
  peak week          : 93 commits
```

## Layout

```
src/main.rs        cmkt engine: harvest (parallel) + index
docs/DECISION.md   product decision record + full design log
legacy/            Python/bash prototype (chart renderer not yet ported)
data/              generated output (gitignored)
```

## Status

Standalone, exploratory but real. Being built **frontend-first**: a viral,
play-money **GitHub Stock Exchange** (instant, no money, no chain) is the wedge —
see [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`web/`](web/). The real financial
market layer (perp, funding, listing fee + lister fee-share, settlement venue) is
a later, independent phase. Open questions are at the bottom of
[`docs/DECISION.md`](docs/DECISION.md).

## Credits

Commit-to-candle modeling inspired by
[april-jk/stoke-your-code](https://github.com/april-jk/stoke-your-code)
(idea transcribed and reimplemented; no code vendored).
