// Scrolling odds tape — the marquee strip of live market prices. Pure CSS
// animation (pauses on hover), server-renderable. Self-contained keyframes so it
// doesn't touch globals.css.

export function TickerTape({ items }: { items: { handle: string; yes: number }[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items]; // duplicate for a seamless wrap
  return (
    <div className="screen-line-bottom relative overflow-hidden border-x border-line bg-background">
      <style>{`@keyframes cm-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}.cm-tape-track{animation:cm-tape 38s linear infinite}.cm-tape:hover .cm-tape-track{animation-play-state:paused}`}</style>
      <div className="cm-tape">
        <div className="cm-tape-track flex w-max gap-6 py-2 font-mono text-[11px] tabular-nums whitespace-nowrap">
          {loop.map((it, i) => {
            const up = it.yes >= 50;
            return (
              <span key={i} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-foreground/80">${it.handle.toUpperCase()}</span>
                <span className={up ? "text-success" : "text-destructive"}>
                  {up ? "▲" : "▼"} {it.yes}%
                </span>
                <span className="text-line">/</span>
              </span>
            );
          })}
        </div>
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
