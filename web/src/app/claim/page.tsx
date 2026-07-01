import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { oauthConfigured } from "@/lib/claims";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = {
  title: "Claim your $TICKER — commits.sh",
  description: "One click. Sign in with GitHub to put a verified ✓ on your commits.sh ticker.",
};

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.57v-2c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.49.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.3-5.47-5.8 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.5.12-3.13 0 0 1.01-.32 3.3 1.2a11.6 11.6 0 0 1 6 0c2.29-1.52 3.3-1.2 3.3-1.2.66 1.63.25 2.83.12 3.13.77.82 1.23 1.87 1.23 3.15 0 4.51-2.8 5.5-5.48 5.79.43.36.81 1.08.81 2.18v3.23c0 .32.22.69.83.57A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string; setup?: string }>;
}) {
  const { handle, setup } = await searchParams;
  const oauth = await oauthConfigured();
  const startHref = `/api/claim/start${handle ? `?handle=${encodeURIComponent(handle)}` : ""}`;

  const setupBanner =
    setup === "ok" || (setup === "already" && oauth)
      ? { ok: true, msg: "✓ One-click sign-in is live." }
      : setup && ["error", "exchange_failed", "no_creds"].includes(setup)
        ? { ok: false, msg: "Setup didn't complete — try the setup link again." }
        : null;

  return (
    <main className="px-2">
      <div className="mx-auto max-w-md">
        {setupBanner && (
          <div
            className={`mb-2 border-x border-line px-4 py-2 text-center font-mono text-xs ${
              setupBanner.ok ? "text-success" : "text-destructive"
            }`}
          >
            {setupBanner.msg}
          </div>
        )}
        <Panel className="px-6 py-12 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">Claim your $TICKER</h1>
          <p className="mx-auto mt-2 max-w-sm font-mono text-sm text-muted-foreground">
            One click. Sign in with GitHub and your ticker gets a verified ✓ — nothing to copy, nothing to install.
          </p>

          <a
            href={startHref}
            className="mx-auto mt-8 flex w-full max-w-xs items-center justify-center gap-2.5 rounded-md bg-foreground px-5 py-3 font-mono text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <GitHubMark className="size-5" />
            Sign in with GitHub
          </a>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
            Read-only — we only read your public profile to confirm it&apos;s you.
          </p>
        </Panel>

        {!oauth && (
          <Panel className="mt-2 px-6 py-5">
            <details className="group">
              <summary className="cursor-pointer list-none font-mono text-xs text-muted-foreground hover:text-foreground">
                <span className="underline decoration-muted-foreground/30 underline-offset-2">
                  One-click sign-in is being set up — verify manually instead ↓
                </span>
              </summary>
              <div className="mt-2">
                <ClaimForm initialHandle={handle ?? ""} />
              </div>
            </details>
          </Panel>
        )}
      </div>
    </main>
  );
}
