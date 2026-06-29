import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { WaitlistForm } from "@/components/WaitlistForm";

// Inlined candlestick mark — no asset dependency (public/*.png is gitignored,
// so referencing a file would 404 on deploy). Scales crisply at any size.
function CandleMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className="mx-auto mb-5 opacity-90">
      <g className="stroke-amber" strokeLinecap="round">
        <line x1="21" y1="20" x2="21" y2="48" strokeWidth="4" />
        <rect x="14" y="27" width="14" height="15" rx="2.5" className="fill-amber" stroke="none" />
        <line x1="43" y1="8" x2="43" y2="56" strokeWidth="4" />
        <rect x="36" y="18" width="14" height="26" rx="2.5" className="fill-amber" stroke="none" />
      </g>
    </svg>
  );
}

export const metadata: Metadata = {
  title: "commits.sh — Long the shippers, short the ghosters",
  description:
    "Perpetual futures on GitHub developer activity. Every dev is a stock, every repo a ticker. Join the waitlist for early access.",
  openGraph: {
    title: "commits.sh — Long the shippers, short the ghosters",
    description:
      "Perpetual futures on GitHub developer activity. Join the waitlist for early access.",
  },
};

const POINTS = [
  ["List any account or repo", "Its commit history becomes a live activity index."],
  ["Trade a leveraged perp", "Long if they keep shipping, short if they stall."],
  ["Made of real commits", "The index moves when code lands — not vibes, not a token."],
];

export default function WaitlistPage() {
  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        <Panel className="px-4 py-12 text-center sm:py-16">
          <CandleMark size={40} />
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-success">
            commits.sh · early access
          </div>
          <h1 className="mx-auto max-w-xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Long the shippers.
            <br className="hidden sm:block" /> Short the ghosters.
          </h1>
          <p className="mx-auto mt-4 max-w-md font-mono text-sm leading-relaxed text-muted-foreground">
            Perpetual futures on GitHub developer activity. Every dev is a stock,
            every repo a ticker — trade the tape of code.
          </p>
          <div className="mx-auto mt-8">
            <WaitlistForm source="waitlist-hero" />
            <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
              Early access · no spam · play money, not financial advice
            </p>
          </div>
        </Panel>

        <Panel className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {POINTS.map(([title, body]) => (
            <div key={title} className="px-4 py-6">
              <div className="font-mono text-sm font-medium text-foreground">{title}</div>
              <p className="mt-1.5 font-mono text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </Panel>

        <div className="border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          stocks price earnings · commits.sh prices commits
        </div>
      </div>
    </main>
  );
}
