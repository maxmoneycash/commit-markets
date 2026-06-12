// Macro events rendered as vertical annotations on every chart.
// CURATION RULE: only verifiable, dated events — model releases, pricing
// changes, major outages. No speculation; an empty list beats a wrong one.

export type MacroEvent = { date: string; label: string };

export const MACRO_EVENTS: MacroEvent[] = [
  // first observed in local usage logs on this date (collector-verified)
  { date: "2026-06-12", label: "FABLE 5" },
];
