"use client";

import { useEffect, useState } from "react";
import { priceYes, tradeCost } from "@/lib/market/lmsr"; // pure math — safe client-side
import { cn } from "@/lib/utils";

type Props = {
  marketId: string;
  qYes: number;
  qNo: number;
  b: number;
  resolved: boolean;
  initialPosition: { yes: number; no: number };
};

export function TradePanel({ marketId, qYes: q0Yes, qNo: q0No, b, resolved, initialPosition }: Props) {
  const [qYes, setQYes] = useState(q0Yes);
  const [qNo, setQNo] = useState(q0No);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [shares, setShares] = useState(25);
  const [balance, setBalance] = useState<number | null>(null);
  const [position, setPosition] = useState(initialPosition);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/wallet").then((r) => r.json()).then((d) => d.ok && setBalance(d.wallet.balance)).catch(() => {});
  }, []);

  const curYes = priceYes(qYes, qNo, b);
  const pct = (v: number) => Math.round(v * 100);
  const previewCost = shares > 0 ? tradeCost(qYes, qNo, b, outcome, shares) : 0;
  const previewYes = shares > 0
    ? outcome === "YES" ? priceYes(qYes + shares, qNo, b) : priceYes(qYes, qNo + shares, b)
    : curYes;
  const maxPayout = shares; // each winning share pays 1

  async function submit(side: "YES" | "NO", amt: number) {
    if (resolved || busy || amt === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/markets/${marketId}/trade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: side, shares: amt }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? "trade failed");
      setQYes(d.market.qYes);
      setQNo(d.market.qNo);
      setBalance(d.wallet.balance);
      setPosition({ yes: d.position.yes, no: d.position.no });
      setMsg(`${amt > 0 ? "bought" : "sold"} ${Math.abs(amt)} ${side} · ${d.trade.cost >= 0 ? "−" : "+"}${Math.abs(d.trade.cost).toFixed(1)} $CMKT`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (resolved) {
    return (
      <div className="flex items-center justify-between px-4 py-4 font-mono text-xs text-muted-foreground">
        <span>trading closed</span>
        <span>
          held <span className="tabular-nums text-success">{position.yes} YES</span> ·{" "}
          <span className="tabular-nums text-destructive">{position.no} NO</span>
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* outcome segmented control — also the price display */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
        {(["YES", "NO"] as const).map((o) => {
          const active = outcome === o;
          const price = pct(o === "YES" ? curYes : 1 - curYes);
          return (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={cn(
                "flex flex-col items-center gap-0.5 bg-background py-2.5 transition-colors",
                active ? "bg-accent" : "hover:bg-accent/40",
              )}
            >
              <span className={cn("font-mono text-[10px] uppercase tracking-wider", o === "YES" ? "text-success" : "text-destructive")}>{o}</span>
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">{price}<span className="text-xs text-muted-foreground">¢</span></span>
            </button>
          );
        })}
      </div>

      {/* size slider */}
      <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>size</span>
        <span className="tabular-nums text-foreground">{shares} shares</span>
      </div>
      <input
        type="range"
        min={1}
        max={200}
        value={shares}
        onChange={(e) => setShares(Number(e.target.value))}
        style={{ accentColor: outcome === "YES" ? "var(--color-success)" : "var(--color-destructive)" }}
        className="mt-1.5 w-full"
      />

      {/* cost / payout readout */}
      <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">
          cost <span className="tabular-nums text-foreground">{previewCost.toFixed(1)}</span>
          <span className="text-line"> · </span>
          to win <span className="tabular-nums text-foreground">{maxPayout}</span>
        </span>
        <span className="text-muted-foreground">
          {pct(curYes)}% <span className="text-line">→</span>{" "}
          <span className={outcome === "YES" ? "text-success" : "text-destructive"}>{pct(outcome === "YES" ? previewYes : 1 - previewYes)}%</span>
        </span>
      </div>

      <button
        onClick={() => submit(outcome, shares)}
        disabled={busy || shares <= 0}
        className={cn(
          "mt-3 w-full rounded-md py-2.5 font-mono text-sm font-medium transition-colors disabled:opacity-50",
          outcome === "YES"
            ? "bg-success/15 text-success hover:bg-success/25"
            : "bg-destructive/15 text-destructive hover:bg-destructive/25",
        )}
      >
        {busy ? "···" : `Buy ${shares} ${outcome}`}
      </button>

      {/* position + inline sell */}
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          balance <span className="tabular-nums text-amber">{balance == null ? "·····" : balance.toFixed(0)}</span>
        </span>
        <span className="flex items-center gap-2">
          {position.yes > 0 ? (
            <button onClick={() => submit("YES", -position.yes)} disabled={busy} className="tabular-nums text-success hover:underline disabled:opacity-50">
              {position.yes} YES ✕
            </button>
          ) : null}
          {position.no > 0 ? (
            <button onClick={() => submit("NO", -position.no)} disabled={busy} className="tabular-nums text-destructive hover:underline disabled:opacity-50">
              {position.no} NO ✕
            </button>
          ) : null}
          {position.yes === 0 && position.no === 0 ? <span>no position</span> : null}
        </span>
      </div>

      {msg && <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
