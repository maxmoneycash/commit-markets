// Dot-matrix display primitives — 5x7 pixel font rendered as SVG dot grids.
// The signature visual of the /live mission-control page.

const FONT: Record<string, number[]> = {
  // each glyph: 7 rows of 5-bit masks (MSB = left)
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ":": [0b00000, 0b00100, 0b00100, 0b00000, 0b00100, 0b00100, 0b00000],
  "%": [0b11000, 0b11001, 0b00010, 0b00100, 0b01000, 0b10011, 0b00011],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

export function DotDigits({
  text,
  dot = 4,
  gap = 2,
  className = "",
  off = false,
}: {
  text: string;
  dot?: number;
  gap?: number;
  className?: string;
  off?: boolean; // render unlit dots too (ghost segments)
}) {
  const step = dot + gap;
  const glyphW = 5 * step + step; // 5 cols + 1 col spacing
  const W = text.length * glyphW;
  const H = 7 * step;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden>
      {text.split("").map((ch, gi) => {
        const rows = FONT[ch] ?? FONT[" "];
        const cells: React.ReactNode[] = [];
        for (let r = 0; r < 7; r++) {
          for (let cIdx = 0; cIdx < 5; cIdx++) {
            const lit = (rows[r] >> (4 - cIdx)) & 1;
            if (!lit && !off) continue;
            cells.push(
              <rect
                key={`${r}-${cIdx}`}
                x={gi * glyphW + cIdx * step}
                y={r * step}
                width={dot}
                height={dot}
                rx={dot / 4}
                className={lit ? "fill-current" : "fill-current opacity-10"}
              />,
            );
          }
        }
        return cells;
      })}
    </svg>
  );
}

export function SegmentBar({
  pct,
  segments = 16,
  className = "",
  onClass = "fill-success",
  offClass = "fill-muted-foreground/15",
}: {
  pct: number; // 0..100
  segments?: number;
  className?: string;
  onClass?: string;
  offClass?: string;
}) {
  const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * segments);
  const segW = 8;
  const gap = 3;
  const W = segments * (segW + gap) - gap;
  return (
    <svg width={W} height={10} viewBox={`0 0 ${W} 10`} className={className} aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <rect key={i} x={i * (segW + gap)} y={0} width={segW} height={10} rx={1.5} className={i < lit ? onClass : offClass} />
      ))}
    </svg>
  );
}
