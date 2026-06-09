"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const EXAMPLES = ["torvalds", "antirez", "vercel/next.js", "sindresorhus", "maxmoneycash"];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "");
    if (v) router.push(`/${v}`);
  }

  return (
    <main className="px-2">
      <div className="mx-auto flex min-h-[calc(100svh-var(--header-height))] max-w-3xl flex-col items-center justify-center border-x border-line px-6 text-center">
        <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">
          commit-markets
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
          The GitHub Stock Exchange
        </h1>
        <p className="mt-3 font-mono text-sm text-muted-foreground">
          Every dev is a stock. Every repo is a ticker. Trade the tape of code.
        </p>

        <form onSubmit={go} className="mt-8 flex w-full max-w-md gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="github handle  or  owner/repo"
            className="w-full rounded-md border border-input bg-card px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-3 font-mono text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            List
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((h) => (
            <Link
              key={h}
              href={`/${h}`}
              className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted-foreground hover:border-ring hover:text-foreground"
            >
              ${h.split("/").pop()?.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
