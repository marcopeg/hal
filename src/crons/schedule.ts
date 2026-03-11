/**
 * Relative schedule expression parser.
 *
 * Supported formats:
 *
 *   +3s   fire after 3 s,  then repeat every 3 s  (interval / recurring)
 *   3s    same as +3s — the + prefix is optional for recurring schedules
 *   +2m   fire after 2 m,  then repeat every 2 m
 *   +1h   fire after 1 h,  then repeat every 1 h
 *   +22d  fire after 22 d, then repeat every 22 d
 *   +1w   fire after 1 w,  then repeat every 1 w
 *
 *   !3s   fire once after 3 s  (single-shot)
 *   !2m   fire once after 2 m
 *   etc.
 *
 * Unit suffixes (case-insensitive): s, m, h, d, w
 * Amount can be an integer or decimal (e.g. +1.5h = 90 minutes).
 * The + prefix is optional: "5s" and "+5s" are identical.
 */

export interface RelativeSchedule {
  /** "interval": fire after delay, then repeat at the same interval.
   *  "once":     fire once after the delay. */
  mode: "interval" | "once";
  /** Delay / interval in milliseconds (rounded to nearest ms). */
  ms: number;
}

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/**
 * Parse a relative schedule expression (`+Xs` / `!Xs`).
 * Returns `null` if the string is not a relative expression — caller should
 * treat it as a standard cron expression or pass it to croner.
 */
export function parseRelativeSchedule(expr: string): RelativeSchedule | null {
  const match = expr.match(/^([+!]?)(\d+(?:\.\d+)?)(s|m|h|d|w)$/i);
  if (!match) return null;
  const [, prefix, amount, unit] = match;
  const ms = Math.round(parseFloat(amount) * UNIT_MS[unit.toLowerCase()]);
  return { mode: prefix === "!" ? "once" : "interval", ms };
}
