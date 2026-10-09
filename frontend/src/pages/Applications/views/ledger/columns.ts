/** Column model for the Ledger.
 *
 *  "role" (who) and "focus" (what it's waiting on) always show — they are the
 *  row. Optional columns appear as the container grows: the 1st optional
 *  column fits from 620px, the 2nd from 780px, … (`minWidth`s below, in
 *  default order). Users reorder and hide optional columns under Display →
 *  Columns; their order is also the fit priority, so the columns they put
 *  first are the ones that stay on a narrow screen. Below 620px a row folds
 *  into two lines instead (LedgerList). */

export type ColumnId =
  | "role" | "focus" | "stage" | "trail" | "fit" | "resume"
  | "applied" | "location" | "salary" | "source";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** CSS grid track. */
  track: string;
  /** Container width (px) at which the column in this POSITION fits (see above). */
  minWidth: number;
  /** Can the user hide it? */
  optional: boolean;
  align?: "right";
}

export const COLUMNS: ColumnDef[] = [
  { id: "role",     label: "Role",      track: "minmax(220px, 2.2fr)", minWidth: 0,    optional: false },
  { id: "focus",    label: "Next",      track: "minmax(176px, 1.25fr)", minWidth: 0,   optional: false },
  { id: "stage",    label: "Stage",     track: "112px",                minWidth: 620,  optional: true },
  { id: "trail",    label: "Trail",     track: "132px",                minWidth: 780,  optional: true },
  { id: "fit",      label: "Fit",       track: "60px",                 minWidth: 880,  optional: true },
  { id: "resume",   label: "Resume",    track: "minmax(120px, 0.9fr)", minWidth: 1000, optional: true },
  { id: "applied",  label: "Applied",   track: "76px",                 minWidth: 1120, optional: true },
  { id: "location", label: "Location",  track: "minmax(120px, 0.9fr)", minWidth: 1260, optional: true },
  { id: "salary",   label: "Salary",    track: "minmax(110px, 0.8fr)", minWidth: 1400, optional: true },
  { id: "source",   label: "Source",    track: "92px",                 minWidth: 1540, optional: true },
];

export const OPTIONAL_COLUMNS = COLUMNS.filter((c) => c.optional);

/** Optional columns in their default order. */
export const DEFAULT_COLUMN_ORDER: ColumnId[] = OPTIONAL_COLUMNS.map((c) => c.id);

const BY_ID = new Map(COLUMNS.map((c) => [c.id, c]));
/** Width at which the 1st, 2nd, … optional column fits. */
const SLOT_WIDTHS = OPTIONAL_COLUMNS.map((c) => c.minWidth);

/** Below this the row folds into two lines. */
export const COMPACT_BELOW = 620;

/** The peek toggle's column, always last. */
export const PEEK_TRACK = "28px";

/** A stored order made whole: unknown ids dropped (the Table's "inStage" and
 *  "next" became the focus column), duplicates removed, and optional columns
 *  it doesn't mention (added in a later release) appended. */
export function normalizeColumnOrder(order: readonly string[]): ColumnId[] {
  const seen = new Set<ColumnId>();
  for (const id of order) {
    const c = BY_ID.get(id as ColumnId);
    if (c?.optional) seen.add(c.id);
  }
  for (const id of DEFAULT_COLUMN_ORDER) seen.add(id);
  return [...seen];
}

export const isColumnOrder = (v: unknown): v is ColumnId[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** The columns a Ledger of `width` px shows: role + focus, then the user's
 *  visible optional columns in their order, as many as fit. */
export function ledgerColumns(order: readonly ColumnId[], hidden: readonly ColumnId[], width: number): ColumnDef[] {
  const fits = SLOT_WIDTHS.filter((w) => width >= w).length;
  const optional = normalizeColumnOrder(order).filter((id) => !hidden.includes(id)).slice(0, fits);
  return [...COLUMNS.filter((c) => !c.optional), ...optional.map((id) => BY_ID.get(id)!)];
}

/** Every width at which the column set can change — a resize re-renders the
 *  list only when it crosses one of these. */
export const WIDTH_STEPS = [COMPACT_BELOW, ...SLOT_WIDTHS];
