"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "done" | "error";

export function WaitlistForm({ source = "waitlist" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus("done");
      setMessage(data.isNew === false ? "You're already on the list." : "You're in. Watch your inbox.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-md rounded-md border border-success/40 bg-success/5 px-4 py-3 text-center font-mono text-sm text-success">
        ✓ {message}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@dev.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className={cn(
            "h-11 flex-1 rounded-md border border-input bg-card px-4 font-mono text-sm text-foreground",
            "placeholder:text-muted-foreground/60 outline-none transition-colors",
            "focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "h-11 rounded-md bg-primary px-5 font-mono text-sm font-semibold text-primary-foreground transition-opacity",
            "hover:opacity-90 disabled:opacity-60",
          )}
        >
          {status === "loading" ? "…" : "Get early access"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-center font-mono text-xs text-destructive">{message}</p>
      )}
    </form>
  );
}
