"use client";

import { useState } from "react";
import Link from "next/link";

const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

type Phase = "idle" | "loadingCode" | "ready" | "verifying" | "done";

export function ClaimForm({ initialHandle }: { initialHandle: string }) {
  const [handle, setHandle] = useState(initialHandle);
  const [code, setCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function getCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const h = handle.trim();
    if (!HANDLE_RE.test(h)) {
      setError("Enter a valid GitHub handle.");
      return;
    }
    setPhase("loadingCode");
    try {
      const r = await fetch(`/api/claim/code?handle=${encodeURIComponent(h)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not get a code.");
      setCode(d.code);
      setPhase("ready");
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  async function verify() {
    setError(null);
    setPhase("verifying");
    try {
      const r = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? "Verification failed.");
      setLogin(d.login);
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("ready");
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (phase === "done" && login) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 font-mono text-xl text-sky-500">
          ✓
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-foreground">${login.toUpperCase()} is verified</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">You now own this ticker on commits.sh.</p>
        </div>
        <Link
          href={`/${login}`}
          className="rounded-md border border-line px-4 py-2 font-mono text-sm text-foreground hover:bg-accent"
        >
          View ${login.toUpperCase()} →
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">Claim your $TICKER</h1>
        <p className="mx-auto mt-2 max-w-md font-mono text-sm text-muted-foreground">
          Prove you own your GitHub account to put a verified ✓ on your ticker. No app to install — just a public gist.
        </p>
      </div>

      {/* step 1 — handle */}
      <form onSubmit={getCode} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center rounded-md border border-line bg-background px-3 font-mono text-sm focus-within:border-foreground/40">
          <span className="text-muted-foreground">github.com/</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="your-handle"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent py-2.5 text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="submit"
          disabled={phase === "loadingCode"}
          className="rounded-md border border-line px-4 py-2.5 font-mono text-sm text-foreground hover:bg-accent disabled:opacity-50"
        >
          {phase === "loadingCode" ? "…" : code ? "New code" : "Get my code"}
        </button>
      </form>

      {/* step 2 — code + gist instructions */}
      {code && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="screen-line-top pt-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              1 · copy your code
            </div>
            <button
              onClick={copyCode}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-muted/30 px-3 py-3 text-left font-mono text-sm hover:border-foreground/40"
            >
              <span className="truncate text-foreground">{code}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{copied ? "copied!" : "copy"}</span>
            </button>
          </div>

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              2 · paste it into a public gist
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              Open a{" "}
              <a
                href="https://gist.github.com/"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
              >
                new gist
              </a>
              , set it <span className="text-foreground">Public</span>, and paste the code as the description (or anywhere
              in the file). Then come back and verify.
            </p>
          </div>

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">3 · verify</div>
            <button
              onClick={verify}
              disabled={phase === "verifying"}
              className="w-full rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 font-mono text-sm text-sky-500 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {phase === "verifying" ? "checking your gists…" : "Verify ownership"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 font-mono text-sm text-destructive">{error}</p>}
    </div>
  );
}
