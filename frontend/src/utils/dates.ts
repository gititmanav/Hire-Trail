/**
 * Plain-date helpers — the ONLY place a calendar day converts between its
 * string form and a Date.
 *
 * In the client, every scheduled date is a local `YYYY-MM-DD` string ("Ymd").
 * Those strings compare as plain text in date order (`a < b`, sorting), and
 * they carry no time or zone, so nothing can shift them. Going through these
 * functions keeps the app safe from the two classic bugs:
 *   - `new Date("2026-07-01")` is UTC midnight — June 30 in the Americas;
 *   - `date.toISOString().slice(0, 10)` on a local date is the UTC day — the
 *     previous day east of UTC.
 *
 * Stored dates come back from the API as ISO strings of two kinds; `dayOf`
 * reads both (see there). Send days back to the API as `YYYY-MM-DD`.
 */

export type Ymd = string;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function isYmd(s: unknown): s is Ymd {
  return typeof s === "string" && YMD.test(s);
}

/** `YYYY-MM-DD` → local Date at midnight, or null for empty/malformed input. */
export function parseYmd(s?: string | null): Date | null {
  const m = s ? YMD.exec(s) : null;
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** Local Date → `YYYY-MM-DD`. */
export function formatYmd(dt: Date): Ymd {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** A (year, 0-based month, day) triple → `YYYY-MM-DD`, normalising overflow
 *  (day 0 = the last day of the previous month, month 12 = next January). */
export function ymdOf(year: number, month: number, day: number): Ymd {
  return formatYmd(new Date(year, month, day));
}

export function todayYmd(): Ymd {
  return formatYmd(new Date());
}

/** `YYYY-MM-DD` shifted by whole days (negative = earlier). */
export function addDaysYmd(s: Ymd, days: number): Ymd {
  const dt = parseYmd(s)!;
  dt.setDate(dt.getDate() + days);
  return formatYmd(dt);
}

/** Whole days from `a` to `b` (positive when `b` is later). Rounded, so a
 *  23- or 25-hour DST day still counts as one. */
export function diffDaysYmd(a: Ymd, b: Ymd): number {
  return Math.round((parseYmd(b)!.getTime() - parseYmd(a)!.getTime()) / 86_400_000);
}

/** The month `delta` months from (year, 0-based month). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const dt = new Date(year, month + delta, 1);
  return { year: dt.getFullYear(), month: dt.getMonth() };
}

/** 0-based month + year of a day. */
export function monthOf(day: Ymd): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
}

/**
 * The calendar day a stored date falls on. Mongo holds two kinds of dates:
 *  - **plain days** — a date the user picked (deadlines, a corrected applied
 *    date), stored as UTC midnight: the day is the UTC date;
 *  - **moments** — when something happened (extension saves, stage moves),
 *    stored with a time: the day is the viewer's local date.
 * The server's calendar endpoint applies the same rule with the viewer's zone.
 * Returns "" for a missing or invalid value.
 */
export function dayOf(value: string | Date | null | undefined): Ymd | "" {
  if (value == null || value === "") return "";
  if (typeof value === "string" && YMD.test(value)) return value;
  const dt = value instanceof Date ? value : new Date(value);
  const t = dt.getTime();
  if (Number.isNaN(t)) return "";
  if (t % 86_400_000 === 0) return dt.toISOString().slice(0, 10);
  return formatYmd(dt);
}

/** `dayOf` as a local-midnight Date — for formatting and day arithmetic in
 *  code that works with Dates. Null for a missing or invalid value. */
export function dayDate(value: string | Date | null | undefined): Date | null {
  return parseYmd(dayOf(value));
}

/** `YYYY-MM-DD` formatted with `toLocaleDateString` options. */
export function formatDay(day: Ymd, opts: Intl.DateTimeFormatOptions, locale?: string): string {
  const dt = parseYmd(day);
  return dt ? dt.toLocaleDateString(locale, opts) : "";
}

/** "Today", "Tomorrow", "Yesterday", "in 3 days", "3 days ago". */
export function relativeDay(day: Ymd, today: Ymd = todayYmd()): string {
  const n = diffDaysYmd(today, day);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/* ─── Weeks ─── */

// Regions whose week starts on Sunday — the fallback when the runtime has no
// Intl week info (older Safari / Firefox).
const SUNDAY_REGIONS = new Set([
  "US", "CA", "MX", "BR", "JP", "KR", "TW", "HK", "MO", "PH", "IL", "IN", "SA", "ZA", "CO", "PE", "VE", "GT", "HN", "NI",
  "PA", "DO", "PR", "SV", "BZ", "JM", "KE", "ET", "ZW", "TH", "KH", "LA", "MM", "ID", "BT", "NP", "PK", "YE", "AS", "GU", "UM", "VI",
]);
const weekStartCache = new Map<string, number>();

/** The first day of the week for a locale: 0 = Sunday … 6 = Saturday. One
 *  answer for every month grid in the app. */
export function weekStartDay(locale?: string): number {
  const tag = locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const hit = weekStartCache.get(tag);
  if (hit != null) return hit;
  let first = 0;
  try {
    const loc = new Intl.Locale(tag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) first = info.firstDay % 7; // Intl: 1 = Monday … 7 = Sunday
    else first = SUNDAY_REGIONS.has(loc.maximize().region ?? "US") ? 0 : 1;
  } catch {
    first = 0;
  }
  weekStartCache.set(tag, first);
  return first;
}

/** The first day of the week holding `day`, for a week that starts on `weekStart`. */
export function weekStartOf(day: Ymd, weekStart: number): Ymd {
  const dt = parseYmd(day)!;
  const back = (dt.getDay() - weekStart + 7) % 7;
  return addDaysYmd(day, -back);
}

/** Weekday indexes (0 = Sunday) in display order for a week start. */
export function weekdayOrder(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

/** Localised weekday names for a week start ("Sun"… or "S"…). */
export function weekdayNames(weekStart: number, width: "short" | "narrow" = "short", locale?: string): string[] {
  // 2023-01-01 was a Sunday: day index i ↔ Jan 1 + i.
  return weekdayOrder(weekStart).map((i) => new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: width }));
}
