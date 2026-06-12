# README badges

Live SVG badges of a GitHub account's commit activity, served by
`/api/badge`. The distribution layer: every badge on a profile README links
back to that account's ticker page.

## Usage

```md
[![$TORVALDS on commit-markets](https://SITE/api/badge?handle=torvalds&style=card)](https://SITE/torvalds)
```

Interactive picker with live previews + copy buttons: **`/badges`**.

## Parameters

| param    | values                                                                 | default |
| -------- | ---------------------------------------------------------------------- | ------- |
| `handle` | any GitHub username (repos not supported in v1)                        | —       |
| `style`  | `card` `terminal` `tape` `candles` `heatmap` `stonks` `pill` `bloomberg` `receipt` `glow` | `card`  |
| `theme`  | `dark` `light` (styles with a fixed aesthetic ignore it)               | `dark`  |

## The ten styles

| style       | one-liner                                          |
| ----------- | -------------------------------------------------- |
| `card`      | flagship hero — avatar, price, candles, stats    |
| `terminal`  | phosphor shell session with blinking cursor        |
| `tape`      | animated scrolling ticker-tape strip               |
| `candles`   | 52-week candlestick chart, dot-grid background     |
| `heatmap`   | the contribution year in grayscale                 |
| `stonks`    | the meme one — pixel arrow, STONKS / NOT STONKS    |
| `pill`      | shields.io-compatible one-liner                    |
| `bloomberg` | amber terminal panel with scanlines                |
| `receipt`   | thermal commit receipt with deterministic barcode  |
| `glow`      | premium glass card, glowing velocity line          |

## Camo constraints (why it's built this way)

GitHub proxies README images through **Camo**, which strips anything external:

- **Fully self-contained SVGs** — no external fonts (system mono/sans stacks
  only), no external images (avatars are fetched server-side and inlined as
  base64 data URIs), no scripts.
- **CSS/SMIL animation inside the SVG works** (tape marquee, terminal cursor).
- **Caching** — Camo respects `Cache-Control`; we serve
  `max-age=3600, s-maxage=21600, stale-while-revalidate=86400`. Commit data
  changes ~daily, so "live" means hours, not seconds.
- The image itself can't be a link; the wrapping markdown `[![…](badge)](url)`
  provides the click-through.

## Agent snippet

Anyone can have their coding agent do the install — no MCP required:

> Add my commit-markets badge to my GitHub profile README. Use this markdown,
> replacing HANDLE with my GitHub username:
> `[![$HANDLE on commit-markets](https://SITE/api/badge?handle=HANDLE&style=card)](https://SITE/HANDLE)`

## Rate limits

Badge data reuses the cached ticker fetch (1h revalidate per handle); avatars
cache for 24h. A hot badge costs ~0 extra GitHub API calls after the first
render in each window.
