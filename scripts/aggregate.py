#!/usr/bin/env python3
"""Aggregate harvested commit rows (data/<account>.jsonl) into an account-level
index and render a chart.

Replicates stoke-your-code's buildAnalysis() but summed across every repo an
account owns, producing one "account index":
    price  = cumulative net LOC (max(0, prev + added - deleted))
    volume = added + deleted per commit (churn)

Usage:  scripts/aggregate.py <account> [<account> ...]
Output: data/<account>.candles.json , <account>.png
"""
import json, os, sys
from datetime import datetime, timezone
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
COLORS = ["#26a69a", "#d4af37", "#5b8def", "#e0529c", "#ef8e3b"]


def load(acct):
    rows = []
    with open(os.path.join(DATA, f"{acct}.jsonl")) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    rows.sort(key=lambda r: r["ts"])
    return rows


def build(rows, author_filter=None):
    loc, candles, authors, repos = 0, [], {}, set()
    for r in rows:
        if author_filter and r["author"].lower() != author_filter.lower():
            continue
        repos.add(r["repo"])
        authors[r["author"]] = authors.get(r["author"], 0) + 1
        before = loc
        after = max(0, before + r["added"] - r["deleted"])
        loc = after
        candles.append({
            "ts": r["ts"], "iso": r["iso"], "repo": r["repo"], "author": r["author"],
            "open": before, "close": after,
            "high": max(before, after), "low": min(before, after),
            "volume": r["added"] + r["deleted"], "delta": after - before,
        })
    return candles, authors, repos


def fmt(n):
    return f"{n:,}"


def summarize(acct, candles, authors, repos):
    first = datetime.fromtimestamp(candles[0]["ts"], timezone.utc)
    last = datetime.fromtimestamp(candles[-1]["ts"], timezone.utc)
    peak = max(candles, key=lambda c: c["close"])
    up = max(candles, key=lambda c: c["delta"])
    dn = min(candles, key=lambda c: c["delta"])
    print(f"\n{'='*64}\n{acct}  (account-level aggregate index)\n{'='*64}")
    print(f"  repos with commits : {len(repos)}")
    print(f"  commits (candles)  : {fmt(len(candles))}")
    print(f"  contributors       : {len(authors)}")
    print(f"  span               : {first:%Y-%m-%d} -> {last:%Y-%m-%d}")
    print(f"  current LOC (price): {fmt(candles[-1]['close'])}")
    print(f"  peak LOC           : {fmt(peak['close'])}  ({datetime.fromtimestamp(peak['ts'],timezone.utc):%Y-%m-%d}, {peak['repo']})")
    print(f"  total churn        : {fmt(sum(c['volume'] for c in candles))}")
    print(f"  biggest +candle    : +{fmt(up['delta'])}  ({datetime.fromtimestamp(up['ts'],timezone.utc):%Y-%m-%d}, {up['repo']})")
    print(f"  biggest -candle    : {fmt(dn['delta'])}  ({datetime.fromtimestamp(dn['ts'],timezone.utc):%Y-%m-%d}, {dn['repo']})")
    print(f"  top contributors   :")
    for a, n in sorted(authors.items(), key=lambda kv: kv[1], reverse=True)[:6]:
        print(f"      {n:>6}  {a}")


def render(acct, candles, color):
    xs = [datetime.fromtimestamp(c["ts"], timezone.utc) for c in candles]
    close = [c["close"] for c in candles]
    vol = [c["volume"] for c in candles]
    fig, (ax, axv) = plt.subplots(2, 1, figsize=(14, 7), sharex=True,
                                  gridspec_kw={"height_ratios": [3, 1]})
    fig.patch.set_facecolor("#0b0f0e")
    for a in (ax, axv):
        a.set_facecolor("#0b0f0e")
        a.grid(True, color="#1c2522", linewidth=0.5)
        a.tick_params(colors="#8a9a94", labelsize=8)
        for s in a.spines.values():
            s.set_color("#1c2522")
    ax.plot(xs, close, color=color, linewidth=1.1)
    ax.fill_between(xs, close, color=color, alpha=0.08)
    ax.set_title(f"{acct} — cumulative net LOC (account index)   {fmt(close[-1])} LOC, {len(candles)} commits",
                 color="#e8efe9", fontsize=12, loc="left", fontfamily="monospace")
    axv.bar(xs, vol, color=["#26a69a" if c["delta"] >= 0 else "#ef5350" for c in candles], width=2.0)
    axv.set_ylabel("churn", color="#8a9a94", fontsize=8)
    axv.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    out = os.path.join(DATA, f"{acct}.png")
    fig.tight_layout()
    fig.savefig(out, dpi=130, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  chart -> {out}")


def main(accounts):
    for acct, color in zip(accounts, COLORS * 5):
        rows = load(acct)
        if not rows:
            print(f"\n{acct}: no rows in data/{acct}.jsonl (run scripts/harvest.sh first)")
            continue
        candles, authors, repos = build(rows)
        summarize(acct, candles, authors, repos)
        json.dump(candles, open(os.path.join(DATA, f"{acct}.candles.json"), "w"))
        render(acct, candles, color)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: aggregate.py <account> [<account> ...]", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1:])
