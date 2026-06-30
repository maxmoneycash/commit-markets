"use client";

import { useState } from "react";

export default function ShareButton({
  handle,
  symbol,
  change,
}: {
  handle: string;
  symbol: string;
  change: number;
}) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const verb = change >= 0 ? "pumping" : "dumping";
  const tweet = `${symbol} is ${verb} ${Math.abs(change)}% this month 📈 — my proof-of-work profile on commits.sh`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copy}
        className="rounded-md border border-line px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-ring hover:text-foreground"
      >
        {copied ? "copied ✓" : "copy link"}
      </button>
      <a
        href={intent}
        target="_blank"
        rel="noreferrer"
        className="rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        share to X
      </a>
    </div>
  );
}
