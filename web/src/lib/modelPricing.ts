// Model pricing reference + name normalization.
//
// TWO sources of truth, kept deliberately separate (see plan):
//   • EFFECTIVE $/Mtok  — derived from the user's REAL cost data (cost ÷ tokens).
//     Always accurate. Computed at the call site, not here.
//   • REFERENCE $/Mtok  — the published list prices below. These are a
//     best-effort, EDITABLE seed: unreleased models (e.g. gpt-5.5, fable-5)
//     inherit their family tier as a placeholder, NOT an authoritative quote.
//     Correct any number here as real prices land; this table is also the seed
//     for the future "compute repricing / CPI" macro layer.
//
// All prices are USD per 1,000,000 tokens.

export type Provider =
  | "anthropic"
  | "openai"
  | "moonshot"
  | "zhipu"
  | "google"
  | "xai"
  | "deepseek"
  | "alibaba"
  | "nvidia"
  | "other";

export type UnitPrice = {
  inputPerMtok: number;
  outputPerMtok: number;
  cacheReadPerMtok: number;
  cacheWritePerMtok: number;
};

export type ModelMeta = {
  provider: Provider;
  family: string; // tier key into REFERENCE
  display: string; // tidy label for the UI
};

// Provider accent colors (align with AGENT_COLORS in UsagePanels).
export const PROVIDER_COLORS: Record<Provider, string> = {
  anthropic: "#d97757",
  openai: "#19c37d",
  moonshot: "#a371f7",
  zhipu: "#3b82f6",
  google: "#4285f4",
  xai: "#e3e9f0",
  deepseek: "#536af6",
  alibaba: "#615ced",
  nvidia: "#76b900",
  other: "#8b949e",
};

// Reference list prices per family/tier. EDIT ME as real prices land.
const REFERENCE: Record<string, UnitPrice> = {
  "anthropic-opus": { inputPerMtok: 15, outputPerMtok: 75, cacheReadPerMtok: 1.5, cacheWritePerMtok: 18.75 },
  "anthropic-sonnet": { inputPerMtok: 3, outputPerMtok: 15, cacheReadPerMtok: 0.3, cacheWritePerMtok: 3.75 },
  "anthropic-haiku": { inputPerMtok: 0.8, outputPerMtok: 4, cacheReadPerMtok: 0.08, cacheWritePerMtok: 1 },
  "openai-flagship": { inputPerMtok: 1.25, outputPerMtok: 10, cacheReadPerMtok: 0.125, cacheWritePerMtok: 1.25 },
  "openai-reasoning": { inputPerMtok: 2, outputPerMtok: 8, cacheReadPerMtok: 0.5, cacheWritePerMtok: 2 },
  "openai-4o": { inputPerMtok: 2.5, outputPerMtok: 10, cacheReadPerMtok: 1.25, cacheWritePerMtok: 2.5 },
  "moonshot-kimi": { inputPerMtok: 0.6, outputPerMtok: 2.5, cacheReadPerMtok: 0.15, cacheWritePerMtok: 0.6 },
  "zhipu-glm": { inputPerMtok: 0.6, outputPerMtok: 2.2, cacheReadPerMtok: 0.11, cacheWritePerMtok: 0.6 },
  "xai-grok": { inputPerMtok: 3, outputPerMtok: 15, cacheReadPerMtok: 0.75, cacheWritePerMtok: 3 },
  "deepseek": { inputPerMtok: 0.27, outputPerMtok: 1.1, cacheReadPerMtok: 0.07, cacheWritePerMtok: 0.27 },
  "alibaba-qwen": { inputPerMtok: 0.4, outputPerMtok: 1.2, cacheReadPerMtok: 0.1, cacheWritePerMtok: 0.4 },
  "google-gemma": { inputPerMtok: 0.1, outputPerMtok: 0.4, cacheReadPerMtok: 0.025, cacheWritePerMtok: 0.1 },
  "free": { inputPerMtok: 0, outputPerMtok: 0, cacheReadPerMtok: 0, cacheWritePerMtok: 0 },
};

// Map a raw (messy) model name → provider, family tier, tidy display name.
export function normalize(raw: string): ModelMeta {
  const n = raw.toLowerCase();
  const tidy = (label: string): string => label;

  // explicit free/local tiers first
  if (n.includes("free") || n.startsWith("nvidia/") || n.includes("nemotron")) {
    const provider: Provider = n.includes("nemotron") || n.startsWith("nvidia/") ? "nvidia" : "other";
    return { provider, family: "free", display: tidy(raw) };
  }

  // Anthropic / Claude
  if (n.startsWith("claude") || n.includes("opus") || n.includes("sonnet") || n.includes("haiku") || n.includes("fable")) {
    let family = "anthropic-sonnet";
    if (n.includes("opus") || n.includes("fable")) family = "anthropic-opus"; // fable-5 ≈ opus tier (placeholder)
    else if (n.includes("haiku")) family = "anthropic-haiku";
    return { provider: "anthropic", family, display: tidy(raw) };
  }

  // OpenAI / GPT / o-series / codex
  if (n.startsWith("gpt") || n.startsWith("o3") || n.startsWith("o1") || n.startsWith("o4") || n.includes("codex")) {
    let family = "openai-flagship";
    if (/^o[1-9]/.test(n)) family = "openai-reasoning";
    else if (n.includes("4o") || n === "gpt-4o") family = "openai-4o";
    return { provider: "openai", family, display: tidy(raw) };
  }

  if (n.includes("kimi") || n.startsWith("moonshot")) return { provider: "moonshot", family: "moonshot-kimi", display: tidy(raw) };
  if (n.includes("glm") || n.startsWith("z-ai") || n.includes("zhipu")) return { provider: "zhipu", family: "zhipu-glm", display: tidy(raw) };
  if (n.includes("grok")) return { provider: "xai", family: "xai-grok", display: tidy(raw) };
  if (n.includes("deepseek")) return { provider: "deepseek", family: "deepseek", display: tidy(raw) };
  if (n.includes("qwen")) return { provider: "alibaba", family: "alibaba-qwen", display: tidy(raw) };
  if (n.includes("gemma") || n.includes("gemini") || n.startsWith("google")) return { provider: "google", family: "google-gemma", display: tidy(raw) };

  return { provider: "other", family: "free", display: tidy(raw) };
}

/** Reference list price for a model name (null only if family is unknown). */
export function referencePrice(raw: string): UnitPrice | null {
  return REFERENCE[normalize(raw).family] ?? null;
}

/** Effective blended $/Mtok from REAL data — accurate, never seeded.
 *  Denominator counts every billable token (in + out + cache read + write). */
export function effectivePerMtok(cost: number, inTok: number, out: number, cacheRead: number, cacheWrite: number): number | null {
  const totalTok = inTok + out + cacheRead + cacheWrite;
  if (totalTok <= 0) return null;
  return (cost / totalTok) * 1_000_000;
}
