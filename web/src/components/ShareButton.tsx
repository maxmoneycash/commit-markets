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
  const tweet = `${symbol} is ${verb} ${Math.abs(change)}% on the month 📈 trade the GitHub Stock Exchange`;
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
        className="rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs text-neutral-300 hover:border-emerald-500/40 hover:text-emerald-300"
      >
        {copied ? "copied ✓" : "copy link"}
      </button>
      <a
        href={intent}
        target="_blank"
        rel="noreferrer"
        className="rounded-md bg-emerald-500/90 px-3 py-1.5 font-mono text-xs font-semibold text-black hover:bg-emerald-400"
      >
        share to X
      </a>
    </div>
  );
}
