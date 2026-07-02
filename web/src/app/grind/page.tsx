import Link from "next/link";
import type { Metadata } from "next";
import { getGrindBoard, planLabel } from "@/lib/usageStore";
import { Panel } from "@/components/panel";
import { HatchSeparator } from "@/components/HatchSeparator";

export const metadata: Metadata = {
  title: "The AI grind — commits.sh",
  description: "Biggest grinders on commits.sh — most AI compute burned, ranked by value extracted and leverage. Live.",
};

export const revalidate = 60;

function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function GrindPage() {
  const board = await getGrindBoard(50);

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        <Panel className="px-4 py-10 text-center">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">the grind</div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
            Biggest grinders on GitHub
          </h1>
          <p className="mx-auto mt-3 max-w-md font-mono text-sm text-muted-foreground">
            Most AI compute burned — ranked by value extracted, with leverage over what they actually pay. Streamed live
            from connected Macs.
          </p>
        </Panel>

        <HatchSeparator />

        {board.length === 0 ? (
          <Panel className="px-4 py-10 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              No one&apos;s connected yet. Be the first —{" "}
              <Link href="/connect" className="text-success underline decoration-success/30 underline-offset-2">
                connect your Mac
              </Link>
              .
            </p>
          </Panel>
        ) : (
          <Panel>
            <div className="divide-y divide-line">
              {board.map((r, i) => (
                <Link
                  key={r.handle}
                  href={`/${r.handle}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://github.com/${r.handle}.png?size=64`}
                    alt=""
                    className="size-8 shrink-0 rounded-md border border-line"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm font-semibold text-foreground">${r.handle.toUpperCase()}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {short(r.tokens)} tokens{r.plan ? ` · ${planLabel(r.plan)}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm tabular-nums text-foreground">${Math.round(r.value).toLocaleString()}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">value</div>
                  </div>
                  {r.leverage >= 1 && (
                    <div className="hidden w-16 shrink-0 text-right sm:block">
                      <div className="font-mono text-sm tabular-nums text-success">{Math.round(r.leverage)}×</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">lev</div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </Panel>
        )}

        <Link
          href="/connect"
          className="block border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/40"
        >
          Stream your own grind — <span className="text-success">connect your Mac</span> →
        </Link>
      </div>
    </main>
  );
}
