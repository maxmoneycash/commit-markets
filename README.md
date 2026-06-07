# commit-markets

**Tradeable markets on GitHub commit activity.** List any repo or any GitHub
account, and its commit history becomes a candlestick index you can take a
position on — long if you think they'll keep shipping, short if you think
they'll stall.

> Stocks price in earnings. commit-markets prices in commits.

## The idea

A GitHub account's commit history is a time series. Turn it into OHLC candles
and you get a chart that looks and behaves like a market — except the
"fundamental" underneath it is real, public, developer activity.

- **List a repo or an account** (an account aggregates every repo it owns into
  one index — a "trade the dev" unit).
- **The commit chart is the index.** It moves when commits land.
- **You trade a perpetual against that index** — the mark price is set by
  traders; a funding rate ties it back to the underlying commit activity.
  Busy accounts trade like blue chips (mark glued to a lively index); brand-new
  accounts trade on pure speculation (flat index, mark floats on belief, longs
  pay funding until the dev actually ships).

This repo currently contains the **index layer**: the tooling that turns commit
history into the candlestick index a market would settle against. The on-chain
perp/market layer is separate.

## What's here

```
scripts/harvest.sh     # GitHub account(s) -> per-commit rows (data/<acct>.jsonl)
scripts/aggregate.py   # rows -> account-level index + chart (data/<acct>.png)
data/                  # generated output (gitignored)
```

### Index definition (v0)

Following the per-commit model from
[stoke-your-code](https://github.com/april-jk/stoke-your-code):

- **One commit = one candle** (raw events; resample to 1H/1D/1W for display).
- **price** = cumulative net lines of code, `max(0, prev + added − deleted)`.
- **volume** = churn, `added + deleted` for that commit.

> **Note — metric is provisional.** On real data, cumulative net LOC is noisy
> and trivially gameable: a single vendored-dependency or generated-file commit
> can move the index by millions, dwarfing years of real work. A tradeable
> index almost certainly wants **commit velocity** (commits per period) and/or a
> per-commit churn cap. The harvested rows keep `added`/`deleted` per commit so
> alternative metrics can be computed without re-harvesting.

## Usage

Requires `gh` (authenticated), `git`, `python3` + `matplotlib`.

```bash
# Harvest one or more accounts. Repos already cloned under $HOME are read in
# place; missing ones are shallow-cloned, extracted, then deleted.
scripts/harvest.sh <account> [<account> ...]

# Build the account-level index and render the chart.
scripts/aggregate.py <account> [<account> ...]
```

Output lands in `data/` (gitignored — it's derived from real, sometimes
private, repositories, so it is never committed).

## Status

Exploratory. The index/harvest layer works on real data; the market mechanism
(perp, funding, listing fee, on-chain settlement) is design-stage.
