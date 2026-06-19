// The set of accounts the snapshotter records each tick. This is the resolution
// universe for prediction markets — every listed account must be snapshotted so
// its index is recoverable at any past timestamp.
//
// NOTE: page.tsx currently has its own inline BOARD copy. Unify by importing this
// once the concurrent page edits settle (left untouched here to avoid a conflict).
// Long term this becomes dynamic (all listed accounts from the DB), not a constant.
export const TRACKED_HANDLES: string[] = [
  "torvalds", "antirez", "sindresorhus", "gaearon", "tj", "yyx990803",
  "kentcdodds", "ThePrimeagen", "mitchellh", "addyosmani", "leerob", "rauchg",
  "shadcn", "t3dotgg", "jdalton", "maxmoneycash",
];
