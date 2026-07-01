"use client";

import { useState } from "react";

export function ConnectApprove({ code, login }: { code: string; login: string }) {
  const [status, setStatus] = useState<"idle" | "approving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setStatus("approving");
    setError(null);
    try {
      const r = await fetch("/api/connect/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? "failed");
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-11 items-center justify-center rounded-full border border-success/40 bg-success/10 font-mono text-lg text-success">
          ✓
        </div>
        <p className="font-mono text-sm text-foreground">Device connected to ${login.toUpperCase()}.</p>
        <p className="font-mono text-xs text-muted-foreground">Return to your terminal — it&apos;s streaming now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <p className="font-mono text-sm text-muted-foreground">
        Link this device to stream your live usage to{" "}
        <span className="text-foreground">${login.toUpperCase()}</span>?
      </p>
      <div className="rounded-md border border-line bg-muted/30 px-4 py-2 font-mono text-lg font-bold tracking-widest text-foreground">
        {code}
      </div>
      <button
        onClick={approve}
        disabled={status === "approving"}
        className="w-full max-w-xs rounded-md bg-success px-5 py-3 font-mono text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "approving" ? "linking…" : "Approve & connect"}
      </button>
      {error && <p className="font-mono text-xs text-destructive">{error}</p>}
    </div>
  );
}
