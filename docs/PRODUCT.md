# Product & Monetization Foundation

> What we're building, why, and the one architectural decision everything hangs
> off of. This is the reference; code in `web/src/lib/momentumStore.ts` is the
> first implementation of it.

## The decision

**Product:** a people-first GitHub radar — *follow developers, and get told when
their trajectory changes.* Not a stats explorer you visit once. A thing that
pushes *"3 devs you follow are accelerating, 1 just went quiet."*

This is the consumer wedge (a *good* version of GitHub Trending) and, from the
exact same stored data, the B2B product (talent + risk signal). One graph,
harvested four ways.

## Why this, and why now

Look at what's already out there:

- **GitHub Trending** — ranks by stars/day (a gameable vanity spike, not
  shipping), is repo-only (you can't follow *people*), has no memory, no follows,
  no alerts. High daily traffic, weak product. A gap, not a moat.
- **OSSInsight (ossinsight.io)** — beautiful, free, repo-centric analytics. It's
  free because it's a *marketing demo* for TiDB's database, not a product. Raw
  GitHub analytics is a loss-leader. Critically: **it has no memory** — it's a
  live query explorer. Ask it "who's about to ghost" and it can't answer, because
  it stores counts, not trajectories.

Our own app had the same fatal gap: every metric in `lib/github.ts` is recomputed
live from the GitHub API and thrown away (`revalidate: 3600`). We could show a
trajectory *this instant* but couldn't rank "fastest decelerating", couldn't
alert, couldn't prove what was true three weeks ago.

## The foundation: memory

The single thing that turns this from a dashboard into a product — and the thing
OSSInsight structurally refuses to build — is a **persistent Developer Momentum
Graph**: a daily snapshot of every tracked entity's momentum, so *trajectory over
time* becomes a first-class, queryable, alertable thing.

Build the memory once; harvest it four ways:

| A stored momentum graph lets you ask… | …which becomes |
| --- | --- |
| "rank by Δmomentum this week" | the **social discovery feed** (better Trending) |
| "alert me when someone I follow slows" | the **retention loop** (follows + alerts) |
| "devs accelerating in Rust, last 90d" | the **Talent API** (B2B: recruiters, VCs) |
| "this maintainer's velocity is decaying" | the **ghost / bus-factor risk signal** (B2B: security/supply-chain budgets) |

The math isn't new — `lib/github.ts` already computes momentum (EWMA), streaks,
and change%. The foundation just gives that math **a memory and an audience.**

## What's built (this phase)

The keystone is in place — persistence + the read APIs on top of it:

- **`web/src/lib/board.ts`** — single source of truth for tracked handles (the
  home board and the snapshot cron both read it).
- **`web/src/lib/momentumStore.ts`** — the momentum graph. Upstash Redis in prod
  (in-memory fallback in dev, mirroring `usageStore.ts`). Stores dated snapshots
  per entity (idempotent per day), and computes `getTrajectory()` /
  `getMovers()` from stored history with a 4-state vocabulary:
  `accelerating · steady · cooling · quiet`.
- **`web/src/app/api/cron/snapshot/route.ts`** — the daily job that gives the
  graph its memory. Walks every tracked entity, writes one dated reading.
  Protected by `CRON_SECRET`.
- **`web/vercel.json`** — Vercel Cron, daily at 06:00 UTC.
- **`web/src/app/api/movers/route.ts`** — the read side: every entity ranked by
  *stored* week-over-week Δmomentum, filterable by status. This is the thing the
  live-recompute board structurally can't do.

### Config to go live

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) —
  already used by the waitlist; the momentum graph reuses them.
- `CRON_SECRET` — set in Vercel so only Vercel Cron can trigger the snapshot job.

The graph needs ~7+ days of snapshots before week-over-week deltas mean anything.
Day one is just seeding; the value compounds with history.

## What's next (in priority order)

1. **Follows + alert digest** — an `entities`/`follows` model and a daily diff
   that emits "accelerating / went quiet" events. This is the retention loop; the
   consumer app is look-and-leave without it.
2. **Surface movers in the UI** — replace the home board's live point-in-time
   sort with the stored `getMovers()` feed.
3. **Talent API** — query the graph by language/domain + trajectory. First B2B
   product (recruiters, VC sourcing).
4. **Risk signal** — alert on sustained velocity decay of a watched maintainer.
   Sells into supply-chain/security budgets; uncontested.

## The throughline

commit-markets isn't a data company or a social app — it's the trust layer for
software labor: the place that can prove, price, and (eventually) underwrite *who
really ships.* Prediction markets are the far-future, most-regulated application
of that — explicitly **not** the plan that funds the company.
