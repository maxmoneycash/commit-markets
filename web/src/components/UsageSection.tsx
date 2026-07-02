import Link from "next/link";
import { getUsage, planMonthly, planLabel } from "@/lib/usageStore";
import { HatchSeparator } from "@/components/HatchSeparator";
import { Panel, PanelHeader, PanelTitle } from "@/components/panel";

function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}
function agoLabel(sec: number): string {
  if (sec < 90) return "just now";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-background px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-base tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

/**
 * The "AI grind" panel on a profile — live ccusage totals (tokens, value
 * extracted, leverage) for anyone who's connected their Mac. Renders nothing if
 * they haven't. This is what makes commits.sh about more than commits.
 */
export async function UsageSection({ handle }: { handle: string }) {
  const u = await getUsage(handle);
  const t = u?.payload.tokens;
  if (!u || !t || !t.total) return null;

  const value = t.cost_usd_total ?? 0;
  const plan = u.payload.plan;
  const monthly = planMonthly(plan);
  const leverage = monthly > 0 ? value / monthly : 0;

  const cells: { label: string; value: string; accent?: string }[] = [
    { label: "Tokens", value: short(t.total) },
    { label: "Value", value: `$${Math.round(value).toLocaleString()}` },
  ];
  if (leverage >= 1) cells.push({ label: "Leverage", value: `${Math.round(leverage)}×`, accent: "text-success" });
  if (t.models_used) cells.push({ label: "Models", value: `${t.models_used}` });
  cells.push({ label: "Streamed", value: agoLabel(u.ageSec) });

  return (
    <>
      <HatchSeparator />
      <Panel>
        <PanelHeader className="flex items-center justify-between">
          <PanelTitle>AI grind</PanelTitle>
          <Link
            href={`/${handle}/live`}
            className="flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success hover:bg-success/20"
          >
            <span className="size-1 animate-pulse rounded-full bg-success" />
            live →
          </Link>
        </PanelHeader>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {cells.map((c) => (
            <Cell key={c.label} label={c.label} value={c.value} accent={c.accent} />
          ))}
        </div>
        {leverage >= 1 && (
          <div className="screen-line-top px-4 py-3 font-mono text-xs text-muted-foreground">
            <span className="text-success">${Math.round(value).toLocaleString()}</span> of API value on a{" "}
            {planLabel(plan)} plan — <span className="text-foreground">{Math.round(leverage)}× leverage</span>.
          </div>
        )}
      </Panel>
    </>
  );
}
