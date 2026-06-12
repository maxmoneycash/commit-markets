import type { Metadata } from "next";
import { Panel, PanelHeader, PanelTitle, PanelContent } from "@/components/panel";
import { HatchSeparator } from "@/components/HatchSeparator";
import { CopyButton } from "@/components/CopyButton";
import { BadgeHandleForm } from "@/components/BadgeHandleForm";

export const metadata: Metadata = {
  title: "README badges — commit-markets",
  description: "Put your live $TICKER on your GitHub profile. Ten dynamic SVG styles.",
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const VARIANTS: { style: string; name: string; blurb: string; flagship?: boolean }[] = [
  { style: "card", name: "The Card", blurb: "avatar · price · sparkline · stats", flagship: true },
  { style: "terminal", name: "Terminal", blurb: "phosphor shell session, blinking cursor" },
  { style: "tape", name: "Ticker Tape", blurb: "scrolling marquee strip" },
  { style: "candles", name: "Candles", blurb: "52-week candlestick chart" },
  { style: "heatmap", name: "Heatmap", blurb: "the contribution year, grayscale" },
  { style: "stonks", name: "Stonks", blurb: "the meme one. pixel arrow included" },
  { style: "pill", name: "Pill", blurb: "shields-compatible one-liner" },
  { style: "bloomberg", name: "Bloomberg", blurb: "amber terminal panel, scanlines" },
  { style: "receipt", name: "Receipt", blurb: "thermal-printed commit receipt" },
  { style: "glow", name: "Glow", blurb: "premium glass, glowing velocity line" },
];

function md(handle: string, style: string): string {
  return `[![$${handle.toUpperCase()} on commit-markets](${SITE}/api/badge?handle=${encodeURIComponent(handle)}&style=${style})](${SITE}/${encodeURIComponent(handle)})`;
}

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const sp = await searchParams;
  const handle = (sp.handle ?? "maxmoneycash").trim().replace(/^@/, "");

  return (
    <main className="px-2">
      <div className="mx-auto max-w-3xl">
        {/* hero */}
        <Panel className="px-4 py-10 text-center">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-success">readme badges</div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
            Put your ticker on your README
          </h1>
          <p className="mx-auto mt-3 max-w-md font-mono text-sm text-muted-foreground">
            Live SVG badges of your commit activity. Pick a style, copy the markdown, paste it in your profile README.
          </p>
          <div className="mx-auto mt-7 flex justify-center">
            <BadgeHandleForm initial={handle} />
          </div>
        </Panel>

        <HatchSeparator />

        {VARIANTS.map((v) => (
          <Panel key={v.style}>
            <PanelHeader className="flex items-center justify-between gap-3">
              <PanelTitle>
                {v.name}
                {v.flagship && <span className="ml-2 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[9px] text-success">flagship</span>}
                <span className="ml-2 hidden font-normal normal-case tracking-normal text-faint text-muted-foreground/60 sm:inline">
                  {v.blurb}
                </span>
              </PanelTitle>
              <CopyButton text={md(handle, v.style)} />
            </PanelHeader>
            <PanelContent className="flex justify-center overflow-x-auto py-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/badge?handle=${encodeURIComponent(handle)}&style=${v.style}`}
                alt={`${v.name} badge for ${handle}`}
                className="max-w-full"
                loading="lazy"
              />
            </PanelContent>
          </Panel>
        ))}

        <HatchSeparator />

        {/* how it works */}
        <Panel>
          <PanelHeader>
            <PanelTitle>How it works</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 font-mono text-sm leading-relaxed text-foreground/80">
            <p>
              1. Copy the markdown for any style above — it embeds a live SVG and links to your ticker page.
            </p>
            <p>
              2. Paste it into your profile README (<span className="code-like rounded border border-line bg-muted/40 px-1 py-px text-xs">github.com/you/you</span>).
            </p>
            <p>
              3. The badge updates as you commit — GitHub caches images for a few hours.
            </p>
            <p className="text-muted-foreground">
              Agents welcome: tell Claude or Cursor —{" "}
              <span className="text-foreground/90">
                &quot;add my commit-markets badge to my README: {SITE}/api/badge?handle=YOUR_HANDLE&amp;style=card, linked to {SITE}/YOUR_HANDLE&quot;
              </span>
            </p>
          </PanelContent>
        </Panel>

        <div className="border-x border-line px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          ten styles · live data · zero install
        </div>
      </div>
    </main>
  );
}
