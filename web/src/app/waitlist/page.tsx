import type { Metadata } from "next";
import Image from "next/image";
import { Panel } from "@/components/panel";
import { WaitlistForm } from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: "commit-markets — Long the shippers, short the ghosters",
  description:
    "Perpetual futures on GitHub developer activity. Every dev is a stock, every repo a ticker. Join the waitlist for early access.",
  openGraph: {
    title: "commit-markets — Long the shippers, short the ghosters",
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
          <Image
            src="/brand/candle-64.png"
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-5 opacity-90"
            priority
          />
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">
            commit-markets · early access
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
          stocks price earnings · commit-markets prices commits
        </div>
      </div>
    </main>
  );
}
