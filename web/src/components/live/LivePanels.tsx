"use client";

// Client-side telemetry panels for /[handle]/live — all data comes from the
// viewer's own browser APIs (RAF, performance.memory, connection, battery,
// input events). Graceful fallbacks where an API doesn't exist.

import { useEffect, useRef, useState } from "react";
import { DotDigits, SegmentBar } from "./DotMatrix";

function Chrome({
  label,
  right,
  children,
  className = "",
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col bg-background p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function LiveTag() {
  return (
    <span className="flex items-center gap-1.5 text-success">
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      LIVE
    </span>
  );
}

// — CLOCK ————————————————————————————————————————————————————————————
export function ClockPanel({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setNow(new Date());
      setUptime((u) => u + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const ss = now ? String(now.getSeconds()).padStart(2, "0") : "00";
  const day = now ? now.toLocaleDateString("en", { weekday: "long" }) : "";
  const date = now
    ? now.toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "";
  const week = now ? Math.ceil(((+now - +new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7) : 0;
  const up = `${String(Math.floor(uptime / 3600)).padStart(2, "0")}:${String(Math.floor((uptime % 3600) / 60)).padStart(2, "0")}:${String(uptime % 60).padStart(2, "0")}`;

  if (compact) {
    return (
      <Chrome label="local time" right={<span className="text-success">GREEN ▪</span>} className="cm-dotbg">
        <div className="flex flex-1 items-center py-2 text-foreground">
          {now ? (
            <div className="flex items-end gap-1.5">
              <DotDigits text={`${hh}:${mm}`} dot={4} gap={1.8} off />
              <span className="text-muted-foreground/50">
                <DotDigits text={ss} dot={2.4} gap={1.2} />
              </span>
            </div>
          ) : (
            <div className="h-[39px]" />
          )}
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {day ? `${day.slice(0, 3).toUpperCase()} · ` : ""}{date} · WK {week} · UP {up}
        </div>
      </Chrome>
    );
  }

  return (
    <Chrome label="local time" right={<span>UPTIME {up}</span>} className="cm-dotbg row-span-2">
      <div className="flex flex-1 items-center justify-center py-6 text-foreground">
        {now ? (
          <div className="flex items-end gap-2">
            <DotDigits text={`${hh}:${mm}`} dot={7} gap={3} off />
            <span className="text-muted-foreground/50">
              <DotDigits text={ss} dot={3.5} gap={1.5} />
            </span>
          </div>
        ) : (
          <div className="h-[67px]" />
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-sans text-xl font-semibold text-foreground">{day}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {date} · WEEK {week}
          </div>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          SYS NOMINAL · ALL CHANNELS
          <br />
          <span className="text-success">GREEN ▪</span>
        </div>
      </div>
    </Chrome>
  );
}

// — RENDER / FPS ———————————————————————————————————————————————————————
export function RenderPanel() {
  const [fps, setFps] = useState(0);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = () => {
      frames++;
      const t = performance.now();
      if (t - last >= 1000) {
        setFps(frames);
        setMs(frames ? +((t - last) / frames).toFixed(1) : 0);
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pct = Math.min(1, fps / 60);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <Chrome label="render">
      <div className="flex flex-1 items-center justify-center py-2">
        <div className="relative">
          <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
            <circle cx="46" cy="46" r={R} fill="none" strokeWidth="6" className="stroke-muted-foreground/15" />
            <circle
              cx="46" cy="46" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(pct * C).toFixed(1)} ${C.toFixed(1)}`}
              className={fps >= 50 ? "stroke-success" : fps >= 30 ? "stroke-amber" : "stroke-destructive"}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-2xl font-bold text-foreground">
              {fps}
              <tspan className="text-[10px] text-muted-foreground"> </tspan>
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>RAF · COMPOSITE</span>
        <span>{ms} MS</span>
      </div>
    </Chrome>
  );
}

// — MEMORY ————————————————————————————————————————————————————————————
export function MemoryPanel() {
  const [used, setUsed] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      const m = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (m) {
        setUsed(m.usedJSHeapSize);
        setLimit(m.jsHeapSizeLimit);
      }
    };
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, []);
  const mb = used != null ? Math.round(used / 1048576) : null;
  const gb = limit != null ? (limit / 1073741824).toFixed(1) : null;
  const pct = used != null && limit ? (used / limit) * 100 : 0;
  return (
    <Chrome label="memory">
      <div className="flex-1">
        <div className="font-mono text-3xl font-bold text-foreground">
          {mb != null ? mb : "—"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">MB</span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {gb != null ? `/ ${gb} GB · ${pct.toFixed(0)}% HEAP` : "HEAP API UNAVAILABLE"}
        </div>
      </div>
      <SegmentBar pct={pct} segments={14} onClass="fill-foreground/70" className="mt-3" />
    </Chrome>
  );
}

// — NETWORK ————————————————————————————————————————————————————————————
export function NetworkPanel() {
  const [down, setDown] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { downlink?: number; rtt?: number; addEventListener?: (t: string, f: () => void) => void } }).connection;
    const read = () => {
      if (conn?.downlink != null) {
        setDown(conn.downlink);
        setHist((h) => [...h.slice(-23), conn.downlink ?? 0]);
      }
      if (conn?.rtt != null) setRtt(conn.rtt);
      setOnline(navigator.onLine);
    };
    read();
    const t = setInterval(read, 2500);
    return () => clearInterval(t);
  }, []);
  const max = Math.max(1, ...hist);
  return (
    <Chrome label="network" right={<LiveTag />}>
      <div className="flex-1">
        <div className="font-mono text-3xl font-bold text-foreground">
          {down != null ? down.toFixed(1) : "—"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">MB/S</span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {rtt != null ? `RTT ${rtt} MS · ` : ""}
          <span className={online ? "text-success" : "text-destructive"}>{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>
      <svg width="100%" height="18" viewBox="0 0 192 18" preserveAspectRatio="none" className="mt-3" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => {
          const v = hist[i] ?? 0;
          const h = Math.max(1.5, (v / max) * 16);
          return <rect key={i} x={i * 8} y={18 - h} width={5} height={h} className={i === hist.length - 1 ? "fill-success" : "fill-muted-foreground/30"} />;
        })}
      </svg>
    </Chrome>
  );
}

// — BATTERY ————————————————————————————————————————————————————————————
export function BatteryPanel() {
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState<boolean | null>(null);
  useEffect(() => {
    const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void }> };
    let bat: { level: number; charging: boolean } | null = null;
    if (!nav.getBattery) return;
    nav.getBattery().then((b) => {
      bat = b;
      const read = () => {
        setLevel(Math.round(b.level * 100));
        setCharging(b.charging);
      };
      read();
      b.addEventListener("levelchange", read);
      b.addEventListener("chargingchange", read);
    });
    return () => void bat;
  }, []);
  return (
    <Chrome label="battery" right={<LiveTag />}>
      <div className="flex-1 text-foreground">
        {level != null ? (
          <div className="flex items-baseline gap-1">
            <DotDigits text={`${level}`} dot={4.5} gap={2} />
            <span className="text-muted-foreground/40"><DotDigits text="%" dot={3} gap={1.5} /></span>
          </div>
        ) : (
          <div className="font-mono text-3xl font-bold">—</div>
        )}
      </div>
      <SegmentBar pct={level ?? 0} segments={14} className="mt-3" />
      <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {level == null ? "BATTERY API UNAVAILABLE" : charging ? "ON AC POWER · CHARGING" : "ON BATTERY"}
      </div>
    </Chrome>
  );
}

// — INPUT SEISMOGRAPH ———————————————————————————————————————————————————
export function SeismographPanel() {
  const [wave, setWave] = useState<number[]>(Array(120).fill(0));
  const [epm, setEpm] = useState(0);
  const count = useRef(0);
  const minute = useRef<number[]>([]);
  useEffect(() => {
    const bump = () => count.current++;
    window.addEventListener("pointermove", bump, { passive: true });
    window.addEventListener("keydown", bump);
    window.addEventListener("pointerdown", bump);
    const t = setInterval(() => {
      const c = count.current;
      count.current = 0;
      minute.current = [...minute.current.slice(-119), c];
      setEpm(minute.current.reduce((s, x) => s + x, 0) * (60 / Math.max(1, minute.current.length) / 0.5));
      setWave((w) => [...w.slice(-119), c]);
    }, 500);
    return () => {
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("pointerdown", bump);
      clearInterval(t);
    };
  }, []);
  const max = Math.max(4, ...wave);
  const mid = 22;
  const path = wave
    .map((v, i) => {
      const amp = (v / max) * 18;
      const y = mid + (i % 2 === 0 ? -amp : amp);
      return `${i ? "L" : "M"}${(i * (480 / 119)).toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <Chrome
      label="input seismograph · ch 01"
      right={
        <span className="flex items-center gap-1.5 text-destructive">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          REC
        </span>
      }
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {Math.round(epm)} EVT/MIN · POINTER + KEYS
      </div>
      <svg width="100%" height="44" viewBox="0 0 480 44" preserveAspectRatio="none" className="mt-2" aria-hidden>
        <path d={path} fill="none" strokeWidth="1.2" className="stroke-foreground/80" />
        <line x1="478" x2="478" y1="6" y2="38" strokeWidth="2" className="stroke-success" />
      </svg>
    </Chrome>
  );
}

export { Chrome as LiveChrome, LiveTag };
