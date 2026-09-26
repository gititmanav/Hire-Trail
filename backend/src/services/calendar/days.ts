/**
 * Calendar days on the server — the twin of the client's `utils/dates.ts`.
 *
 * Mongo holds two kinds of dates, and they read differently:
 *  - **plain days** — a date the user picked (a deadline, a corrected applied
 *    date), stored as UTC midnight: the day is the UTC date;
 *  - **moments** — when something happened (extension saves, stage moves),
 *    stored with a time: the day is the date in the viewer's time zone.
 * A day is always a `YYYY-MM-DD` string; those compare correctly as text.
 */

const DAY_MS = 86_400_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !YMD.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00.000Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** An IANA zone the runtime knows, or "UTC". */
export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function localYmd(d: Date, tz: string): string {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(tz, f);
  }
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The calendar day a stored date falls on for a viewer in `tz` ("" if invalid). */
export function dayIn(value: Date | null | undefined, tz: string): string {
  if (!value) return "";
  const t = value.getTime();
  if (Number.isNaN(t)) return "";
  if (t % DAY_MS === 0) return value.toISOString().slice(0, 10);
  return localYmd(value, tz);
}

/** Today in `tz`. */
export function todayIn(tz: string): string {
  return localYmd(new Date(), tz);
}

/** UTC-midnight instant of a `YYYY-MM-DD`, shifted by whole days. Used to pad a
 *  day range into an instant range wide enough for every zone (±14h). */
export function utcDay(ymd: string, plusDays = 0): Date {
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) + plusDays * DAY_MS);
}

/** Whole days from `a` to `b`. */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / DAY_MS);
}
