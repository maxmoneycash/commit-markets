// The curated set of tracked accounts — the "listed" market until open listings
// exist. This is the single source of truth: the discovery board renders it, and
// the momentum foundation (snapshot cron) seeds from it. Add a handle here and it
// shows up on the board AND starts accruing daily momentum history.
export const BOARD = [
  "torvalds", "antirez", "sindresorhus", "gaearon", "tj", "yyx990803",
  "kentcdodds", "ThePrimeagen", "mitchellh", "addyosmani", "leerob", "rauchg",
  "shadcn", "t3dotgg", "jdalton", "maxmoneycash",
];
