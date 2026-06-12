// The ten badge styles. Each commits to one aesthetic and renders a fully
// self-contained SVG (Camo-safe). Fonts are system stacks by necessity, so the
// character comes from composition, color, and detail.

import {
  type BadgeData,
  type BadgeTheme,
  PAL,
  UP,
  DOWN,
  AMBER,
  MONO,
  SANS,
  esc,
  fmt,
  clampHandle,
  sparkPath,
  toCandles,
  candleSvg,
  chartBandSvg,
  heatLevel,
  dotDefs,
} from "./core";

type Render = (d: BadgeData, theme: BadgeTheme) => string;

const chg = (d: BadgeData) => `${d.up ? "▲" : "▼"} ${Math.abs(d.changePct30d).toFixed(1)}%`;
const col = (d: BadgeData) => (d.up ? UP : DOWN);

// 1 — CARD · the flagship hero: candles + annual-report stat block -------------
const card: Render = (d, theme) => {
  const P = PAL[theme];
  const W = 480, H = 344;
  const c = col(d);
  const sym = esc(d.symbol);

  // derived "year in review" stats from the daily series
  let active = 0, longest = 0, run = 0, busiest = 0;
  const byDow = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  let totalCommits = 0;
  for (const day of d.days) {
    byDow[new Date(day.date + "T00:00:00Z").getUTCDay()] += day.commits;
    totalCommits += day.commits;
    if (day.commits > 0) {
      active++;
      run++;
      if (run > longest) longest = run;
      if (day.commits > busiest) busiest = day.commits;
    } else run = 0;
  }
  const activePct = Math.round((active / Math.max(1, d.days.length)) * 100);
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon-first
  const dowMax = Math.max(1, ...byDow);
  const topDow = DOW[byDow.indexOf(dowMax)];

  const cell = (x: number, label: string, num: string, sub: string) =>
    `<text x="${x}" y="206" font-family="${MONO}" font-size="9" fill="${P.faint}" letter-spacing="1">${label}</text>
     <text x="${x}" y="228" font-family="${MONO}" font-size="19" font-weight="700" fill="${P.text}">${num}</text>
     <text x="${x}" y="243" font-family="${MONO}" font-size="9" fill="${P.muted}">${sub}</text>`;

  const bars = order
    .map((dow, i) => {
      const h = Math.max(2, (byDow[dow] / dowMax) * 26);
      const hot = byDow[dow] === dowMax;
      return `<rect x="${22 + i * 30}" y="${300 - h}" width="20" height="${h.toFixed(1)}" rx="1.5" fill="${hot ? c : P.line}"/>
              <text x="${32 + i * 30}" y="312" text-anchor="middle" font-family="${MONO}" font-size="8" fill="${hot ? c : P.faint}">${DOW[dow][0]}</text>`;
    })
    .join("");
  const av = d.avatar
    ? `<clipPath id="av"><rect x="20" y="20" width="40" height="40" rx="9"/></clipPath>
       <image href="${d.avatar}" x="20" y="20" width="40" height="40" clip-path="url(#av)"/>
       <rect x="20" y="20" width="40" height="40" rx="9" fill="none" stroke="${P.line}"/>`
    : "";
  const tx = d.avatar ? 72 : 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${sym} on commit-markets">
<title>${sym} — commit-markets</title>
<defs>
  ${dotDefs("dg", theme === "dark" ? "#222826" : "#ececee")}
  <clipPath id="r"><rect width="${W}" height="${H}" rx="12"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#dg)"/>
  ${av}
  <text x="${tx}" y="40" font-family="${MONO}" font-size="21" font-weight="700" fill="${P.text}">${sym}</text>
  <text x="${tx}" y="57" font-family="${MONO}" font-size="11" fill="${P.muted}">${esc(clampHandle(d.handle))} · github</text>
  <text x="${W - 22}" y="42" text-anchor="end" font-family="${MONO}" font-size="26" font-weight="700" fill="${P.text}">${d.price.toFixed(2)}</text>
  <g font-family="${MONO}" font-size="12" font-weight="600">
    <rect x="${W - 22 - 78}" y="50" width="78" height="20" rx="10" fill="${c}" fill-opacity="0.14"/>
    <text x="${W - 22 - 39}" y="64" text-anchor="middle" fill="${c}">${chg(d)}</text>
  </g>
  ${chartBandSvg(d.priceDaily, 20, 86, W - 40, 92, theme)}
  <line x1="0" x2="${W}" y1="188" y2="188" stroke="${P.line}"/>
  ${cell(22, "COMMITS · 52W", totalCommits.toLocaleString(), "past 365 days")}
  ${cell(138, "ACTIVE DAYS", `${active}`, `${activePct}% of the year`)}
  ${cell(254, "LONGEST STREAK", `${longest}d`, "best run")}
  ${cell(370, "BUSIEST DAY", `${busiest}`, "commits in one day")}
  <line x1="0" x2="${W}" y1="258" y2="258" stroke="${P.line}"/>
  ${bars}
  <text x="250" y="284" font-family="${MONO}" font-size="9" fill="${P.faint}" letter-spacing="1">SHIPS HARDEST ON</text>
  <text x="250" y="305" font-family="${MONO}" font-size="19" font-weight="700" fill="${c}">${topDow}<tspan font-size="11" fill="${P.muted}" font-weight="400"> · ${Math.round((dowMax / Math.max(1, totalCommits)) * 100)}% of commits</tspan></text>
  <line x1="0" x2="${W}" y1="322" y2="322" stroke="${P.line}"/>
  <g font-family="${MONO}" font-size="9" fill="${P.faint}">
    <text x="22" y="${H - 10}">github.com/${esc(clampHandle(d.handle))}</text>
    <text x="${W - 22}" y="${H - 10}" text-anchor="end">commit-markets</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" fill="none" stroke="${P.line}"/>
</g>
</svg>`;
};

// 2 — TERMINAL · phosphor shell session ---------------------------------------
const terminal: Render = (d) => {
  const W = 480, H = 210;
  const g = "#33d17a";
  const sym = esc(d.symbol);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${sym} terminal quote">
<title>${sym} — cmkt terminal</title>
<style>@keyframes blink{50%{opacity:0}}.cur{animation:blink 1.1s steps(1) infinite}</style>
<defs><clipPath id="r"><rect width="${W}" height="${H}" rx="10"/></clipPath></defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#0c0f0d"/>
  <rect width="${W}" height="30" fill="#161a18"/>
  <circle cx="20" cy="15" r="5" fill="#ff5f57"/><circle cx="38" cy="15" r="5" fill="#febc2e"/><circle cx="56" cy="15" r="5" fill="#28c840"/>
  <text x="${W / 2}" y="19" text-anchor="middle" font-family="${MONO}" font-size="10" fill="#6f7a74">cmkt — quote ${esc(clampHandle(d.handle))} — 80×24</text>
  <g font-family="${MONO}" font-size="12">
    <text x="20" y="56" fill="${g}">$ <tspan fill="#d8dedb">cmkt quote ${esc(clampHandle(d.handle))}</tspan></text>
    <g fill="#5c625f" font-size="10">
      <text x="20" y="82">TICKER</text><text x="178" y="82">PRICE</text><text x="268" y="82">30D</text><text x="362" y="82">COMMITS/52W</text>
    </g>
    <text x="20" y="102" fill="#d8dedb" font-weight="600">${sym}</text>
    <text x="178" y="102" fill="#d8dedb">${d.price.toFixed(2)}</text>
    <text x="268" y="102" fill="${col(d)}" font-weight="600">${chg(d)}</text>
    <text x="362" y="102" fill="#d8dedb">${fmt(d.totalLastYear)}</text>
    <text x="20" y="128" fill="#5c625f">streak ${d.streak}d · peak week ${d.peakWeek} · followers ${fmt(d.followers)}</text>
  </g>
  <path d="${sparkPath(d.spark, 20, 142, W - 40, 38)}" fill="none" stroke="${g}" stroke-width="1.4" stroke-linejoin="round" opacity="0.9"/>
  <text x="20" y="198" font-family="${MONO}" font-size="12" fill="${g}">$ <tspan class="cur" fill="#d8dedb">▮</tspan></text>
  <text x="${W - 16}" y="198" text-anchor="end" font-family="${MONO}" font-size="9" fill="#3f4543">commit-markets</text>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="9.5" fill="none" stroke="#23272a"/>
</g>
</svg>`;
};

// 3 — TAPE · scrolling ticker strip -------------------------------------------
const tape: Render = (d) => {
  const W = 600, H = 44;
  const c = col(d);
  const sep = `<tspan fill="#4a4f4c">  ◆  </tspan>`;
  const seg = `${esc(d.symbol)} ${d.price.toFixed(2)} <tspan fill="${c}">${chg(d)}</tspan>${sep}COMMITS ${fmt(d.totalLastYear)}${sep}STREAK ${d.streak}D${sep}PEAK WK ${d.peakWeek}${sep}<tspan fill="#6f7a74">COMMIT-MARKETS</tspan>${sep}`;
  // estimate natural width (13px mono ≈ 7.9px/char) so the loop is seamless
  const plain = `${d.symbol} ${d.price.toFixed(2)} ${chg(d)}  ◆  COMMITS ${fmt(d.totalLastYear)}  ◆  STREAK ${d.streak}D  ◆  PEAK WK ${d.peakWeek}  ◆  COMMIT-MARKETS  ◆  `;
  const segW = Math.ceil(plain.length * 7.9);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} ticker tape">
<title>${esc(d.symbol)} — ticker tape</title>
<style>@keyframes mq{from{transform:translateX(0)}to{transform:translateX(-${segW}px)}}.mq{animation:mq ${Math.round(segW / 42)}s linear infinite}</style>
<defs>
  <linearGradient id="lf" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#0a0c0b"/><stop offset="1" stop-color="#0a0c0b" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="rf" x1="1" x2="0" y1="0" y2="0">
    <stop offset="0" stop-color="#0a0c0b"/><stop offset="1" stop-color="#0a0c0b" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="r"><rect width="${W}" height="${H}" rx="8"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#0a0c0b"/>
  <line x1="0" x2="${W}" y1="6.5" y2="6.5" stroke="#1d211f" stroke-dasharray="2 6"/>
  <line x1="0" x2="${W}" y1="${H - 6.5}" y2="${H - 6.5}" stroke="#1d211f" stroke-dasharray="2 6"/>
  <g class="mq" font-family="${MONO}" font-size="13" font-weight="600">
    <text x="12" y="${H / 2 + 4.5}" fill="#d8dedb">${seg}</text>
    <text x="${12 + segW}" y="${H / 2 + 4.5}" fill="#d8dedb">${seg}</text>
    <text x="${12 + segW * 2}" y="${H / 2 + 4.5}" fill="#d8dedb">${seg}</text>
  </g>
  <rect width="36" height="${H}" fill="url(#lf)"/>
  <rect x="${W - 36}" width="36" height="${H}" fill="url(#rf)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="7.5" fill="none" stroke="#23272a"/>
</g>
</svg>`;
};

// 4 — CANDLES · chart-first ----------------------------------------------------
const candles: Render = (d, theme) => {
  const P = PAL[theme];
  const W = 480, H = 200;
  const c = col(d);
  const cs = toCandles(d.priceDaily, 30);
  const last = d.spark[d.spark.length - 1] ?? 0;
  const hi = Math.max(...cs.map((x) => x.high), 1);
  const lo = Math.min(...cs.map((x) => x.low), 0);
  const y = 36 + (1 - (last - lo) / (hi - lo || 1)) * 130;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} candles">
<title>${esc(d.symbol)} — 52-week candles</title>
<defs>${dotDefs("dg2", theme === "dark" ? "#202624" : "#ececee")}<clipPath id="r"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#dg2)"/>
  <text x="20" y="26" font-family="${MONO}" font-size="15" font-weight="700" fill="${P.text}">${esc(d.symbol)}</text>
  <text x="${W - 20}" y="26" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="600" fill="${c}">${d.price.toFixed(2)}  ${chg(d)}</text>
  ${candleSvg(cs, 20, 36, W - 92, 130)}
  <line x1="20" x2="${W - 72}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
  <rect x="${W - 66}" y="${(y - 9).toFixed(1)}" width="48" height="18" rx="3" fill="${c}"/>
  <text x="${W - 42}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="${P.bg}">${fmt(last)}</text>
  <text x="20" y="${H - 14}" font-family="${MONO}" font-size="9" fill="${P.faint}">52W · COMMIT VELOCITY</text>
  <text x="${W - 20}" y="${H - 14}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${P.faint}">commit-markets</text>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" fill="none" stroke="${P.line}"/>
</g>
</svg>`;
};

// 5 — HEATMAP · the year at a glance -------------------------------------------
const heatmap: Render = (d, theme) => {
  const P = PAL[theme];
  const W = 480, H = 168;
  const block = 6, step = 8;
  const weeks: { date: string; commits: number }[][] = [];
  for (let i = 0; i < d.days.length; i += 7) weeks.push(d.days.slice(i, i + 7));
  const gw = weeks.length * step - (step - block);
  const gx = (W - gw) / 2;
  const base = theme === "dark" ? "#9ba3a0" : "#52525b";
  const ops = [0.07, 0.22, 0.42, 0.62, 0.85];
  let cells = "";
  weeks.forEach((w, ci) =>
    w.forEach((day, ri) => {
      cells += `<rect x="${(gx + ci * step).toFixed(1)}" y="${56 + ri * step}" width="${block}" height="${block}" fill="${base}" fill-opacity="${ops[heatLevel(day.commits)]}"/>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} activity">
<title>${esc(d.symbol)} — contribution heat</title>
<defs><clipPath id="r"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <text x="20" y="30" font-family="${MONO}" font-size="15" font-weight="700" fill="${P.text}">${esc(d.symbol)}</text>
  <text x="${W - 20}" y="30" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="600" fill="${col(d)}">${chg(d)} 30D</text>
  ${cells}
  <text x="20" y="${H - 18}" font-family="${MONO}" font-size="10" fill="${P.muted}">${d.totalLastYear.toLocaleString()} contributions in the past 365 days</text>
  <g font-family="${MONO}" font-size="9" fill="${P.faint}">
    <text x="${W - 96}" y="${H - 18}">less</text>
    ${ops.map((o, i) => `<rect x="${W - 72 + i * 9}" y="${H - 25}" width="6" height="6" fill="${base}" fill-opacity="${o}"/>`).join("")}
    <text x="${W - 20}" y="${H - 18}" text-anchor="end">more</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" fill="none" stroke="${P.line}"/>
</g>
</svg>`;
};

// 6 — STONKS · the meme one -----------------------------------------------------
const stonks: Render = (d) => {
  const W = 480, H = 200;
  const up = d.up;
  const c = up ? "#2eea8b" : "#ff5b5b";
  const word = up ? "STONKS" : "NOT STONKS";
  // chunky pixel arrow (rects), pointing up-right or down-right
  const px = 14;
  const steps = [0, 1, 2, 3, 4, 5, 6, 7];
  const arrow = steps
    .map((i) => {
      const x = 60 + i * px;
      const y = up ? 150 - i * 12 : 60 + i * 12;
      return `<rect x="${x}" y="${y}" width="${px}" height="${px}" fill="${c}"/>`;
    })
    .join("");
  // pixel-art arrowhead: stacked shrinking rows aligned to the staircase tip
  const tipX = 60 + 7 * px;
  const tipY = up ? 150 - 7 * 12 : 60 + 7 * 12;
  const head = [0, 1, 2]
    .map((r) => {
      const wRow = px * (3 - r);
      const x = tipX + px - wRow + (r * px) / 2;
      const y = up ? tipY - (r + 1) * 11 : tipY + px + r * 11;
      return `<rect x="${x.toFixed(1)}" y="${y}" width="${wRow}" height="11" fill="${c}"/>`;
    })
    .join("");
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const x2 = 240 + Math.cos(a) * 400;
    const y2 = 100 + Math.sin(a) * 400;
    return `<path d="M240 100 L${x2.toFixed(0)} ${y2.toFixed(0)} L${(x2 + 40).toFixed(0)} ${y2.toFixed(0)} Z" fill="#ffffff" opacity="0.018"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} ${word}">
<title>${esc(d.symbol)} — ${word}</title>
<defs><clipPath id="r"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#0b0d12"/>
  ${rays}
  ${arrow}${head}
  <text x="${W - 24}" y="78" text-anchor="end" font-family="${SANS}" font-size="44" font-weight="900" font-style="italic" fill="#f2f4f8" letter-spacing="-1">${word}</text>
  <text x="${W - 24}" y="120" text-anchor="end" font-family="${MONO}" font-size="30" font-weight="800" fill="${c}">${up ? "+" : ""}${d.changePct30d.toFixed(1)}%</text>
  <text x="${W - 24}" y="146" text-anchor="end" font-family="${MONO}" font-size="13" fill="#8a90a0">${esc(d.symbol)} · 30 days</text>
  <text x="24" y="${H - 16}" font-family="${MONO}" font-size="10" fill="#5a6070">${fmt(d.totalLastYear)} commits/52w</text>
  <text x="${W - 24}" y="${H - 16}" text-anchor="end" font-family="${MONO}" font-size="10" fill="#5a6070">commit-markets</text>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" fill="none" stroke="#23262e"/>
</g>
</svg>`;
};

// 7 — PILL · shields-compatible -------------------------------------------------
const pill: Render = (d) => {
  const label = "commit-markets";
  const value = `${d.symbol} ${chg(d)}`;
  const lw = Math.round(label.length * 6.6) + 16;
  const vw = Math.round(value.length * 7) + 18;
  const W = lw + vw, H = 20;
  const c = col(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(value)}">
<title>${esc(value)}</title>
<defs>
  <linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${W}" height="${H}" rx="3"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="${lw}" height="${H}" fill="#3a3f44"/>
  <rect x="${lw}" width="${vw}" height="${H}" fill="${c}"/>
  <rect width="${W}" height="${H}" fill="url(#s)"/>
  <g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="${lw / 2}" y="14.5" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lw / 2}" y="13.5" fill="#fff">${label}</text>
    <text x="${lw + vw / 2}" y="14.5" fill="#010101" fill-opacity=".3">${esc(value)}</text>
    <text x="${lw + vw / 2}" y="13.5" fill="#fff" font-weight="600">${esc(value)}</text>
  </g>
</g>
</svg>`;
};

// 8 — BLOOMBERG · amber terminal panel ------------------------------------------
const bloomberg: Render = (d) => {
  const W = 480, H = 210;
  const a = AMBER;
  const white = "#f5f1e8";
  const sym = esc(d.symbol.replace("$", ""));
  const kv = (x: number, y: number, k: string, v: string, vc = white) =>
    `<text x="${x}" y="${y}" font-family="${MONO}" font-size="11" fill="${a}" opacity="0.85">${k}</text><text x="${x}" y="${y + 16}" font-family="${MONO}" font-size="15" font-weight="700" fill="${vc}">${v}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} terminal">
<title>${esc(d.symbol)} — CMKT terminal</title>
<defs>
  <pattern id="scan" width="1" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" y="2" fill="#000" opacity="0.18"/></pattern>
  <clipPath id="r"><rect width="${W}" height="${H}" rx="6"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#050505"/>
  <rect width="${W}" height="26" fill="${a}"/>
  <text x="14" y="18" font-family="${MONO}" font-size="12" font-weight="800" fill="#050505">${sym} US <tspan font-weight="600">EQUITY</tspan></text>
  <text x="${W - 14}" y="18" text-anchor="end" font-family="${MONO}" font-size="12" font-weight="800" fill="#050505">CMKT &lt;GO&gt;</text>
  ${kv(20, 56, "LAST", d.price.toFixed(2))}
  ${kv(140, 56, "CHG 30D", `${d.up ? "+" : ""}${d.changePct30d.toFixed(1)}%`, col(d) === DOWN ? "#ff6b6b" : "#4be38a")}
  ${kv(260, 56, "COMMITS 52W", fmt(d.totalLastYear))}
  ${kv(390, 56, "STREAK", `${d.streak}D`)}
  ${kv(20, 110, "PEAK WK", `${d.peakWeek}`)}
  ${kv(140, 110, "FOLLOWERS", fmt(d.followers))}
  ${kv(260, 110, "HANDLE", esc(clampHandle(d.handle, 14)).toUpperCase())}
  <path d="${sparkPath(d.spark, 20, 142, W - 40, 36)}" fill="none" stroke="${a}" stroke-width="1.5" stroke-linejoin="round"/>
  <line x1="0" x2="${W}" y1="${H - 22}" y2="${H - 22}" stroke="#1c1c1c"/>
  <text x="14" y="${H - 8}" font-family="${MONO}" font-size="9" fill="${a}" opacity="0.7">COMMIT-MARKETS TERMINAL</text>
  <text x="${W - 14}" y="${H - 8}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${a}" opacity="0.7">F8 EQUITY · 30D WINDOW</text>
  <rect width="${W}" height="${H}" fill="url(#scan)"/>
</g>
</svg>`;
};

// 9 — RECEIPT · thermal printer -------------------------------------------------
const receipt: Render = (d) => {
  const W = 340, H = 430;
  const ink = "#1b1b1b";
  const paper = "#f7f5ef";
  const C = "'Courier New',Courier,monospace";
  const row = (y: number, k: string, v: string, bold = false) =>
    `<text x="28" y="${y}" font-family="${C}" font-size="13" fill="${ink}" ${bold ? 'font-weight="700"' : ""}>${k}</text><text x="${W - 28}" y="${y}" text-anchor="end" font-family="${C}" font-size="13" fill="${ink}" ${bold ? 'font-weight="700"' : ""}>${v}</text>`;
  const dash = (y: number) => `<line x1="24" x2="${W - 24}" y1="${y}" y2="${y}" stroke="${ink}" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>`;
  // deterministic barcode from handle
  let seed = 0;
  for (const ch of d.handle) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  let bx = 48, bars = "";
  while (bx < W - 48) {
    seed = (seed * 137 + 71) % 9973;
    const bw = 1 + (seed % 4);
    if (seed % 3) bars += `<rect x="${bx}" y="${H - 78}" width="${bw}" height="34" fill="${ink}"/>`;
    bx += bw + 2;
  }
  const zig = (y: number, flip: boolean) => {
    let p = `M16 ${y}`;
    for (let x = 16; x < W - 16; x += 12) p += ` l6 ${flip ? -7 : 7} l6 ${flip ? 7 : -7}`;
    return `<path d="${p}" fill="none" stroke="#d9d5c9" stroke-width="1.5"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)} commit receipt">
<title>${esc(d.symbol)} — commit receipt</title>
<rect width="${W}" height="${H}" fill="${paper}" rx="4"/>
${zig(14, false)}${zig(H - 14, true)}
<text x="${W / 2}" y="52" text-anchor="middle" font-family="${C}" font-size="17" font-weight="700" fill="${ink}" letter-spacing="3">COMMIT-MARKETS</text>
<text x="${W / 2}" y="72" text-anchor="middle" font-family="${C}" font-size="11" fill="${ink}" opacity="0.75">* OFFICIAL COMMIT RECEIPT *</text>
${dash(88)}
${row(112, "TICKER", esc(d.symbol))}
${row(136, "PRICE", d.price.toFixed(2))}
${row(160, "30D CHANGE", `${d.up ? "+" : ""}${d.changePct30d.toFixed(1)}%`)}
${row(184, "COMMITS 52W", d.totalLastYear.toLocaleString())}
${row(208, "STREAK", `${d.streak} DAYS`)}
${row(232, "PEAK WEEK", `${d.peakWeek}`)}
${dash(252)}
${row(276, "TOTAL", d.price.toFixed(2), true)}
${dash(296)}
<text x="${W / 2}" y="320" text-anchor="middle" font-family="${C}" font-size="11" fill="${ink}" opacity="0.85">CASHIER: GITHUB · LANE 1</text>
<text x="${W / 2}" y="338" text-anchor="middle" font-family="${C}" font-size="11" fill="${ink}" opacity="0.85">OPEN 24/7 · NO REFUNDS</text>
${bars}
<text x="${W / 2}" y="${H - 32}" text-anchor="middle" font-family="${C}" font-size="12" font-weight="700" fill="${ink}" letter-spacing="2">THANK YOU FOR SHIPPING</text>
</svg>`;
};

// 10 — GLOW · premium glass ------------------------------------------------------
const glow: Render = (d) => {
  const W = 480, H = 200;
  const c = col(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.symbol)}">
<title>${esc(d.symbol)} — commit-markets</title>
<defs>
  <radialGradient id="halo" cx="0.5" cy="1" r="0.9">
    <stop offset="0" stop-color="${c}" stop-opacity="0.28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bord" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c}" stop-opacity="0.8"/><stop offset="0.5" stop-color="#3a4148" stop-opacity="0.4"/><stop offset="1" stop-color="${c}" stop-opacity="0.25"/>
  </linearGradient>
  <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <clipPath id="r"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#07090c"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  <path d="${sparkPath(d.spark, 0, 70, W, 100)}" fill="none" stroke="${c}" stroke-width="5" opacity="0.35" filter="url(#blur)"/>
  <path d="${sparkPath(d.spark, 0, 70, W, 100)}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="28" y="44" font-family="${SANS}" font-size="20" font-weight="700" fill="#eef1f4" letter-spacing="0.5">${esc(d.symbol)}</text>
  <text x="28" y="64" font-family="${MONO}" font-size="11" fill="#7c858d">${esc(clampHandle(d.handle))} · 52 weeks</text>
  <text x="${W - 28}" y="44" text-anchor="end" font-family="${MONO}" font-size="24" font-weight="700" fill="#eef1f4">${d.price.toFixed(2)}</text>
  <text x="${W - 28}" y="64" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="600" fill="${c}">${chg(d)} · 30d</text>
  <text x="${W - 28}" y="${H - 18}" text-anchor="end" font-family="${MONO}" font-size="10" fill="#5a626a">commit-markets</text>
</g>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="15.25" fill="none" stroke="url(#bord)" stroke-width="1.5"/>
</svg>`;
};

export const STYLES: Record<string, { render: Render; needsAvatar: boolean }> = {
  card: { render: card, needsAvatar: true },
  terminal: { render: terminal, needsAvatar: false },
  tape: { render: tape, needsAvatar: false },
  candles: { render: candles, needsAvatar: false },
  heatmap: { render: heatmap, needsAvatar: false },
  stonks: { render: stonks, needsAvatar: false },
  pill: { render: pill, needsAvatar: false },
  bloomberg: { render: bloomberg, needsAvatar: false },
  receipt: { render: receipt, needsAvatar: false },
  glow: { render: glow, needsAvatar: false },
};

export const STYLE_NAMES = Object.keys(STYLES);
