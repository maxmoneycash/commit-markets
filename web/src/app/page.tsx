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
    <main className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="w-full max-w-xl text-center">
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-emerald-400/80">
          commit-markets
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-100 sm:text-5xl">
          The GitHub Stock Exchange
        </h1>
        <p className="mt-3 font-mono text-sm text-neutral-500">
          Every dev is a stock. Every repo is a ticker. Trade the tape of code.
        </p>

        <form onSubmit={go} className="mt-8 flex gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="github handle  or  owner/repo"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-emerald-500/40"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-500/90 px-5 py-3 font-mono text-sm font-semibold text-black hover:bg-emerald-400"
          >
            List
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((h) => (
            <Link
              key={h}
              href={`/${h}`}
              className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-neutral-400 hover:border-emerald-500/40 hover:text-emerald-300"
            >
              ${h.split("/").pop()?.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
