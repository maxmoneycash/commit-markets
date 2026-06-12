"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy markdown" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
