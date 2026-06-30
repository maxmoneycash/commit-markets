"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const POLL_MS = 4000;
const MAX_POLLS = 20; // ~80s of auto-watching

type Phase = "idle" | "loadingCode" | "ready" | "watching" | "verifying" | "done";

export function ClaimForm({ initialHandle }: { initialHandle: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);
  const [code, setCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<{ n: number; timer: ReturnType<typeof setTimeout> | null }>({ n: 0, timer: null });

  const stopPolling = useCallback(() => {
    if (pollRef.current.timer) clearTimeout(pollRef.current.timer);
    pollRef.current = { n: 0, timer: null };
  }, []);

  const getCode = useCallback(async (h: string) => {
    setError(null);
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
  }, []);

  // Auto-fetch the code if we arrived with a valid handle (?handle= or /claim link).
  useEffect(() => {
    if (initialHandle && HANDLE_RE.test(initialHandle)) getCode(initialHandle);
    return stopPolling;
  }, [initialHandle, getCode, stopPolling]);

  const runVerify = useCallback(
    async (silent: boolean): Promise<boolean> => {
      if (!silent) setPhase("verifying");
      try {
        const r = await fetch("/api/claim/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: handle.trim() }),
        });
        const d = await r.json();
        if (r.ok && d.ok) {
          stopPolling();
          setLogin(d.login);
          setPhase("done");
          setTimeout(() => router.push(`/${d.login}`), 1400);
          return true;
        }
        if (!silent) {
          setError(d.error ?? "Verification failed.");
          setPhase("ready");
        }
        return false;
      } catch (err) {
        if (!silent) {
          setError((err as Error).message);
          setPhase("ready");
        }
        return false;
      }
    },
    [handle, router, stopPolling],
  );

  // Auto-poll: once the user opens the gist, we watch for it so there's no
  // "verify" click — verification happens on its own.
  const poll = useCallback(async () => {
    if (await runVerify(true)) return;
    pollRef.current.n += 1;
    if (pollRef.current.n >= MAX_POLLS) {
      setPhase("ready");
      setError("Didn't spot the gist yet. Make sure it's Public and contains the code, then hit Verify.");
      return;
    }
    pollRef.current.timer = setTimeout(poll, POLL_MS);
  }, [runVerify]);

  function openGistAndWatch() {
    setError(null);
    if (code) navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {});
    window.open("https://gist.github.com/", "_blank", "noopener,noreferrer");
    setPhase("watching");
    stopPolling();
    pollRef.current.timer = setTimeout(poll, POLL_MS);
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
          <p className="mt-1 font-mono text-sm text-muted-foreground">Taking you to your ticker…</p>
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

  const watching = phase === "watching";

  return (
    <div className="px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">Claim your $TICKER</h1>
        <p className="mx-auto mt-2 max-w-md font-mono text-sm text-muted-foreground">
          Prove you own your GitHub account to put a verified ✓ on your ticker. No app, no sign-in — one public gist.
        </p>
      </div>

      {/* step 1 — handle */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          getCode(handle.trim());
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
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

      {/* step 2 — code + one-tap gist + auto-watch */}
      {code && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="screen-line-top pt-4">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              your verification code
            </div>
            <button
              onClick={copyCode}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-muted/30 px-3 py-3 text-left font-mono text-sm hover:border-foreground/40"
            >
              <span className="truncate text-foreground">{code}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{copied ? "copied!" : "copy"}</span>
            </button>
          </div>

          <button
            onClick={openGistAndWatch}
            className="w-full rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-3 font-mono text-sm font-medium text-sky-500 hover:bg-sky-500/20"
          >
            Open a public gist & copy code →
          </button>

          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            Paste the code as the gist <span className="text-foreground">description</span>, keep it{" "}
            <span className="text-foreground">Public</span>, and click <span className="text-foreground">Create</span>.
            We verify automatically — no need to come back and click anything.
          </p>

          {watching && (
            <div className="flex items-center gap-2 font-mono text-sm text-sky-500">
              <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
              watching for your gist…
              <button onClick={() => runVerify(false)} className="ml-auto text-xs text-muted-foreground underline hover:text-foreground">
                check now
              </button>
            </div>
          )}

          {!watching && phase !== "loadingCode" && (
            <button
              onClick={() => runVerify(false)}
              disabled={phase === "verifying"}
              className="font-mono text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              {phase === "verifying" ? "checking…" : "Already made the gist? Verify now"}
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-4 font-mono text-sm text-destructive">{error}</p>}
    </div>
  );
}
