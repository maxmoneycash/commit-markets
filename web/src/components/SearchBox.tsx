"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "");
    if (v) router.push(`/${v}`);
  }

  return (
    <form onSubmit={go} className="flex w-full gap-2">
      <input
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
  );
}
