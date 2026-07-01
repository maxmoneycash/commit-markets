import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/panel";
import { currentLogin } from "@/lib/claims";
import { isPairCode } from "@/lib/pairing";
import { ConnectApprove } from "./connect-approve";

export const metadata: Metadata = {
  title: "Connect your Mac — commits.sh",
  description: "Stream your live ccusage stats to your ticker.",
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const login = await currentLogin();
  const valid = code ? isPairCode(code.toUpperCase()) : false;

  return (
    <main className="px-2">
      <div className="mx-auto max-w-md">
        <Panel className="px-6 py-10 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">Connect your Mac</h1>
          <p className="mx-auto mt-2 max-w-sm font-mono text-sm text-muted-foreground">
            Stream your live AI usage — tokens, burn rate, value extracted — straight to your ticker.
          </p>

          <div className="mt-8">
            {valid && login ? (
              <ConnectApprove code={code!.toUpperCase()} login={login} />
            ) : valid && !login ? (
              <div className="flex flex-col items-center gap-3">
                <p className="font-mono text-sm text-muted-foreground">Claim your ticker first, then approve this device.</p>
                <Link
                  href={`/claim`}
                  className="rounded-md bg-foreground px-5 py-2.5 font-mono text-sm font-semibold text-background hover:opacity-90"
                >
                  Claim your $TICKER →
                </Link>
              </div>
            ) : (
              <div className="text-left">
                <p className="mb-3 text-center font-mono text-sm text-muted-foreground">
                  Run this in your terminal — it pairs, then streams every minute:
                </p>
                <pre className="overflow-x-auto rounded-md border border-line bg-muted/30 px-4 py-3 font-mono text-sm text-foreground">
                  npx commits-sh connect
                </pre>
                <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground/70">
                  It opens this page with a code; you approve once. Reads ccusage locally, sends only counts &amp; costs.
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}
