"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BadgeHandleForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim().replace(/^@/, "");
        if (v) router.push(`/badges?handle=${encodeURIComponent(v)}`);
      }}
      className="flex w-full max-w-md gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="your github handle"
        className="w-full rounded-md border border-input bg-card px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2.5 font-mono text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Preview
      </button>
    </form>
  );
}
